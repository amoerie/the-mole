using System.Net.Http.Json;
using System.Text.Json;
using Api.Models;
using Api.Tests.Helpers;
using EmailType = Api.Models.EmailType;

namespace Api.Tests;

[Collection("Integration")]
public sealed class AdminEmailRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly TestContext _ctx;

    public AdminEmailRoutesTests(CustomWebApplicationFactory factory)
    {
        _ctx = new TestContext(factory, userId: "admin-user-id", displayName: "Admin User");
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private void SeedEmailLog(
        string id = "log-1",
        string toEmail = "alice@test.com",
        string toName = "Alice",
        string subject = "Test Subject",
        string htmlBody = "<p>Hello</p>",
        string textBody = "Hello",
        EmailType type = EmailType.RankingReminder,
        bool success = true,
        string? errorMessage = null
    )
    {
        _ctx.PrepareDb(db =>
            db.EmailLogs.Add(
                new EmailLog
                {
                    Id = id,
                    SentAt = DateTimeOffset.UtcNow,
                    ToEmail = toEmail,
                    ToName = toName,
                    Subject = subject,
                    HtmlBody = htmlBody,
                    TextBody = textBody,
                    Type = type,
                    Success = success,
                    ErrorMessage = errorMessage,
                }
            )
        );
    }

    private static void SeedUserWithGame(Api.Data.AppDbContext db, string userId = "user-1")
    {
        db.AppUsers.Add(
            new AppUser
            {
                Id = userId,
                Email = $"{userId}@test.com",
                DisplayName = "Alice",
                PasswordHash = "hash",
            }
        );
        db.Games.Add(
            new Game
            {
                Id = "game-1",
                Name = "Test Game",
                AdminUserId = "admin",
                InviteCode = "CODE0001",
                Contestants =
                [
                    new Contestant
                    {
                        Id = "c1",
                        Name = "Alice",
                        Age = 30,
                        PhotoUrl = "",
                    },
                ],
                Episodes =
                [
                    new Episode { Number = 1, Deadline = DateTimeOffset.UtcNow.AddDays(7) },
                ],
            }
        );
        db.Players.Add(
            new Player
            {
                Id = "p1",
                GameId = "game-1",
                UserId = userId,
                DisplayName = "Alice",
                JoinedAt = DateTimeOffset.UtcNow,
            }
        );
        db.Rankings.Add(
            new Ranking
            {
                Id = "r1",
                GameId = "game-1",
                UserId = userId,
                EpisodeNumber = 1,
                ContestantIds = ["c1"],
                SubmittedAt = DateTimeOffset.UtcNow,
            }
        );
    }

    // ── GET /api/admin/emails ────────────────────────────────────────────────

    [Fact]
    public async Task ListEmailLogs_WhenAdmin_ReturnsOk()
    {
        SeedEmailLog();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/emails");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ListEmailLogs_ReturnsPaginatedResponse()
    {
        SeedEmailLog();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/emails");
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();

        Assert.NotNull(body);
        var root = body!.RootElement;
        Assert.Equal(1, root.GetProperty("total").GetInt32());
        Assert.Equal(1, root.GetProperty("page").GetInt32());
        Assert.Equal(1, root.GetProperty("items").GetArrayLength());
    }

    [Fact]
    public async Task ListEmailLogs_ItemsDoNotIncludeHtmlBody()
    {
        SeedEmailLog();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/emails");
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();

        var item = body!.RootElement.GetProperty("items")[0];
        Assert.False(item.TryGetProperty("htmlBody", out _));
    }

    [Fact]
    public async Task ListEmailLogs_ItemIncludesEmailFields()
    {
        SeedEmailLog(toEmail: "bob@test.com", subject: "My Subject", success: false);
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/emails");
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();

        var item = body!.RootElement.GetProperty("items")[0];
        Assert.Equal("bob@test.com", item.GetProperty("toEmail").GetString());
        Assert.Equal("My Subject", item.GetProperty("subject").GetString());
        Assert.False(item.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task ListEmailLogs_WhenNotAdmin_ReturnsForbidden()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsNonAdmin();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/emails");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ListEmailLogs_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/emails");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ── GET /api/admin/emails/{id} ───────────────────────────────────────────

    [Fact]
    public async Task GetEmailLog_WhenAdmin_ReturnsFullEntry()
    {
        SeedEmailLog(htmlBody: "<p>Full HTML</p>");
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/emails/log-1");
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("<p>Full HTML</p>", body!.RootElement.GetProperty("htmlBody").GetString());
    }

    [Fact]
    public async Task GetEmailLog_WhenNotFound_ReturnsNotFound()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/emails/nonexistent");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetEmailLog_WhenNotAdmin_ReturnsForbidden()
    {
        SeedEmailLog();
        using var _ = _ctx.AsNonAdmin();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/emails/log-1");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ── POST /api/admin/emails/{id}/retry ────────────────────────────────────

    [Fact]
    public async Task RetryEmailLog_WhenAdmin_CallsEmailServiceRetry()
    {
        SeedEmailLog(id: "log-1", toEmail: "alice@test.com");
        var client = _ctx.CreateClient();

        var response = await client.PostAsync("/api/admin/emails/log-1/retry", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Single(_ctx.EmailService.Retried);
        Assert.Equal("alice@test.com", _ctx.EmailService.Retried[0].ToEmail);
    }

    [Fact]
    public async Task RetryEmailLog_WhenNotFound_ReturnsNotFound()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.PostAsync("/api/admin/emails/nonexistent/retry", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task RetryEmailLog_WhenNotAdmin_ReturnsForbidden()
    {
        SeedEmailLog();
        using var _ = _ctx.AsNonAdmin();
        var client = _ctx.CreateClient();

        var response = await client.PostAsync("/api/admin/emails/log-1/retry", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ── POST /api/admin/emails/send-reminder ─────────────────────────────────

    [Fact]
    public async Task SendReminder_WhenUserHasOpenGame_SendsEmailAndReturnsOk()
    {
        _ctx.PrepareDb(db => SeedUserWithGame(db));
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/admin/emails/send-reminder",
            new { userId = "user-1" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Single(_ctx.EmailService.SentReminders);
    }

    [Fact]
    public async Task SendReminder_WhenUserNotFound_ReturnsNotFound()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/admin/emails/send-reminder",
            new { userId = "nonexistent" }
        );

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SendReminder_WhenNoOpenGames_ReturnsBadRequest()
    {
        // User exists but is not a player in any game with an open episode
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "user-1",
                    Email = "alice@test.com",
                    DisplayName = "Alice",
                    PasswordHash = "hash",
                }
            )
        );
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/admin/emails/send-reminder",
            new { userId = "user-1" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SendReminder_WhenNotAdmin_ReturnsForbidden()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsNonAdmin();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/admin/emails/send-reminder",
            new { userId = "user-1" }
        );

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task SendReminder_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/admin/emails/send-reminder",
            new { userId = "user-1" }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
