using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public sealed partial class ReminderEmailBackgroundService(
    IServiceScopeFactory scopeFactory,
    IConfiguration config,
    TimeProvider timeProvider,
    ILogger<ReminderEmailBackgroundService> logger
) : BackgroundService
{
    private readonly ILogger<ReminderEmailBackgroundService> _logger = logger;

    // In-process cache: avoids DB round-trips for repeated timer ticks within the same window.
    // The authoritative record is persisted in AppSettings so it survives process restarts.
    private DateOnly? _lastSentDate;

    private const string LastSentKey = "ReminderEmail:LastSentDate";

    // Send window: Sunday, 08:00–10:00 Brussels time.
    private static readonly TimeOnly WindowStart = new(8, 0);
    private static readonly TimeOnly WindowEnd = new(10, 0);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Run once immediately on startup: if the process restarts inside the Sunday window
        // (e.g. after a deployment at 09:45) the first periodic tick would arrive at 10:15
        // — outside the window — and the reminders would be silently missed.
        // The persisted-date deduplication check makes this safe against double-sends.
        try
        {
            await TrySendRemindersAsync(stoppingToken);
        }
        catch (Exception ex)
        {
            LogSendError(ex);
        }

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(30), timeProvider);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await TrySendRemindersAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                LogSendError(ex);
            }
        }
    }

    internal async Task TrySendRemindersAsync(CancellationToken ct)
    {
        var belgiumTime = GetBelgiumTime();
        var todayBelgium = DateOnly.FromDateTime(belgiumTime);
        var timeNow = TimeOnly.FromDateTime(belgiumTime);

        if (
            belgiumTime.DayOfWeek != DayOfWeek.Sunday
            || timeNow < WindowStart
            || timeNow >= WindowEnd
        )
            return;

        // Fast in-process check before hitting the DB.
        if (_lastSentDate == todayBelgium)
        {
            LogAlreadySent(todayBelgium);
            return;
        }

        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Durable check: also compare against the persisted date so restarts within the window don't re-send.
        var setting = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == LastSentKey, ct);
        var persistedDate =
            setting != null && DateOnly.TryParse(setting.Value, out var d) ? d : (DateOnly?)null;

        if (persistedDate == todayBelgium)
        {
            _lastSentDate = todayBelgium; // sync in-process cache
            LogAlreadySent(todayBelgium);
            return;
        }

        LogStartingSend(todayBelgium);

        var query = scope.ServiceProvider.GetRequiredService<IPendingReminderQuery>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
        var baseUrl = (config["BaseUrl"] ?? "").TrimEnd('/');

        var recipients = await query.GetRecipientsAsync(baseUrl, ct);

        if (recipients.Count == 0)
        {
            LogNoRemindersNeeded();
            await PersistLastSentDateAsync(db, setting, todayBelgium, ct);
            return;
        }

        int sent = 0;
        foreach (var recipient in recipients)
        {
            try
            {
                await emailService.SendRankingReminderAsync(
                    recipient.Email,
                    recipient.DisplayName,
                    recipient.Games
                );
                sent++;
                LogReminderSent(recipient.Email, recipient.Games.Count);
            }
            catch (Exception ex)
            {
                LogReminderFailed(ex, recipient.Email);
            }
        }

        LogSendComplete(sent);
        await PersistLastSentDateAsync(db, setting, todayBelgium, ct);
    }

    private async Task PersistLastSentDateAsync(
        AppDbContext db,
        AppSetting? existing,
        DateOnly date,
        CancellationToken ct
    )
    {
        if (existing == null)
            db.AppSettings.Add(
                new AppSetting
                {
                    Key = LastSentKey,
                    Value = date.ToString("O", System.Globalization.CultureInfo.InvariantCulture),
                }
            );
        else
            existing.Value = date.ToString("O", System.Globalization.CultureInfo.InvariantCulture);

        await db.SaveChangesAsync(ct);
        _lastSentDate = date;
    }

    private DateTime GetBelgiumTime()
    {
        TimeZoneInfo tz;
        try
        {
            tz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Brussels");
        }
        catch
        {
            tz = TimeZoneInfo.FindSystemTimeZoneById("Romance Standard Time");
        }
        return TimeZoneInfo.ConvertTimeFromUtc(timeProvider.GetUtcNow().UtcDateTime, tz);
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Error while sending ranking reminder emails")]
    private partial void LogSendError(Exception ex);

    [LoggerMessage(
        Level = LogLevel.Debug,
        Message = "Ranking reminders already sent today ({Date}), skipping"
    )]
    private partial void LogAlreadySent(DateOnly date);

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "Sending Sunday ranking reminders ({Date})"
    )]
    private partial void LogStartingSend(DateOnly date);

    [LoggerMessage(Level = LogLevel.Debug, Message = "No pending reminders to send")]
    private partial void LogNoRemindersNeeded();

    [LoggerMessage(
        Level = LogLevel.Debug,
        Message = "Sent ranking reminder to {Email} for {Count} game(s)"
    )]
    private partial void LogReminderSent(string email, int count);

    [LoggerMessage(Level = LogLevel.Error, Message = "Failed to send ranking reminder to {Email}")]
    private partial void LogReminderFailed(Exception ex, string email);

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "Sent {Count} ranking reminder email(s)"
    )]
    private partial void LogSendComplete(int count);
}
