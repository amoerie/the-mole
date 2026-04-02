using Api.Data;
using Api.Models;
using Api.Tests.Helpers;

namespace Api.Tests;

[Collection("Integration")]
public sealed class MessageRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly TestContext _ctx;

    public MessageRoutesTests(CustomWebApplicationFactory factory)
    {
        _ctx = new TestContext(factory, roles: ["authenticated"]);
    }

    // ── GET ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetMessages_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/games/game-1/messages");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetMessages_WhenGameNotFound_ReturnsNotFound()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/games/nonexistent/messages");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetMessages_WhenNotPlayer_ReturnsUnauthorized()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/messages");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetMessages_WhenNoMessages_ReturnsEmptyList()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/messages");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(0, body!.RootElement.GetProperty("items").GetArrayLength());
        Assert.False(body!.RootElement.GetProperty("hasMore").GetBoolean());
    }

    [Fact]
    public async Task GetMessages_WithMessages_ReturnsOrderedList()
    {
        var game = TestData.Game("admin-user");
        var msg1 = new Message
        {
            GameId = game.Id,
            UserId = "test-user-id",
            DisplayName = "Test User",
            Content = "First",
            PostedAt = DateTimeOffset.UtcNow.AddMinutes(-5),
        };
        var msg2 = new Message
        {
            GameId = game.Id,
            UserId = "test-user-id",
            DisplayName = "Test User",
            Content = "Second",
            PostedAt = DateTimeOffset.UtcNow,
        };
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
            db.Messages.Add(msg1);
            db.Messages.Add(msg2);
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/messages");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        var items = body!.RootElement.GetProperty("items");
        Assert.Equal(2, items.GetArrayLength());
        // Descending order: most recent first
        Assert.Equal("Second", items[0].GetProperty("content").GetString());
        Assert.Equal("First", items[1].GetProperty("content").GetString());
    }

    [Fact]
    public async Task GetMessages_WithMoreThan20Messages_SetsHasMoreTrue()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
            for (var i = 0; i < 21; i++)
            {
                db.Messages.Add(
                    new Message
                    {
                        GameId = game.Id,
                        UserId = "test-user-id",
                        DisplayName = "Test User",
                        Content = $"Message {i}",
                        PostedAt = DateTimeOffset.UtcNow.AddSeconds(i),
                    }
                );
            }
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/messages");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(20, body!.RootElement.GetProperty("items").GetArrayLength());
        Assert.True(body!.RootElement.GetProperty("hasMore").GetBoolean());
    }

    [Fact]
    public async Task GetMessages_WithSkip_ReturnsCorrectPage()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
            for (var i = 0; i < 5; i++)
            {
                db.Messages.Add(
                    new Message
                    {
                        GameId = game.Id,
                        UserId = "test-user-id",
                        DisplayName = "Test User",
                        Content = $"Message {i}",
                        PostedAt = DateTimeOffset.UtcNow.AddSeconds(i),
                    }
                );
            }
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/messages?skip=3");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(2, body!.RootElement.GetProperty("items").GetArrayLength());
        Assert.False(body!.RootElement.GetProperty("hasMore").GetBoolean());
    }

    [Fact]
    public async Task GetMessages_WithNegativeSkip_ClampsToZero()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
            db.Messages.Add(
                new Message
                {
                    GameId = game.Id,
                    UserId = "test-user-id",
                    DisplayName = "Test User",
                    Content = "Hello",
                    PostedAt = DateTimeOffset.UtcNow,
                }
            );
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/messages?skip=-5");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(1, body!.RootElement.GetProperty("items").GetArrayLength());
        Assert.False(body!.RootElement.GetProperty("hasMore").GetBoolean());
    }

    // ── POST ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task PostMessage_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/games/game-1/messages",
            new { content = "Hi" }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PostMessage_WhenGameNotFound_ReturnsNotFound()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/games/nonexistent/messages",
            new { content = "Hi" }
        );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PostMessage_WhenNotPlayer_ReturnsUnauthorized()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/messages",
            new { content = "Hi" }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PostMessage_WithValidContent_ReturnsCreated()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
        });
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/messages",
            new { content = "Ik denk dat het Bob is!" }
        );

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(
            "Ik denk dat het Bob is!",
            body!.RootElement.GetProperty("content").GetString()
        );
        Assert.Equal("test-user-id", body!.RootElement.GetProperty("userId").GetString());
        Assert.Equal("Test User", body!.RootElement.GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task PostMessage_WithWhitespaceOnlyContent_ReturnsBadRequest()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
        });
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/messages",
            new { content = "   " }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostMessage_WithEmptyContent_ReturnsBadRequest()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
        });
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/messages",
            new { content = "" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── GET unread-count ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetUnreadCount_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/games/game-1/messages/unread-count");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetUnreadCount_WhenGameNotFound_ReturnsNotFound()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/games/nonexistent/messages/unread-count");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetUnreadCount_WhenNotPlayer_ReturnsUnauthorized()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/messages/unread-count");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetUnreadCount_WithNoMessages_ReturnsZero()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/messages/unread-count");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.Equal(0, body!.RootElement.GetProperty("count").GetInt32());
    }

    [Fact]
    public async Task GetUnreadCount_WithNoMarkRead_ReturnsAllMessagesAsUnread()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
            db.Messages.Add(
                new Message
                {
                    GameId = game.Id,
                    UserId = "test-user-id",
                    DisplayName = "Test User",
                    Content = "A",
                    PostedAt = DateTimeOffset.UtcNow.AddMinutes(-2),
                }
            );
            db.Messages.Add(
                new Message
                {
                    GameId = game.Id,
                    UserId = "test-user-id",
                    DisplayName = "Test User",
                    Content = "B",
                    PostedAt = DateTimeOffset.UtcNow.AddMinutes(-1),
                }
            );
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/messages/unread-count");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.Equal(2, body!.RootElement.GetProperty("count").GetInt32());
    }

    [Fact]
    public async Task GetUnreadCount_AfterMarkRead_ReturnsZeroForOldMessages()
    {
        var game = TestData.Game("admin-user");
        var lastReadAt = DateTimeOffset.UtcNow;
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
            db.Messages.Add(
                new Message
                {
                    GameId = game.Id,
                    UserId = "other",
                    DisplayName = "Other",
                    Content = "Old",
                    PostedAt = lastReadAt.AddMinutes(-1),
                }
            );
            db.MessageReads.Add(
                new MessageRead
                {
                    UserId = "test-user-id",
                    GameId = game.Id,
                    LastReadAt = lastReadAt,
                }
            );
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/messages/unread-count");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.Equal(0, body!.RootElement.GetProperty("count").GetInt32());
    }

    [Fact]
    public async Task GetUnreadCount_WithNewMessagesAfterLastRead_ReturnsCorrectCount()
    {
        var game = TestData.Game("admin-user");
        var lastReadAt = DateTimeOffset.UtcNow.AddMinutes(-1);
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
            db.Messages.Add(
                new Message
                {
                    GameId = game.Id,
                    UserId = "other",
                    DisplayName = "Other",
                    Content = "Old",
                    PostedAt = lastReadAt.AddMinutes(-1),
                }
            );
            db.Messages.Add(
                new Message
                {
                    GameId = game.Id,
                    UserId = "other",
                    DisplayName = "Other",
                    Content = "New",
                    PostedAt = lastReadAt.AddSeconds(10),
                }
            );
            db.MessageReads.Add(
                new MessageRead
                {
                    UserId = "test-user-id",
                    GameId = game.Id,
                    LastReadAt = lastReadAt,
                }
            );
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/messages/unread-count");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.Equal(1, body!.RootElement.GetProperty("count").GetInt32());
    }

    // ── POST mark-read ────────────────────────────────────────────────────────

    [Fact]
    public async Task MarkMessagesRead_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.PostAsync("/api/games/game-1/messages/mark-read", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task MarkMessagesRead_WhenGameNotFound_ReturnsNotFound()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.PostAsync("/api/games/nonexistent/messages/mark-read", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MarkMessagesRead_WhenNotPlayer_ReturnsUnauthorized()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db => db.Games.Add(game));
        var client = _ctx.CreateClient();

        var response = await client.PostAsync($"/api/games/{game.Id}/messages/mark-read", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task MarkMessagesRead_CreatesNewRecord_ReturnsNoContent()
    {
        var game = TestData.Game("admin-user");
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
        });
        var client = _ctx.CreateClient();

        var response = await client.PostAsync($"/api/games/{game.Id}/messages/mark-read", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var record = await _ctx.ReadDbAsync(db =>
            db.MessageReads.FindAsync("test-user-id", game.Id).AsTask()
        );
        Assert.NotNull(record);
        Assert.True(record!.LastReadAt > DateTimeOffset.UtcNow.AddSeconds(-5));
    }

    [Fact]
    public async Task MarkMessagesRead_UpdatesExistingRecord()
    {
        var game = TestData.Game("admin-user");
        var oldTime = DateTimeOffset.UtcNow.AddHours(-1);
        _ctx.PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(TestData.Player(game.Id));
            db.MessageReads.Add(
                new MessageRead
                {
                    UserId = "test-user-id",
                    GameId = game.Id,
                    LastReadAt = oldTime,
                }
            );
        });
        var client = _ctx.CreateClient();

        var response = await client.PostAsync($"/api/games/{game.Id}/messages/mark-read", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var record = await _ctx.ReadDbAsync(db =>
            db.MessageReads.FindAsync("test-user-id", game.Id).AsTask()
        );
        Assert.True(record!.LastReadAt > oldTime);
    }
}
