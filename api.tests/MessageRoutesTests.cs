using Api.Data;
using Api.Models;
using Api.Tests.Helpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests;

[Collection("Integration")]
public sealed class MessageRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public MessageRoutesTests(CustomWebApplicationFactory factory)
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
        };

    private static Player CreatePlayer(
        string userId = "test-user-id",
        string displayName = "Test User"
    ) =>
        new()
        {
            GameId = "game-1",
            UserId = userId,
            DisplayName = displayName,
        };

    // ── GET ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetMessages_WhenUnauthenticated_ReturnsUnauthorized()
    {
        PrepareDb();
        TestAuthHandler.IsAuthenticated = false;
        try
        {
            var client = CreateClient();
            var response = await client.GetAsync("/api/games/game-1/messages");
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        finally
        {
            TestAuthHandler.IsAuthenticated = true;
        }
    }

    [Fact]
    public async Task GetMessages_WhenGameNotFound_ReturnsNotFound()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.GetAsync("/api/games/nonexistent/messages");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetMessages_WhenNotPlayer_ReturnsUnauthorized()
    {
        var game = CreateGame();
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.GetAsync($"/api/games/{game.Id}/messages");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetMessages_WhenNoMessages_ReturnsEmptyList()
    {
        var game = CreateGame();
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(CreatePlayer());
        });
        var client = CreateClient();

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
        var game = CreateGame();
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
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(CreatePlayer());
            db.Messages.Add(msg1);
            db.Messages.Add(msg2);
        });
        var client = CreateClient();

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
        var game = CreateGame();
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(CreatePlayer());
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
        var client = CreateClient();

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
        var game = CreateGame();
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(CreatePlayer());
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
        var client = CreateClient();

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
        var game = CreateGame();
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(CreatePlayer());
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
        var client = CreateClient();

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
        PrepareDb();
        TestAuthHandler.IsAuthenticated = false;
        try
        {
            var client = CreateClient();
            var response = await client.PostAsJsonAsync(
                "/api/games/game-1/messages",
                new { content = "Hi" }
            );
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        finally
        {
            TestAuthHandler.IsAuthenticated = true;
        }
    }

    [Fact]
    public async Task PostMessage_WhenGameNotFound_ReturnsNotFound()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/games/nonexistent/messages",
            new { content = "Hi" }
        );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PostMessage_WhenNotPlayer_ReturnsUnauthorized()
    {
        var game = CreateGame();
        PrepareDb(db => db.Games.Add(game));
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/messages",
            new { content = "Hi" }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PostMessage_WithValidContent_ReturnsCreated()
    {
        var game = CreateGame();
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(CreatePlayer());
        });
        var client = CreateClient();

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
        var game = CreateGame();
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(CreatePlayer());
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/messages",
            new { content = "   " }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostMessage_WithEmptyContent_ReturnsBadRequest()
    {
        var game = CreateGame();
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(CreatePlayer());
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/messages",
            new { content = "" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostMessage_WithContentTooLong_ReturnsBadRequest()
    {
        var game = CreateGame();
        PrepareDb(db =>
        {
            db.Games.Add(game);
            db.Players.Add(CreatePlayer());
        });
        var client = CreateClient();
        var tooLong = new string('x', 501);

        var response = await client.PostAsJsonAsync(
            $"/api/games/{game.Id}/messages",
            new { content = tooLong }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
