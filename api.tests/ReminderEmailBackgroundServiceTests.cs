using Api.Data;
using Api.Services;
using Api.Tests.Helpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Api.Tests;

public sealed class ReminderEmailBackgroundServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;

    public ReminderEmailBackgroundServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        // Create schema once; all AppDbContext instances in this test share the same connection.
        using var db = OpenDb();
        db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _connection.Dispose();
    }

    private AppDbContext OpenDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);

    // Sunday April 5, 2026 — Brussels is CEST (UTC+2)
    // 09:00 Brussels = 07:00 UTC  → inside window
    // 07:59 Brussels = 05:59 UTC  → before window
    // 10:01 Brussels = 08:01 UTC  → after window
    private static readonly DateTimeOffset SundayInWindow = new(2026, 4, 5, 7, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset SundayBeforeWindow = new(
        2026,
        4,
        5,
        5,
        59,
        0,
        TimeSpan.Zero
    );
    private static readonly DateTimeOffset SundayAfterWindow = new(
        2026,
        4,
        5,
        8,
        1,
        0,
        TimeSpan.Zero
    );
    private static readonly DateTimeOffset MondayInWindow = new(2026, 4, 6, 7, 0, 0, TimeSpan.Zero);

    private static readonly ReminderRecipient AliceRecipient = new(
        "alice@example.com",
        "Alice",
        [("Game 1", "https://example.com/login?redirect=/game/game-1")]
    );

    private static readonly ReminderRecipient BobRecipient = new(
        "bob@example.com",
        "Bob",
        [("Game 1", "https://example.com/login?redirect=/game/game-1")]
    );

    private ReminderEmailBackgroundService CreateService(
        DateTimeOffset utcNow,
        FakePendingReminderQuery? query = null,
        IEmailService? emailService = null
    )
    {
        query ??= new FakePendingReminderQuery([]);
        emailService ??= new FakeEmailService();

        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(options => options.UseSqlite(_connection));
        services.AddScoped<IPendingReminderQuery>(_ => query);
        services.AddScoped<IEmailService>(_ => emailService);
        var scopeFactory = services
            .BuildServiceProvider()
            .GetRequiredService<IServiceScopeFactory>();

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["BaseUrl"] = "https://example.com" }
            )
            .Build();

        return new ReminderEmailBackgroundService(
            scopeFactory,
            config,
            new FakeTimeProvider(utcNow),
            NullLogger<ReminderEmailBackgroundService>.Instance
        );
    }

    [Fact]
    public async Task TrySendReminders_WhenNotSunday_DoesNotQueryOrSendEmails()
    {
        var query = new FakePendingReminderQuery([AliceRecipient]);
        var emailService = new FakeEmailService();
        var service = CreateService(MondayInWindow, query, emailService);

        await service.TrySendRemindersAsync(CancellationToken.None);

        Assert.Equal(0, query.CallCount);
        Assert.Empty(emailService.SentReminders);
    }

    [Fact]
    public async Task TrySendReminders_WhenSundayBeforeWindow_DoesNotQueryOrSendEmails()
    {
        var query = new FakePendingReminderQuery([AliceRecipient]);
        var emailService = new FakeEmailService();
        var service = CreateService(SundayBeforeWindow, query, emailService);

        await service.TrySendRemindersAsync(CancellationToken.None);

        Assert.Equal(0, query.CallCount);
        Assert.Empty(emailService.SentReminders);
    }

    [Fact]
    public async Task TrySendReminders_WhenSundayAfterWindow_DoesNotQueryOrSendEmails()
    {
        var query = new FakePendingReminderQuery([AliceRecipient]);
        var emailService = new FakeEmailService();
        var service = CreateService(SundayAfterWindow, query, emailService);

        await service.TrySendRemindersAsync(CancellationToken.None);

        Assert.Equal(0, query.CallCount);
        Assert.Empty(emailService.SentReminders);
    }

    [Fact]
    public async Task TrySendReminders_WhenSundayInWindow_NoRecipients_SendsNoEmails()
    {
        var emailService = new FakeEmailService();
        var service = CreateService(SundayInWindow, emailService: emailService);

        await service.TrySendRemindersAsync(CancellationToken.None);

        Assert.Empty(emailService.SentReminders);
    }

    [Fact]
    public async Task TrySendReminders_WhenSundayInWindow_SendsEmailToEachRecipient()
    {
        var query = new FakePendingReminderQuery([AliceRecipient, BobRecipient]);
        var emailService = new FakeEmailService();
        var service = CreateService(SundayInWindow, query, emailService);

        await service.TrySendRemindersAsync(CancellationToken.None);

        Assert.Equal(2, emailService.SentReminders.Count);
        Assert.Contains(emailService.SentReminders, r => r.ToEmail == "alice@example.com");
        Assert.Contains(emailService.SentReminders, r => r.ToEmail == "bob@example.com");
    }

    [Fact]
    public async Task TrySendReminders_WhenSundayInWindow_PassesDisplayNameAndGamesToEmailService()
    {
        var query = new FakePendingReminderQuery([AliceRecipient]);
        var emailService = new FakeEmailService();
        var service = CreateService(SundayInWindow, query, emailService);

        await service.TrySendRemindersAsync(CancellationToken.None);

        var sent = Assert.Single(emailService.SentReminders);
        Assert.Equal("alice@example.com", sent.ToEmail);
        Assert.Equal("Alice", sent.DisplayName);
        Assert.Equal("Game 1", sent.Games[0].GameName);
    }

    [Fact]
    public async Task TrySendReminders_WhenCalledTwiceOnSameDay_SendsOnlyOnce()
    {
        var query = new FakePendingReminderQuery([AliceRecipient]);
        var emailService = new FakeEmailService();
        var service = CreateService(SundayInWindow, query, emailService);

        await service.TrySendRemindersAsync(CancellationToken.None);
        await service.TrySendRemindersAsync(CancellationToken.None);

        Assert.Single(emailService.SentReminders);
        Assert.Equal(1, query.CallCount);
    }

    [Fact]
    public async Task TrySendReminders_PersistedDateSurvivesNewServiceInstance()
    {
        // First instance sends reminders and persists the date.
        var query = new FakePendingReminderQuery([AliceRecipient]);
        var emailService = new FakeEmailService();
        var first = CreateService(SundayInWindow, query, emailService);
        await first.TrySendRemindersAsync(CancellationToken.None);
        Assert.Single(emailService.SentReminders);

        // Second instance (simulates a process restart) shares the same DB.
        var secondEmailService = new FakeEmailService();
        var second = CreateService(
            SundayInWindow,
            new FakePendingReminderQuery([AliceRecipient]),
            secondEmailService
        );
        await second.TrySendRemindersAsync(CancellationToken.None);

        Assert.Empty(secondEmailService.SentReminders);
    }

    // ── ExecuteAsync (startup behaviour) ──────────────────────────────────────

    [Fact]
    public async Task ExecuteAsync_WhenStartedInsideSundayWindow_SendsRemindersBeforeFirstTimerTick()
    {
        // Before the fix, ExecuteAsync used PeriodicTimer without an upfront check, so a
        // process restart at e.g. 09:45 would miss the window entirely (first tick at 10:15).
        // The first tick of a 30-minute PeriodicTimer is 30 real minutes away; if emails are
        // sent it must be because the startup check fired before any tick.
        var query = new FakePendingReminderQuery([AliceRecipient]);
        var emailService = new FakeEmailService();
        var service = CreateService(SundayInWindow, query, emailService);

        await service.StartAsync(CancellationToken.None);
        // All fakes complete synchronously; wait briefly for the in-memory async ops to finish.
        await Task.Delay(500);

        Assert.Single(emailService.SentReminders);

        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task ExecuteAsync_WhenStartedOutsideWindow_DoesNotSendOnStartup()
    {
        var query = new FakePendingReminderQuery([AliceRecipient]);
        var emailService = new FakeEmailService();
        var service = CreateService(MondayInWindow, query, emailService);

        await service.StartAsync(CancellationToken.None);
        await Task.Delay(500);

        Assert.Empty(emailService.SentReminders);

        await service.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task ExecuteAsync_WhenRestartedInsideWindow_DoesNotDoubleSend()
    {
        // First instance sends and persists the date.
        var firstEmailService = new FakeEmailService();
        var first = CreateService(
            SundayInWindow,
            new FakePendingReminderQuery([AliceRecipient]),
            firstEmailService
        );
        await first.StartAsync(CancellationToken.None);
        await Task.Delay(500);
        Assert.Single(firstEmailService.SentReminders);
        await first.StopAsync(CancellationToken.None);

        // Second instance (simulates a mid-window restart) shares the same DB.
        var secondEmailService = new FakeEmailService();
        var second = CreateService(
            SundayInWindow,
            new FakePendingReminderQuery([AliceRecipient]),
            secondEmailService
        );
        await second.StartAsync(CancellationToken.None);
        await Task.Delay(500);

        Assert.Empty(secondEmailService.SentReminders);

        await second.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task TrySendReminders_WhenOneEmailFails_ContinuesToSendToOtherRecipients()
    {
        var query = new FakePendingReminderQuery([AliceRecipient, BobRecipient]);
        var emailService = new ThrowingOnceEmailService("alice@example.com");
        var service = CreateService(SundayInWindow, query, emailService);

        // Should not throw — errors are caught per-recipient
        await service.TrySendRemindersAsync(CancellationToken.None);

        Assert.Single(emailService.SentReminders);
        Assert.Equal("bob@example.com", emailService.SentReminders[0].ToEmail);
    }

    /// <summary>
    /// Email service that throws for a specific address and records the rest.
    /// </summary>
    private sealed class ThrowingOnceEmailService(string throwForEmail) : IEmailService
    {
        public List<(
            string ToEmail,
            string DisplayName,
            List<(string GameName, string GameUrl)> Games
        )> SentReminders { get; } = [];

        public Task SendPasswordResetAsync(string toEmail, string displayName, string resetUrl) =>
            Task.CompletedTask;

        public Task SendRankingReminderAsync(
            string toEmail,
            string displayName,
            IEnumerable<(string GameName, string GameUrl)> games
        )
        {
            if (toEmail == throwForEmail)
                throw new HttpRequestException("MailerSend unavailable");

            SentReminders.Add((toEmail, displayName, games.ToList()));
            return Task.CompletedTask;
        }
    }
}
