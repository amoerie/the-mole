using Api.Data;
using Api.Models;
using Api.Tests.Helpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests;

[Collection("Integration")]
public sealed class GameRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public GameRoutesTests(CustomWebApplicationFactory factory)
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

    private static Game CreateGame(
        string adminUserId = "test-user-id",
        string name = "Test Game",
        string? inviteCode = null
    ) =>
        new()
        {
            Id = "game-1",
            Name = name,
            AdminUserId = adminUserId,
            InviteCode = inviteCode ?? "INVITE01",
        };

    [Fact]
    public async Task CreateGame_WhenAuthenticated_ReturnsOkWithGame()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync("/api/games", new { name = "My Game" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal("My Game", body!.RootElement.GetProperty("name").GetString());
    }

    [Fact]
    public async Task CreateGame_WhenUnauthenticated_ReturnsUnauthorized()
    {
        PrepareDb();
        TestAuthHandler.IsAuthenticated = false;
        try
        {
            var client = CreateClient();

            var response = await client.PostAsJsonAsync("/api/games", new { name = "My Game" });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        finally
        {
            TestAuthHandler.IsAuthenticated = true;
        }
    }

    [Fact]
    public async Task CreateGame_WhenNotAdmin_ReturnsForbidden()
    {
        PrepareDb();
        TestAuthHandler.Roles = ["authenticated"];
        try
        {
            var client = CreateClient();

            var response = await client.PostAsJsonAsync("/api/games", new { name = "My Game" });

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
        finally
        {
            TestAuthHandler.Roles = ["authenticated", "admin"];
        }
    }

    [Fact]
    public async Task CreateGame_WithMissingName_ReturnsBadRequest()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync("/api/games", new { name = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetGame_WhenAdmin_ReturnsOk()
    {
        var game = CreateGame(adminUserId: "test-user-id");
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetGame_WhenPlayer_ReturnsOk()
    {
        var game = CreateGame(adminUserId: "other-user");
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(
                new Player
                {
                    GameId = game.Id,
                    UserId = "test-user-id",
                    DisplayName = "Test User",
                }
            );
        });
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetGame_WhenUnauthenticated_ReturnsUnauthorized()
    {
        var game = CreateGame();
        PrepareDb(db => db.Games.Add(game));
        TestAuthHandler.IsAuthenticated = false;
        try
        {
            var client = CreateClient();

            var response = await client.GetAsync($"/api/games/{game.Id}");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        finally
        {
            TestAuthHandler.IsAuthenticated = true;
        }
    }

    [Fact]
    public async Task GetGame_WhenNotFound_ReturnsNotFound()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.GetAsync("/api/games/nonexistent-game");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetGame_WhenNotMember_ReturnsUnauthorized()
    {
        var game = CreateGame(adminUserId: "other-user");
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task JoinGame_WithValidInviteCode_ReturnsOk()
    {
        var game = CreateGame(adminUserId: "other-user", inviteCode: "ABCD1234");
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/join",
            new { inviteCode = "ABCD1234" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task JoinGame_WithInvalidInviteCode_ReturnsBadRequest()
    {
        var game = CreateGame(adminUserId: "other-user", inviteCode: "ABCD1234");
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/join",
            new { inviteCode = "WRONGCODE" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task JoinGame_WhenAlreadyJoined_ReturnsOk()
    {
        var game = CreateGame(adminUserId: "other-user", inviteCode: "ABCD1234");
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(
                new Player
                {
                    GameId = game.Id,
                    UserId = "test-user-id",
                    DisplayName = "Test User",
                }
            );
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/join",
            new { inviteCode = "ABCD1234" }
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
        var game = CreateGame(inviteCode: "ABCD1234");
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.GetAsync("/api/games/by-invite/ABCD1234");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal("Test Game", body!.RootElement.GetProperty("name").GetString());
    }

    [Fact]
    public async Task GetGameByInvite_WhenNotFound_ReturnsNotFound()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.GetAsync("/api/games/by-invite/NOTEXIST");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetMyGames_WhenAuthenticated_ReturnsGameList()
    {
        var game = CreateGame();
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(
                new Player
                {
                    GameId = game.Id,
                    UserId = "test-user-id",
                    DisplayName = "Test User",
                }
            );
        });
        var client = CreateClient();

        var response = await client.GetAsync("/api/my-games");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(1, body!.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task GetMyGames_WhenUnauthenticated_ReturnsUnauthorized()
    {
        PrepareDb();
        TestAuthHandler.IsAuthenticated = false;
        try
        {
            var client = CreateClient();

            var response = await client.GetAsync("/api/my-games");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        finally
        {
            TestAuthHandler.IsAuthenticated = true;
        }
    }

    [Fact]
    public async Task AddContestants_WhenAdmin_ReturnsUpdatedGame()
    {
        var game = CreateGame(adminUserId: "test-user-id");
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

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
        var game = CreateGame(adminUserId: "other-user");
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

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
        var game = CreateGame(adminUserId: "test-user-id");
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/contestants",
            new { contestants = Array.Empty<object>() }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteGame_AsAdmin_Returns204()
    {
        var game = CreateGame(adminUserId: "test-user-id");
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.DeleteAsync($"/api/games/{game.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteGame_AsNonAdmin_ReturnsForbidden()
    {
        var game = CreateGame(adminUserId: "other-user");
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.DeleteAsync($"/api/games/{game.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task DeleteGame_NotFound_Returns404()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.DeleteAsync("/api/games/nonexistent");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteGame_CascadesPlayersAndRankings()
    {
        var game = CreateGame(adminUserId: "test-user-id");
        PrepareDb(db =>
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
        var client = CreateClient();

        await client.DeleteAsync($"/api/games/{game.Id}");

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Null(await db.Games.FindAsync(game.Id));
        Assert.Empty(db.Players.Where(p => p.GameId == game.Id));
        Assert.Empty(db.Rankings.Where(r => r.GameId == game.Id));
    }
}
