using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Data;
using Api.Models;
using Api.Tests.Helpers;
using Microsoft.EntityFrameworkCore;

namespace Api.Tests;

[Collection("Integration")]
public sealed class NotebookRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly TestContext _ctx;

    public NotebookRoutesTests(CustomWebApplicationFactory factory)
    {
        _ctx = new TestContext(factory, roles: ["authenticated"]);
    }

    // ── GET ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetNotebook_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/games/game-1/molboekje");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetNotebook_WhenNotPlayer_ReturnsUnauthorized()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/molboekje");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetNotebook_NewPlayer_ReturnsEmptyNotebook()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/molboekje");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.True(body!.RootElement.GetProperty("notebookColor").ValueKind == JsonValueKind.Null);
        Assert.Equal(0, body!.RootElement.GetProperty("notes").GetArrayLength());
    }

    // ── PUT notes ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task SaveNote_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.PutAsJsonAsync(
            "/api/games/game-1/molboekje/notes/1",
            new { content = "test", suspicionLevels = new { } }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SaveNote_WhenNotPlayer_ReturnsUnauthorized()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/api/games/{game.Id}/molboekje/notes/1",
            new { content = "test", suspicionLevels = new { } }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SaveNote_WhenEpisodeNotFound_Returns422()
    {
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/api/games/{game.Id}/molboekje/notes/99",
            new { content = "test", suspicionLevels = new { } }
        );

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task SaveNote_WhenContentTooLong_Returns422()
    {
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/api/games/{game.Id}/molboekje/notes/1",
            new { content = new string('x', 5001), suspicionLevels = new { } }
        );

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task SaveNote_WithInvalidContestantId_Returns422()
    {
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/api/games/{game.Id}/molboekje/notes/1",
            new
            {
                content = "test",
                suspicionLevels = new Dictionary<string, int> { { "nonexistent-id", 3 } },
            }
        );

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task SaveNote_WithOutOfRangeSuspicionLevel_Returns422()
    {
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/api/games/{game.Id}/molboekje/notes/1",
            new
            {
                content = "test",
                suspicionLevels = new Dictionary<string, int> { { "contestant-1", 6 } },
            }
        );

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task SaveNote_ValidNote_CreatesAndReturns204()
    {
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/api/games/{game.Id}/molboekje/notes/1",
            new
            {
                content = "Alice was acting suspicious during challenge 1.",
                suspicionLevels = new Dictionary<string, int> { { "contestant-1", 4 } },
            }
        );

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var saved = await _ctx.ReadDbAsync(async db =>
            await db.NotebookNotes.FirstOrDefaultAsync(n =>
                n.GameId == game.Id && n.UserId == "test-user-id" && n.EpisodeNumber == 1
            )
        );
        Assert.NotNull(saved);
        Assert.Equal("Alice was acting suspicious during challenge 1.", saved.Content);
        Assert.Equal(4, saved.SuspicionLevels["contestant-1"]);
    }

    [Fact]
    public async Task SaveNote_CalledTwice_UpsertsBothTimes()
    {
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

        await client.PutAsJsonAsync(
            $"/api/games/{game.Id}/molboekje/notes/1",
            new
            {
                content = "First write.",
                suspicionLevels = new Dictionary<string, int> { { "contestant-1", 2 } },
            }
        );

        var response = await client.PutAsJsonAsync(
            $"/api/games/{game.Id}/molboekje/notes/1",
            new
            {
                content = "Second write.",
                suspicionLevels = new Dictionary<string, int> { { "contestant-1", 5 } },
            }
        );

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var count = await _ctx.ReadDbAsync(async db =>
            await db.NotebookNotes.CountAsync(n => n.GameId == game.Id && n.EpisodeNumber == 1)
        );
        Assert.Equal(1, count);

        var saved = await _ctx.ReadDbAsync(async db =>
            await db.NotebookNotes.FirstAsync(n => n.GameId == game.Id && n.EpisodeNumber == 1)
        );
        Assert.Equal("Second write.", saved.Content);
        Assert.Equal(5, saved.SuspicionLevels["contestant-1"]);
    }

    [Fact]
    public async Task SaveNote_WithEmptySuspicionLevels_ClearsLevels()
    {
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
            db.NotebookNotes.Add(
                new NotebookNote
                {
                    GameId = game.Id,
                    UserId = "test-user-id",
                    EpisodeNumber = 1,
                    Content = "old",
                    SuspicionLevels = new Dictionary<string, int> { { "contestant-1", 3 } },
                }
            );
        });
        var client = _ctx.CreateClient();

        await client.PutAsJsonAsync(
            $"/api/games/{game.Id}/molboekje/notes/1",
            new { content = "updated", suspicionLevels = new Dictionary<string, int>() }
        );

        var saved = await _ctx.ReadDbAsync(async db =>
            await db.NotebookNotes.FirstAsync(n => n.GameId == game.Id && n.EpisodeNumber == 1)
        );
        Assert.Empty(saved.SuspicionLevels);
    }

    [Fact]
    public async Task GetNotebook_AfterSave_ReturnsSavedNote()
    {
        var (game, player) = TestData.GameWithPlayer();
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(player);
        });
        var client = _ctx.CreateClient();

        await client.PutAsJsonAsync(
            $"/api/games/{game.Id}/molboekje/notes/1",
            new
            {
                content = "Very suspicious.",
                suspicionLevels = new Dictionary<string, int> { { "contestant-2", 5 } },
            }
        );

        var getResponse = await client.GetAsync($"/api/games/{game.Id}/molboekje");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var body = await getResponse.Content.ReadFromJsonAsync<JsonDocument>();
        var notes = body!.RootElement.GetProperty("notes");
        Assert.Equal(1, notes.GetArrayLength());
        var note = notes[0];
        Assert.Equal(1, note.GetProperty("episodeNumber").GetInt32());
        Assert.Equal("Very suspicious.", note.GetProperty("content").GetString());
        Assert.Equal(5, note.GetProperty("suspicionLevels").GetProperty("contestant-2").GetInt32());
    }

    // ── PATCH color ───────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateNotebookColor_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.PatchAsJsonAsync(
            "/api/games/game-1/molboekje/color",
            new { color = "blue" }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdateNotebookColor_WithInvalidColor_Returns422()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
        });
        var client = _ctx.CreateClient();

        var response = await client.PatchAsJsonAsync(
            $"/api/games/{game.Id}/molboekje/color",
            new { color = "neon-chartreuse" }
        );

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
    }

    [Fact]
    public async Task UpdateNotebookColor_ValidColor_PersistsAndReturns204()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
        });
        var client = _ctx.CreateClient();

        var response = await client.PatchAsJsonAsync(
            $"/api/games/{game.Id}/molboekje/color",
            new { color = "teal" }
        );

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var getResponse = await client.GetAsync($"/api/games/{game.Id}/molboekje");
        var body = await getResponse.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.Equal("teal", body!.RootElement.GetProperty("notebookColor").GetString());
    }
}
