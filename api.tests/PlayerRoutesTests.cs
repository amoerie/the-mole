using Api.Data;
using Api.Models;
using Api.Tests.Helpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests;

[Collection("Integration")]
public sealed class PlayerRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public PlayerRoutesTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        TestAuthHandler.UserId = "test-user-id";
        TestAuthHandler.DisplayName = "Test User";
        TestAuthHandler.IsAuthenticated = true;
        TestAuthHandler.Roles = ["authenticated"];
    }

    private HttpClient CreateClient() =>
        _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    private void PrepareDb(Action<AppDbContext>? seed = null)
    {
        _factory.ResetDb();
        if (seed == null)
            return;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        seed(db);
        db.SaveChanges();
    }

    private static Game CreateGame(string adminUserId = "admin-user") =>
        new()
        {
            Id = "game-1",
            Name = "Test Game",
            AdminUserId = adminUserId,
            InviteCode = "INVITE01",
        };

    [Fact]
    public async Task GetPlayers_WhenUnauthenticated_ReturnsUnauthorized()
    {
        PrepareDb();
        TestAuthHandler.IsAuthenticated = false;
        try
        {
            var client = CreateClient();
            var response = await client.GetAsync("/api/games/game-1/players");
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        finally
        {
            TestAuthHandler.IsAuthenticated = true;
        }
    }

    [Fact]
    public async Task GetPlayers_WhenGameNotFound_ReturnsNotFound()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.GetAsync("/api/games/nonexistent/players");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetPlayers_WhenNotPlayerOrAdmin_ReturnsUnauthorized()
    {
        var game = CreateGame();
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/players");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetPlayers_WhenPlayer_ReturnsPlayerList()
    {
        var game = CreateGame();
        var player = new Player
        {
            GameId = game.Id,
            UserId = "test-user-id",
            DisplayName = "Test User",
        };
        var player2 = new Player
        {
            GameId = game.Id,
            UserId = "other-user",
            DisplayName = "Other User",
        };
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
            db.Players.Add(player2);
        });
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/players");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(2, body!.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task GetPlayers_WhenAdmin_ReturnsPlayerList()
    {
        var game = CreateGame(adminUserId: "test-user-id");
        var player = new Player
        {
            GameId = game.Id,
            UserId = "another-user",
            DisplayName = "Another User",
        };
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/players");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(1, body!.RootElement.GetArrayLength());
        Assert.Equal("Another User", body!.RootElement[0].GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task GetPlayers_WhenNoPlayers_ReturnsEmptyList()
    {
        var game = CreateGame(adminUserId: "test-user-id");
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/players");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(0, body!.RootElement.GetArrayLength());
    }
}
