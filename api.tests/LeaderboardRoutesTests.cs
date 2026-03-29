using Api.Data;
using Api.Models;
using Api.Tests.Helpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests;

[Collection("Integration")]
public sealed class LeaderboardRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public LeaderboardRoutesTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        TestAuthHandler.UserId = "test-user-id";
        TestAuthHandler.DisplayName = "Test User";
        TestAuthHandler.IsAuthenticated = true;
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

    private static Game CreateGameWithMole(string? moleContestantId = "contestant-1") =>
        new()
        {
            Id = "game-1",
            Name = "Test Game",
            AdminUserId = "admin-user",
            InviteCode = "INVITE01",
            MoleContestantId = moleContestantId,
            Contestants =
            [
                new Contestant
                {
                    Id = "contestant-1",
                    Name = "Alice",
                    Age = 30,
                    PhotoUrl = "",
                },
                new Contestant
                {
                    Id = "contestant-2",
                    Name = "Bob",
                    Age = 25,
                    PhotoUrl = "",
                },
            ],
            Episodes = [new Episode { Number = 1, Deadline = DateTimeOffset.UtcNow.AddDays(-1) }],
        };

    [Fact]
    public async Task GetLeaderboard_WhenMoleRevealed_ReturnsLeaderboard()
    {
        var game = CreateGameWithMole("contestant-1");
        var player = new Player
        {
            GameId = game.Id,
            UserId = "test-user-id",
            DisplayName = "Test User",
        };
        var ranking = new Ranking
        {
            GameId = game.Id,
            EpisodeNumber = 1,
            UserId = "test-user-id",
            ContestantIds = ["contestant-1", "contestant-2"],
        };
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
            db.Rankings.Add(ranking);
        });
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/leaderboard");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(JsonValueKind.Array, body!.RootElement.ValueKind);
    }

    [Fact]
    public async Task GetLeaderboard_WhenMoleNotRevealed_ReturnsBadRequest()
    {
        var game = CreateGameWithMole(null);
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/leaderboard");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetLeaderboard_WhenGameNotFound_ReturnsNotFound()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.GetAsync("/api/games/nonexistent/leaderboard");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetLeaderboard_WithNoRankings_ReturnsEmptyList()
    {
        var game = CreateGameWithMole("contestant-1");
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/leaderboard");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(0, body!.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task GetWhatIfLeaderboard_WithValidContestant_ReturnsLeaderboard()
    {
        var game = CreateGameWithMole(null);
        var player = new Player
        {
            GameId = game.Id,
            UserId = "test-user-id",
            DisplayName = "Test User",
        };
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = CreateClient();

        var response = await client.GetAsync(
            $"/api/games/{game.Id}/leaderboard/what-if/contestant-1"
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetWhatIfLeaderboard_WithInvalidContestant_ReturnsBadRequest()
    {
        var game = CreateGameWithMole(null);
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.GetAsync(
            $"/api/games/{game.Id}/leaderboard/what-if/nonexistent"
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
