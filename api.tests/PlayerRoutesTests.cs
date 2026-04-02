using Api.Data;
using Api.Models;
using Api.Tests.Helpers;

namespace Api.Tests;

[Collection("Integration")]
public sealed class PlayerRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly TestContext _ctx;

    public PlayerRoutesTests(CustomWebApplicationFactory factory)
    {
        _ctx = new TestContext(factory, roles: ["authenticated"]);
    }

    [Fact]
    public async Task GetPlayers_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/games/game-1/players");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetPlayers_WhenGameNotFound_ReturnsNotFound()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/games/nonexistent/players");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetPlayers_WhenNotPlayerOrAdmin_ReturnsUnauthorized()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/players");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetPlayers_WhenPlayer_ReturnsPlayerList()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
            db.Players.Add(TestData.Player(game.Id, "other-user", "Other User"));
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/players");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(2, body!.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task GetPlayers_WhenAdmin_ReturnsPlayerList()
    {
        var game = TestData.Game();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id, "another-user", "Another User"));
        });
        var client = _ctx.CreateClient();

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
        var game = TestData.Game();
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/players");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(0, body!.RootElement.GetArrayLength());
    }
}
