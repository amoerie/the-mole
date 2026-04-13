using System.Text.Json;
using Api.Data;
using Api.Models;
using Api.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using EmailType = Api.Models.EmailType;

namespace Api.Tests;

public sealed class MailerSendEmailServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _db;

    public MailerSendEmailServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        _db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options
        );
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }
        public string? LastRequestBody { get; private set; }
        public HttpStatusCode ResponseStatus { get; set; } = HttpStatusCode.Accepted;

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        )
        {
            LastRequest = request;
            LastRequestBody =
                request.Content != null
                    ? await request.Content.ReadAsStringAsync(cancellationToken)
                    : null;
            return new HttpResponseMessage(ResponseStatus);
        }
    }

    private sealed class FakeHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private (MailerSendEmailService service, CapturingHandler handler) CreateService(
        string apiKey = "test-key",
        string fromEmail = "noreply@example.com",
        string baseUrl = "https://example.com"
    )
    {
        var handler = new CapturingHandler();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["MailerSend:ApiKey"] = apiKey,
                    ["MailerSend:FromEmail"] = fromEmail,
                    ["BaseUrl"] = baseUrl,
                }
            )
            .Build();

        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(options => options.UseSqlite(_connection));
        var provider = services.BuildServiceProvider();
        var scopeFactory = provider.GetRequiredService<IServiceScopeFactory>();

        return (
            new MailerSendEmailService(new FakeHttpClientFactory(handler), config, scopeFactory),
            handler
        );
    }

    private static JsonElement ParseBody(string? body)
    {
        Assert.NotNull(body);
        return JsonDocument.Parse(body!).RootElement;
    }

    private static readonly GameReminderInfo SampleGame = new(
        "Test Game",
        "https://example.com/login?redirect=/game/1",
        DateTimeOffset.UtcNow.AddDays(7),
        ["Alice", "Bob"]
    );

    // ── SendPasswordResetAsync ───────────────────────────────────────────────

    [Fact]
    public async Task SendPasswordResetAsync_PostsToMailerSendApi()
    {
        var (service, handler) = CreateService();

        await service.SendPasswordResetAsync("user@test.com", "Alice", "https://example.com/reset");

        Assert.NotNull(handler.LastRequest);
        Assert.Equal(HttpMethod.Post, handler.LastRequest!.Method);
        Assert.Equal(
            "https://api.mailersend.com/v1/email",
            handler.LastRequest.RequestUri?.ToString()
        );
    }

    [Fact]
    public async Task SendPasswordResetAsync_SendsBearerToken()
    {
        var (service, handler) = CreateService(apiKey: "secret-key");

        await service.SendPasswordResetAsync("user@test.com", "Alice", "https://example.com/reset");

        Assert.Equal("Bearer secret-key", handler.LastRequest!.Headers.Authorization?.ToString());
    }

    [Fact]
    public async Task SendPasswordResetAsync_SendsToCorrectRecipient()
    {
        var (service, handler) = CreateService();

        await service.SendPasswordResetAsync(
            "alice@test.com",
            "Alice",
            "https://example.com/reset"
        );

        var body = ParseBody(handler.LastRequestBody);
        var toEmail = body.GetProperty("to")[0].GetProperty("email").GetString();
        Assert.Equal("alice@test.com", toEmail);
    }

    [Fact]
    public async Task SendPasswordResetAsync_UsesCorrectSubject()
    {
        var (service, handler) = CreateService();

        await service.SendPasswordResetAsync("user@test.com", "Alice", "https://example.com/reset");

        var body = ParseBody(handler.LastRequestBody);
        Assert.Equal(
            "Wachtwoord herstellen — Mollenjagers",
            body.GetProperty("subject").GetString()
        );
    }

    [Fact]
    public async Task SendPasswordResetAsync_HtmlContainsResetUrl()
    {
        var (service, handler) = CreateService();
        const string resetUrl = "https://example.com/reset?token=abc123";

        await service.SendPasswordResetAsync("user@test.com", "Alice", resetUrl);

        var body = ParseBody(handler.LastRequestBody);
        var html = body.GetProperty("html").GetString();
        Assert.Contains(resetUrl, html);
    }

    [Fact]
    public async Task SendPasswordResetAsync_HtmlContainsDisplayName()
    {
        var (service, handler) = CreateService();

        await service.SendPasswordResetAsync("user@test.com", "Alice", "https://example.com/reset");

        var body = ParseBody(handler.LastRequestBody);
        var html = body.GetProperty("html").GetString();
        Assert.Contains("Alice", html);
    }

    [Fact]
    public async Task SendPasswordResetAsync_HtmlEscapesDisplayName()
    {
        var (service, handler) = CreateService();

        await service.SendPasswordResetAsync(
            "user@test.com",
            "<script>alert(1)</script>",
            "https://example.com/reset"
        );

        var body = ParseBody(handler.LastRequestBody);
        var html = body.GetProperty("html").GetString();
        Assert.DoesNotContain("<script>", html);
        Assert.Contains("&lt;script&gt;", html);
    }

    [Fact]
    public async Task SendPasswordResetAsync_HtmlContainsBrandName()
    {
        var (service, handler) = CreateService();

        await service.SendPasswordResetAsync("user@test.com", "Alice", "https://example.com/reset");

        var body = ParseBody(handler.LastRequestBody);
        var html = body.GetProperty("html").GetString();
        Assert.Contains("MOLLENJAGERS", html);
    }

    [Fact]
    public async Task SendPasswordResetAsync_WhenApiReturnsError_Throws()
    {
        var (service, handler) = CreateService();
        handler.ResponseStatus = HttpStatusCode.Unauthorized;

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            service.SendPasswordResetAsync("user@test.com", "Alice", "https://example.com/reset")
        );
    }

    [Fact]
    public async Task SendPasswordResetAsync_LogsSuccessToDatabase()
    {
        var (service, _) = CreateService();

        await service.SendPasswordResetAsync("user@test.com", "Alice", "https://example.com/reset");

        var log = Assert.Single(_db.EmailLogs.ToList());
        Assert.Equal("user@test.com", log.ToEmail);
        Assert.Equal(EmailType.PasswordReset, log.Type);
        Assert.True(log.Success);
        Assert.Null(log.ErrorMessage);
    }

    [Fact]
    public async Task SendPasswordResetAsync_WhenApiFails_LogsFailureToDatabase()
    {
        var (service, handler) = CreateService();
        handler.ResponseStatus = HttpStatusCode.Unauthorized;

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            service.SendPasswordResetAsync("user@test.com", "Alice", "https://example.com/reset")
        );

        var log = Assert.Single(_db.EmailLogs.ToList());
        Assert.False(log.Success);
        Assert.NotNull(log.ErrorMessage);
    }

    // ── SendRankingReminderAsync ─────────────────────────────────────────────

    [Fact]
    public async Task SendRankingReminderAsync_PostsToMailerSendApi()
    {
        var (service, handler) = CreateService();

        await service.SendRankingReminderAsync("user@test.com", "Alice", [SampleGame]);

        Assert.Equal(
            "https://api.mailersend.com/v1/email",
            handler.LastRequest!.RequestUri?.ToString()
        );
    }

    [Fact]
    public async Task SendRankingReminderAsync_UsesCorrectSubject()
    {
        var (service, handler) = CreateService();

        await service.SendRankingReminderAsync("user@test.com", "Alice", [SampleGame]);

        var body = ParseBody(handler.LastRequestBody);
        Assert.Equal(
            "Jouw rangschikking voor deze week — Mollenjagers",
            body.GetProperty("subject").GetString()
        );
    }

    [Fact]
    public async Task SendRankingReminderAsync_HtmlContainsGameName()
    {
        var (service, handler) = CreateService();

        await service.SendRankingReminderAsync("user@test.com", "Alice", [SampleGame]);

        var body = ParseBody(handler.LastRequestBody);
        var html = body.GetProperty("html").GetString();
        Assert.Contains("Test Game", html);
    }

    [Fact]
    public async Task SendRankingReminderAsync_HtmlContainsRankedContestants()
    {
        var (service, handler) = CreateService();

        await service.SendRankingReminderAsync("user@test.com", "Alice", [SampleGame]);

        var body = ParseBody(handler.LastRequestBody);
        var html = body.GetProperty("html").GetString();
        Assert.Contains("Alice", html);
        Assert.Contains("Bob", html);
    }

    [Fact]
    public async Task SendRankingReminderAsync_HtmlContainsGameLink()
    {
        var (service, handler) = CreateService();

        await service.SendRankingReminderAsync("user@test.com", "Alice", [SampleGame]);

        var body = ParseBody(handler.LastRequestBody);
        var html = body.GetProperty("html").GetString();
        Assert.Contains("/game/1", html);
    }

    [Fact]
    public async Task SendRankingReminderAsync_WithMultipleGames_HtmlContainsAllGameNames()
    {
        var (service, handler) = CreateService();
        var gameA = new GameReminderInfo(
            "Game A",
            "https://example.com/login?redirect=/game/a",
            DateTimeOffset.UtcNow.AddDays(7),
            ["Alice"]
        );
        var gameB = new GameReminderInfo(
            "Game B",
            "https://example.com/login?redirect=/game/b",
            DateTimeOffset.UtcNow.AddDays(7),
            ["Bob"]
        );

        await service.SendRankingReminderAsync("user@test.com", "Alice", [gameA, gameB]);

        var body = ParseBody(handler.LastRequestBody);
        var html = body.GetProperty("html").GetString();
        Assert.Contains("Game A", html);
        Assert.Contains("Game B", html);
        Assert.Contains("/game/a", html);
        Assert.Contains("/game/b", html);
    }

    [Fact]
    public async Task SendRankingReminderAsync_HtmlContainsProfileUnsubscribeLink()
    {
        var (service, handler) = CreateService(baseUrl: "https://example.com");

        await service.SendRankingReminderAsync("user@test.com", "Alice", [SampleGame]);

        var body = ParseBody(handler.LastRequestBody);
        var html = body.GetProperty("html").GetString();
        Assert.Contains("https://example.com/profile", html);
    }

    [Fact]
    public async Task SendRankingReminderAsync_LogsSuccessToDatabase()
    {
        var (service, _) = CreateService();

        await service.SendRankingReminderAsync("user@test.com", "Alice", [SampleGame]);

        var log = Assert.Single(_db.EmailLogs.ToList());
        Assert.Equal("user@test.com", log.ToEmail);
        Assert.Equal(EmailType.RankingReminder, log.Type);
        Assert.True(log.Success);
    }

    [Fact]
    public async Task SendRankingReminderAsync_WhenApiFails_LogsFailure()
    {
        var (service, handler) = CreateService();
        handler.ResponseStatus = HttpStatusCode.InternalServerError;

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            service.SendRankingReminderAsync("user@test.com", "Alice", [SampleGame])
        );

        var log = Assert.Single(_db.EmailLogs.ToList());
        Assert.False(log.Success);
        Assert.NotNull(log.ErrorMessage);
    }

    // ── RetryAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task RetryAsync_SendsEmailWithStoredContent()
    {
        var (service, handler) = CreateService();

        await service.RetryAsync(
            "user@test.com",
            "Alice",
            "Test Subject",
            "plain text",
            "<p>html</p>",
            EmailType.RankingReminder
        );

        var body = ParseBody(handler.LastRequestBody);
        Assert.Equal("Test Subject", body.GetProperty("subject").GetString());
        Assert.Equal("plain text", body.GetProperty("text").GetString());
        Assert.Equal("<p>html</p>", body.GetProperty("html").GetString());
    }

    [Fact]
    public async Task RetryAsync_LogsNewEntryToDatabase()
    {
        var (service, _) = CreateService();

        await service.RetryAsync(
            "user@test.com",
            "Alice",
            "Subject",
            "text",
            "<p>html</p>",
            EmailType.RankingReminder
        );

        var log = Assert.Single(_db.EmailLogs.ToList());
        Assert.Equal("user@test.com", log.ToEmail);
        Assert.Equal(EmailType.RankingReminder, log.Type);
        Assert.True(log.Success);
    }
}
