using Api.Data;
using Api.Models;
using Api.Tests.Helpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests;

[Collection("Integration")]
public sealed class SuspectStatsRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public SuspectStatsRoutesTests(CustomWebApplicationFactory factory)
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

    private static Game CreateGame() =>
        new()
        {
            Id = "game-1",
            Name = "Test Game",
            AdminUserId = "admin-user",
            InviteCode = "INVITE01",
            Contestants =
            [
                new Contestant
                {
                    Id = "c1",
                    Name = "Alice",
                    Age = 30,
                    PhotoUrl = "",
                },
                new Contestant
                {
                    Id = "c2",
                    Name = "Bob",
                    Age = 25,
                    PhotoUrl = "",
                },
            ],
        };

    [Fact]
    public async Task GetSuspectStats_WhenUnauthenticated_ReturnsUnauthorized()
    {
        PrepareDb();
        TestAuthHandler.IsAuthenticated = false;
        try
        {
            var client = CreateClient();
            var response = await client.GetAsync("/api/games/game-1/suspect-stats");
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        finally
        {
            TestAuthHandler.IsAuthenticated = true;
        }
    }

    [Fact]
    public async Task GetSuspectStats_WhenGameNotFound_ReturnsNotFound()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.GetAsync("/api/games/nonexistent/suspect-stats");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetSuspectStats_WhenNotPlayer_ReturnsUnauthorized()
    {
        var game = CreateGame();
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/suspect-stats");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetSuspectStats_WhenNoPassedDeadlineEpisodes_ReturnsEmptyArray()
    {
        var game = CreateGame();
        game.Episodes.Add(new Episode { Number = 1, Deadline = DateTimeOffset.UtcNow.AddDays(1) });
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

        var response = await client.GetAsync($"/api/games/{game.Id}/suspect-stats");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(0, body!.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task GetSuspectStats_WhenEpisodeDeadlinePassed_ReturnsStatsWithCorrectAvgRank()
    {
        var game = CreateGame();
        game.Episodes.Add(new Episode { Number = 1, Deadline = DateTimeOffset.UtcNow.AddDays(-1) });

        var player1 = new Player
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
        // Both players rank Alice (c1) first (most suspect)
        var ranking1 = new Ranking
        {
            GameId = game.Id,
            EpisodeNumber = 1,
            UserId = "test-user-id",
            ContestantIds = ["c1", "c2"],
        };
        var ranking2 = new Ranking
        {
            GameId = game.Id,
            EpisodeNumber = 1,
            UserId = "other-user",
            ContestantIds = ["c1", "c2"],
        };

        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player1);
            db.Players.Add(player2);
            db.Rankings.Add(ranking1);
            db.Rankings.Add(ranking2);
        });
        var client = CreateClient();

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
        var game = CreateGame();
        game.Episodes.Add(new Episode { Number = 1, Deadline = DateTimeOffset.UtcNow.AddDays(-1) });

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
