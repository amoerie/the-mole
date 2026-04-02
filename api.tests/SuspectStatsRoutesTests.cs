using Api.Data;
using Api.Models;
using Api.Tests.Helpers;

namespace Api.Tests;

[Collection("Integration")]
public sealed class SuspectStatsRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly TestContext _ctx;

    public SuspectStatsRoutesTests(CustomWebApplicationFactory factory)
    {
        _ctx = new TestContext(factory, roles: ["authenticated"]);
    }

    [Fact]
    public async Task GetSuspectStats_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/games/game-1/suspect-stats");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetSuspectStats_WhenGameNotFound_ReturnsNotFound()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/games/nonexistent/suspect-stats");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetSuspectStats_WhenNotPlayer_ReturnsUnauthorized()
    {
        var game = TestData.GameWithContestants("admin-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/suspect-stats");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetSuspectStats_WhenNoPassedDeadlineEpisodes_ReturnsEmptyArray()
    {
        var game = TestData.GameWithContestants("admin-user");
        game.Episodes.Add(TestData.Episode());
        var player = TestData.Player();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/suspect-stats");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(0, body!.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task GetSuspectStats_WhenEpisodeDeadlinePassed_ReturnsStatsWithCorrectAvgRank()
    {
        var game = TestData.GameWithContestants("admin-user");
        game.Episodes.Add(TestData.Episode(1, future: false));

        var player1 = TestData.Player();
        var player2 = TestData.Player(displayName: "Other User", userId: "other-user");
        // Both players rank contestant-1 (Alice) first (most suspect)
        var ranking1 = new Ranking
        {
            GameId = game.Id,
            EpisodeNumber = 1,
            UserId = "test-user-id",
            ContestantIds = ["contestant-1", "contestant-2"],
        };
        var ranking2 = new Ranking
        {
            GameId = game.Id,
            EpisodeNumber = 1,
            UserId = "other-user",
            ContestantIds = ["contestant-1", "contestant-2"],
        };

        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player1);
            db.Players.Add(player2);
            db.Rankings.Add(ranking1);
            db.Rankings.Add(ranking2);
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/suspect-stats");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        var episodes = body!.RootElement;
        Assert.Equal(1, episodes.GetArrayLength());

        var stats = episodes[0].GetProperty("stats");
        Assert.Equal(2, stats.GetArrayLength());

        // First stat should be Alice (avgRank=1, most suspect)
        Assert.Equal("Alice", stats[0].GetProperty("name").GetString());
        Assert.Equal(1.0, stats[0].GetProperty("avgRank").GetDouble());
        Assert.Equal(2, stats[0].GetProperty("rankingCount").GetInt32());
    }

    [Fact]
    public async Task GetSuspectStats_WhenNoRankingsForEpisode_ReturnsStatsWithDefaultAvgRank()
    {
        var game = TestData.GameWithContestants("admin-user");
        game.Episodes.Add(TestData.Episode(1, future: false));
        var player = TestData.Player();

        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/suspect-stats");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        var episodes = body!.RootElement;
        Assert.Equal(1, episodes.GetArrayLength());
        var stats = episodes[0].GetProperty("stats");
        // With no rankings, all contestants get default avgRank = active contestant count
        Assert.Equal(0, stats[0].GetProperty("rankingCount").GetInt32());
        Assert.Equal(0, stats[1].GetProperty("rankingCount").GetInt32());
    }
}
