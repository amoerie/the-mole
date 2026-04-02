using Api.Data;
using Api.Models;
using Api.Tests.Helpers;

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

    private readonly TestContext _ctx;

    public RankingRoutesTests(CustomWebApplicationFactory factory)
    {
        _ctx = new TestContext(factory);
    }

    [Fact]
    public async Task SubmitRanking_BeforeDeadline_ReturnsOk()
    {
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

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
            Episodes = [TestData.Episode(1, future: false)],
        };
        var player = TestData.Player();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes/1/rankings",
            new { contestantIds = OneContestant }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SubmitRanking_WhenNotPlayer_ReturnsUnauthorized()
    {
        var (game, _) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes/1/rankings",
            new { contestantIds = TwoContestants }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SubmitRanking_UpdatesExistingRanking_ReturnsOk()
    {
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
            db.Rankings.Add(
                new Ranking
                {
                    GameId = game.Id,
                    EpisodeNumber = 1,
                    UserId = "test-user-id",
                    ContestantIds = ["contestant-1", "contestant-2"],
                }
            );
        });
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes/1/rankings",
            new { contestantIds = TwoContestantsReversed }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetMyRanking_WhenExists_ReturnsRanking()
    {
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
            db.Rankings.Add(
                new Ranking
                {
                    GameId = game.Id,
                    EpisodeNumber = 1,
                    UserId = "test-user-id",
                    ContestantIds = ["contestant-1", "contestant-2"],
                }
            );
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/episodes/1/rankings/mine");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetMyRanking_WhenNotFound_ReturnsNotFound()
    {
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/episodes/1/rankings/mine");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SubmitRanking_WithIncompleteContestants_ReturnsBadRequest()
    {
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes/1/rankings",
            new { contestantIds = OneContestant } // missing contestant-2
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SubmitRanking_WithExtraContestants_ReturnsBadRequest()
    {
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

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
        var player = TestData.Player();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

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
        var game = TestData.GameWithContestants("admin-user");
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
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/episodes/1/rankings");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetEpisodeRankings_WhenNotPlayer_ReturnsUnauthorized()
    {
        var (game, _) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/episodes/1/rankings");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
