using Api.Data;
using Api.Models;
using Api.Tests.Helpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests;

[Collection("Integration")]
public sealed class EpisodeRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public EpisodeRoutesTests(CustomWebApplicationFactory factory)
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

    private static Game CreateGameWithContestants(string adminUserId = "test-user-id") =>
        new()
        {
            Id = "game-1",
            Name = "Test Game",
            AdminUserId = adminUserId,
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
        };

    [Fact]
    public async Task CreateEpisode_WhenAdmin_ReturnsEpisode()
    {
        var game = CreateGameWithContestants();
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes",
            new
            {
                deadline = DateTimeOffset.UtcNow.AddDays(7),
                eliminatedContestantIds = (List<string>?)null,
            }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(1, body!.RootElement.GetProperty("number").GetInt32());
    }

    [Fact]
    public async Task CreateEpisode_WhenNotAdmin_ReturnsUnauthorized()
    {
        var game = CreateGameWithContestants(adminUserId: "other-user");
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes",
            new
            {
                deadline = DateTimeOffset.UtcNow.AddDays(7),
                eliminatedContestantIds = (List<string>?)null,
            }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateEpisode_WhenGameNotFound_ReturnsNotFound()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/games/nonexistent/episodes",
            new
            {
                deadline = DateTimeOffset.UtcNow.AddDays(7),
                eliminatedContestantIds = (List<string>?)null,
            }
        );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateEpisode_WithEliminatedContestant_SetsEpisodeNumber()
    {
        var game = CreateGameWithContestants();
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes",
            new
            {
                deadline = DateTimeOffset.UtcNow.AddDays(7),
                eliminatedContestantIds = new List<string> { "contestant-1" },
            }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task UpdateEpisode_WhenAdmin_ReturnsUpdatedEpisode()
    {
        var game = CreateGameWithContestants();
        game.Episodes.Add(new Episode { Number = 1, Deadline = DateTimeOffset.UtcNow.AddDays(1) });
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var newDeadline = DateTimeOffset.UtcNow.AddDays(14);
        var response = await client.PutAsJsonAsync(
            $"/api/games/{game.Id}/episodes/1",
            new { deadline = newDeadline, eliminatedContestantIds = (List<string>?)null }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task UpdateEpisode_WhenEpisodeNotFound_ReturnsNotFound()
    {
        var game = CreateGameWithContestants();
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/api/games/{game.Id}/episodes/99",
            new
            {
                deadline = DateTimeOffset.UtcNow.AddDays(7),
                eliminatedContestantIds = (List<string>?)null,
            }
        );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateEpisode_WhenNotAdmin_ReturnsUnauthorized()
    {
        var game = CreateGameWithContestants(adminUserId: "other-user");
        game.Episodes.Add(new Episode { Number = 1, Deadline = DateTimeOffset.UtcNow.AddDays(1) });
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/api/games/{game.Id}/episodes/1",
            new
            {
                deadline = DateTimeOffset.UtcNow.AddDays(14),
                eliminatedContestantIds = (List<string>?)null,
            }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RevealMole_WhenAdmin_ReturnsOk()
    {
        var game = CreateGameWithContestants();
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/reveal-mole",
            new { moleContestantId = "contestant-1" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal("contestant-1", body!.RootElement.GetProperty("moleContestantId").GetString());
    }

    [Fact]
    public async Task RevealMole_WhenContestantNotFound_ReturnsBadRequest()
    {
        var game = CreateGameWithContestants();
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/reveal-mole",
            new { moleContestantId = "nonexistent-contestant" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task RevealMole_WhenNotAdmin_ReturnsUnauthorized()
    {
        var game = CreateGameWithContestants(adminUserId: "other-user");
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/reveal-mole",
            new { moleContestantId = "contestant-1" }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DeleteEpisode_WhenAdmin_ReturnsNoContent()
    {
        var game = CreateGameWithContestants();
        game.Episodes.Add(new Episode { Number = 1, Deadline = DateTimeOffset.UtcNow.AddDays(7) });
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.DeleteAsync($"/api/games/{game.Id}/episodes/1");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteEpisode_WhenNotAdmin_ReturnsUnauthorized()
    {
        var game = CreateGameWithContestants(adminUserId: "other-user");
        game.Episodes.Add(new Episode { Number = 1, Deadline = DateTimeOffset.UtcNow.AddDays(7) });
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.DeleteAsync($"/api/games/{game.Id}/episodes/1");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DeleteEpisode_WhenEpisodeNotFound_ReturnsNotFound()
    {
        var game = CreateGameWithContestants();
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.DeleteAsync($"/api/games/{game.Id}/episodes/99");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteEpisode_WithEliminatedContestant_ClearsEliminatedInEpisode()
    {
        var game = CreateGameWithContestants();
        game.Contestants[0].EliminatedInEpisode = 1;
        game.Episodes.Add(
            new Episode
            {
                Number = 1,
                Deadline = DateTimeOffset.UtcNow.AddDays(7),
                EliminatedContestantIds = ["contestant-1"],
            }
        );
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.DeleteAsync($"/api/games/{game.Id}/episodes/1");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var updated = await db.Games.FindAsync(game.Id);
        Assert.Null(updated!.Contestants[0].EliminatedInEpisode);
    }

    [Fact]
    public async Task DeleteEpisode_DeletesAssociatedRankings()
    {
        var game = CreateGameWithContestants();
        game.Episodes.Add(new Episode { Number = 1, Deadline = DateTimeOffset.UtcNow.AddDays(7) });
        PrepareDb(db =>
        {
            db.Games.Add(game);
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
        var client = CreateClient();

        var response = await client.DeleteAsync($"/api/games/{game.Id}/episodes/1");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(db.Rankings.Where(r => r.GameId == game.Id && r.EpisodeNumber == 1));
    }

    [Fact]
    public async Task CreateEpisode_CopiesRankingsFromPreviousEpisode()
    {
        var game = CreateGameWithContestants();
        game.Episodes.Add(new Episode { Number = 1, Deadline = DateTimeOffset.UtcNow.AddDays(-1) });
        PrepareDb(db =>
        {
            db.Games.Add(game);
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
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes",
            new
            {
                deadline = DateTimeOffset.UtcNow.AddDays(7),
                eliminatedContestantIds = (List<string>?)null,
            }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var copied = await db.Rankings.FirstOrDefaultAsync(r =>
            r.GameId == game.Id && r.EpisodeNumber == 2 && r.UserId == "test-user-id"
        );
        Assert.NotNull(copied);
        Assert.Equal(["contestant-1", "contestant-2"], copied!.ContestantIds);
    }

    [Fact]
    public async Task CreateEpisode_CopiedRankingExcludesEliminatedContestant()
    {
        var game = CreateGameWithContestants();
        game.Episodes.Add(new Episode { Number = 1, Deadline = DateTimeOffset.UtcNow.AddDays(-1) });
        PrepareDb(db =>
        {
            db.Games.Add(game);
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
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes",
            new
            {
                deadline = DateTimeOffset.UtcNow.AddDays(7),
                eliminatedContestantIds = new List<string> { "contestant-1" },
            }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var copied = await db.Rankings.FirstOrDefaultAsync(r =>
            r.GameId == game.Id && r.EpisodeNumber == 2 && r.UserId == "test-user-id"
        );
        Assert.NotNull(copied);
        Assert.Equal(["contestant-2"], copied!.ContestantIds);
    }

    [Fact]
    public async Task CreateEpisode_WithMultipleEliminations_SetsAllContestantsEliminated()
    {
        var game = CreateGameWithContestants();
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/episodes",
            new
            {
                deadline = DateTimeOffset.UtcNow.AddDays(7),
                eliminatedContestantIds = new List<string> { "contestant-1", "contestant-2" },
            }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var updated = await db.Games.FindAsync(game.Id);
        Assert.Equal(
            1,
            updated!.Contestants.First(c => c.Id == "contestant-1").EliminatedInEpisode
        );
        Assert.Equal(
            1,
            updated!.Contestants.First(c => c.Id == "contestant-2").EliminatedInEpisode
        );
    }
}
