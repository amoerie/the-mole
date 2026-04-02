using System.Text.Json;
using Api.Services;
using Microsoft.Extensions.Configuration;

namespace Api.Tests;

public sealed class MailerSendEmailServiceTests
{
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

    private static (MailerSendEmailService service, CapturingHandler handler) CreateService(
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

        return (new MailerSendEmailService(new FakeHttpClientFactory(handler), config), handler);
    }

    private static JsonElement ParseBody(string? body)
    {
        Assert.NotNull(body);
        return JsonDocument.Parse(body!).RootElement;
    }

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

    // ── SendRankingReminderAsync ─────────────────────────────────────────────

    [Fact]
    public async Task SendRankingReminderAsync_PostsToMailerSendApi()
    {
        var (service, handler) = CreateService();

        await service.SendRankingReminderAsync(
            "user@test.com",
            "Alice",
            [("Game 1", "https://example.com/login?redirect=/game/1")]
        );

        Assert.Equal(
            "https://api.mailersend.com/v1/email",
            handler.LastRequest!.RequestUri?.ToString()
        );
    }

    [Fact]
    public async Task SendRankingReminderAsync_UsesCorrectSubject()
    {
        var (service, handler) = CreateService();

        await service.SendRankingReminderAsync(
            "user@test.com",
            "Alice",
            [("Game 1", "https://example.com/login?redirect=/game/1")]
        );

        var body = ParseBody(handler.LastRequestBody);
        Assert.Equal(
            "Vergeet je rangschikking niet — Mollenjagers",
            body.GetProperty("subject").GetString()
        );
    }

    [Fact]
    public async Task SendRankingReminderAsync_HtmlContainsGameLink()
    {
        var (service, handler) = CreateService();
        const string gameUrl = "https://example.com/login?redirect=/game/abc";

        await service.SendRankingReminderAsync("user@test.com", "Alice", [("My Game", gameUrl)]);

        var body = ParseBody(handler.LastRequestBody);
        var html = body.GetProperty("html").GetString();
        Assert.Contains(gameUrl, html);
        Assert.Contains("My Game", html);
    }

    [Fact]
    public async Task SendRankingReminderAsync_WithMultipleGames_HtmlContainsAllLinks()
    {
        var (service, handler) = CreateService();

        await service.SendRankingReminderAsync(
            "user@test.com",
            "Alice",
            [
                ("Game A", "https://example.com/login?redirect=/game/a"),
                ("Game B", "https://example.com/login?redirect=/game/b"),
            ]
        );

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

        await service.SendRankingReminderAsync(
            "user@test.com",
            "Alice",
            [("Game 1", "https://example.com/login?redirect=/game/1")]
        );

        var body = ParseBody(handler.LastRequestBody);
        var html = body.GetProperty("html").GetString();
        Assert.Contains("https://example.com/profile", html);
    }
}
