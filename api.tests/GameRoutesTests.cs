using Api.Data;
using Api.Models;
using Api.Tests.Helpers;

namespace Api.Tests;

[Collection("Integration")]
public sealed class GameRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly TestContext _ctx;

    public GameRoutesTests(CustomWebApplicationFactory factory)
    {
        _ctx = new TestContext(factory);
    }

    [Fact]
    public async Task CreateGame_WhenAuthenticated_ReturnsOkWithGame()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync("/api/games", new { name = "My Game" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal("My Game", body!.RootElement.GetProperty("name").GetString());
    }

    [Fact]
    public async Task CreateGame_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync("/api/games", new { name = "My Game" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateGame_WhenNotAdmin_ReturnsForbidden()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsNonAdmin();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync("/api/games", new { name = "My Game" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CreateGame_WithMissingName_ReturnsBadRequest()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync("/api/games", new { name = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetGame_WhenAdmin_ReturnsOk()
    {
        var game = TestData.Game();
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetGame_WhenPlayer_ReturnsOk()
    {
        var game = TestData.Game("other-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetGame_WhenUnauthenticated_ReturnsUnauthorized()
    {
        var game = TestData.Game();
        _ctx.PrepareDb(db => db.Games.Add(game));
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetGame_WhenNotFound_ReturnsNotFound()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/games/nonexistent-game");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetGame_WhenNotMember_ReturnsUnauthorized()
    {
        var game = TestData.Game("other-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task JoinGame_WithValidInviteCode_ReturnsOk()
    {
        var game = TestData.Game("other-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/join",
            new { inviteCode = "INVITE01" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task JoinGame_WithInvalidInviteCode_ReturnsBadRequest()
    {
        var game = TestData.Game("other-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/join",
            new { inviteCode = "WRONGCODE" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task JoinGame_WhenAlreadyJoined_ReturnsOk()
    {
        var game = TestData.Game("other-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
        });
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/join",
            new { inviteCode = "INVITE01" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Contains(
            "already",
            body!.RootElement.GetProperty("message").GetString(),
            StringComparison.OrdinalIgnoreCase
        );
    }

    [Fact]
    public async Task GetGameByInvite_WhenFound_ReturnsGameSummary()
    {
        var game = TestData.Game();
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/games/by-invite/INVITE01");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal("Test Game", body!.RootElement.GetProperty("name").GetString());
    }

    [Fact]
    public async Task GetGameByInvite_WhenNotFound_ReturnsNotFound()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/games/by-invite/NOTEXIST");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetMyGames_WhenAuthenticated_ReturnsGameList()
    {
        var game = TestData.Game();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/my-games");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(1, body!.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task GetMyGames_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/my-games");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AddContestants_WhenAdmin_ReturnsUpdatedGame()
    {
        var game = TestData.Game();
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/contestants",
            new
            {
                contestants = new[]
                {
                    new
                    {
                        name = "Alice",
                        age = 30,
                        photoUrl = "",
                    },
                },
            }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AddContestants_WhenNotAdmin_ReturnsUnauthorized()
    {
        var game = TestData.Game("other-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/contestants",
            new
            {
                contestants = new[]
                {
                    new
                    {
                        name = "Alice",
                        age = 30,
                        photoUrl = "",
                    },
                },
            }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AddContestants_WithEmptyList_ReturnsBadRequest()
    {
        var game = TestData.Game();
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/contestants",
            new { contestants = Array.Empty<object>() }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteGame_AsAdmin_Returns204()
    {
        var game = TestData.Game();
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.DeleteAsync($"/api/games/{game.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteGame_AsNonAdmin_ReturnsForbidden()
    {
        var game = TestData.Game("other-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.DeleteAsync($"/api/games/{game.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DeleteGame_NotFound_Returns404()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.DeleteAsync("/api/games/nonexistent");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteGame_CascadesPlayersAndRankings()
    {
        var game = TestData.Game();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(
                new Player
                {
                    Id = "player-1",
                    GameId = game.Id,
                    UserId = "test-user-id",
                    DisplayName = "Test User",
                }
            );
            db.Rankings.Add(
                new Ranking
                {
                    Id = "ranking-1",
                    GameId = game.Id,
                    EpisodeNumber = 1,
                    UserId = "test-user-id",
                    ContestantIds = ["c1", "c2"],
                }
            );
        });
        var client = _ctx.CreateClient();

        await client.DeleteAsync($"/api/games/{game.Id}");

        await _ctx.ReadDbAsync(async db =>
        {
            Assert.Null(await db.Games.FindAsync(game.Id));
            Assert.Empty(db.Players.Where(p => p.GameId == game.Id));
            Assert.Empty(db.Rankings.Where(r => r.GameId == game.Id));
            return true;
        });
    }
}
