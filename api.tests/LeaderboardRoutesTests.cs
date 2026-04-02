using Api.Data;
using Api.Models;
using Api.Tests.Helpers;

namespace Api.Tests;

[Collection("Integration")]
public sealed class LeaderboardRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly TestContext _ctx;

    public LeaderboardRoutesTests(CustomWebApplicationFactory factory)
    {
        _ctx = new TestContext(factory);
    }

    [Fact]
    public async Task GetLeaderboard_WhenMoleRevealed_ReturnsLeaderboard()
    {
        var game = TestData.GameWithContestants("admin-user");
        game.MoleContestantId = "contestant-1";
        game.Episodes.Add(TestData.Episode(1, future: false));
        var player = TestData.Player();
        var ranking = new Ranking
        {
            GameId = game.Id,
            EpisodeNumber = 1,
            UserId = "test-user-id",
            ContestantIds = ["contestant-1", "contestant-2"],
        };
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
            db.Rankings.Add(ranking);
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/leaderboard");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(JsonValueKind.Array, body!.RootElement.ValueKind);
    }

    [Fact]
    public async Task GetLeaderboard_WhenMoleNotRevealed_ReturnsBadRequest()
    {
        var game = TestData.GameWithContestants("admin-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/leaderboard");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetLeaderboard_WhenGameNotFound_ReturnsNotFound()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/games/nonexistent/leaderboard");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetLeaderboard_WithNoRankings_ReturnsEmptyList()
    {
        var game = TestData.GameWithContestants("admin-user");
        game.MoleContestantId = "contestant-1";
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/leaderboard");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(0, body!.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task GetWhatIfLeaderboard_WithValidContestant_ReturnsLeaderboard()
    {
        var game = TestData.GameWithContestants("admin-user");
        var player = TestData.Player();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync(
            $"/api/games/{game.Id}/leaderboard/what-if/contestant-1"
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetWhatIfLeaderboard_WithInvalidContestant_ReturnsBadRequest()
    {
        var game = TestData.GameWithContestants("admin-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.GetAsync(
            $"/api/games/{game.Id}/leaderboard/what-if/nonexistent"
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
