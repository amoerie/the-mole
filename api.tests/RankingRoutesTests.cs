using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Data;
using Api.Models;
using Api.Tests.Helpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests;

[Collection("Integration")]
public sealed class RankingRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private static readonly string[] TwoContestants = ["contestant-1", "contestant-2"];
    private static readonly string[] TwoContestantsReversed = ["contestant-2", "contestant-1"];
    private static readonly string[] OneContestantWithExtra =
    [
        "contestant-1",
        "contestant-2",
        "contestant-unknown",
    ];
    private static readonly string[] OneContestant = ["contestant-1"];

    private readonly CustomWebApplicationFactory _factory;

    public RankingRoutesTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        TestAuthHandler.UserId = "test-user-id";
        TestAuthHandler.DisplayName = "Test User";
        TestAuthHandler.IsAuthenticated = true;
        TestAuthHandler.Roles = ["authenticated", "admin"];
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

    private static (Game game, Player player) CreateGameWithPlayer()
    {
        var game = new Game
        {
            Id = "game-1",
            Name = "Test Game",
            AdminUserId = "admin-user",
            InviteCode = "INVITE01",
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
            Episodes = [new Episode { Number = 1, Deadline = DateTimeOffset.UtcNow.AddDays(7) }],
        };
        var player = new Player
        {
            GameId = game.Id,
            UserId = "test-user-id",
            DisplayName = "Test User",
        };
        return (game, player);
    }

    [Fact]
    public async Task SubmitRanking_BeforeDeadline_ReturnsOk()
    {
        var (game, player) = CreateGameWithPlayer();
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes/1/rankings",
            new { contestantIds = TwoContestants }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SubmitRanking_AfterDeadline_ReturnsBadRequest()
    {
        var game = new Game
        {
            Id = "game-1",
            Name = "Test Game",
            AdminUserId = "admin-user",
            InviteCode = "INVITE01",
            Contestants =
            [
                new Contestant
                {
                    Id = "contestant-1",
                    Name = "Alice",
                    Age = 30,
                    PhotoUrl = "",
                },
            ],
            Episodes = [new Episode { Number = 1, Deadline = DateTimeOffset.UtcNow.AddDays(-1) }],
        };
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

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes/1/rankings",
            new { contestantIds = OneContestant }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SubmitRanking_WhenNotPlayer_ReturnsUnauthorized()
    {
        var (game, _) = CreateGameWithPlayer();
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes/1/rankings",
            new { contestantIds = TwoContestants }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SubmitRanking_UpdatesExistingRanking_ReturnsOk()
    {
        var (game, player) = CreateGameWithPlayer();
        var existingRanking = new Ranking
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
            db.Rankings.Add(existingRanking);
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes/1/rankings",
            new { contestantIds = TwoContestantsReversed }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetMyRanking_WhenExists_ReturnsRanking()
    {
        var (game, player) = CreateGameWithPlayer();
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

        var response = await client.GetAsync($"/api/games/{game.Id}/episodes/1/rankings/mine");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetMyRanking_WhenNotFound_ReturnsNotFound()
    {
        var (game, player) = CreateGameWithPlayer();
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/episodes/1/rankings/mine");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SubmitRanking_WithIncompleteContestants_ReturnsBadRequest()
    {
        var (game, player) = CreateGameWithPlayer();
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes/1/rankings",
            new { contestantIds = OneContestant } // missing contestant-2
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SubmitRanking_WithExtraContestants_ReturnsBadRequest()
    {
        var (game, player) = CreateGameWithPlayer();
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes/1/rankings",
            new { contestantIds = OneContestantWithExtra }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SubmitRanking_ExcludesEliminatedContestants_FromPreviousEpisode()
    {
        var game = new Game
        {
            Id = "game-1",
            Name = "Test Game",
            AdminUserId = "admin-user",
            InviteCode = "INVITE01",
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
                    EliminatedInEpisode = 1,
                },
            ],
            Episodes =
            [
                new Episode
                {
                    Number = 1,
                    Deadline = DateTimeOffset.UtcNow.AddDays(-1),
                    EliminatedContestantIds = ["contestant-2"],
                },
                new Episode { Number = 2, Deadline = DateTimeOffset.UtcNow.AddDays(7) },
            ],
        };
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

        // Episode 2: only contestant-1 is active (contestant-2 was eliminated in episode 1)
        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes/2/rankings",
            new { contestantIds = OneContestant }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetEpisodeRankings_AfterDeadline_ReturnsAllRankings()
    {
        var game = new Game
        {
            Id = "game-1",
            Name = "Test Game",
            AdminUserId = "admin-user",
            InviteCode = "INVITE01",
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

        var response = await client.GetAsync($"/api/games/{game.Id}/episodes/1/rankings");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(1, body!.RootElement.GetArrayLength());
        Assert.Equal("Test User", body.RootElement[0].GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task GetEpisodeRankings_BeforeDeadline_ReturnsBadRequest()
    {
        var (game, player) = CreateGameWithPlayer();
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/episodes/1/rankings");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetEpisodeRankings_WhenNotPlayer_ReturnsUnauthorized()
    {
        var (game, _) = CreateGameWithPlayer();
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/episodes/1/rankings");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
