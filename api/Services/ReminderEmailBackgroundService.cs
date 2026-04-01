namespace Api.Services;

public sealed partial class ReminderEmailBackgroundService(
    IServiceScopeFactory scopeFactory,
    IConfiguration config,
    TimeProvider timeProvider,
    ILogger<ReminderEmailBackgroundService> logger
) : BackgroundService
{
    private readonly ILogger<ReminderEmailBackgroundService> _logger = logger;

    // In-memory guard: the date (in Brussels time) on which reminders were last sent.
    // Prevents double-sending if the service restarts within the send window.
    private DateOnly? _lastSentDate;

    // Send window: Sunday, 08:00–10:00 Brussels time.
    private static readonly TimeOnly WindowStart = new(8, 0);
    private static readonly TimeOnly WindowEnd = new(10, 0);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
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

        if (_lastSentDate == todayBelgium)
        {
            LogAlreadySent(todayBelgium);
            return;
        }

        LogStartingSend(todayBelgium);

        using var scope = scopeFactory.CreateScope();
        var query = scope.ServiceProvider.GetRequiredService<IPendingReminderQuery>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
        var baseUrl = (config["BaseUrl"] ?? "").TrimEnd('/');

        var recipients = await query.GetPendingRecipientsAsync(baseUrl, ct);

        if (recipients.Count == 0)
        {
            LogAllSubmitted();
            _lastSentDate = todayBelgium;
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
        _lastSentDate = todayBelgium;
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

    [LoggerMessage(Level = LogLevel.Debug, Message = "No open episodes found, skipping reminders")]
    private partial void LogNoOpenEpisodes();

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "All players have submitted rankings, no reminders needed"
    )]
    private partial void LogAllSubmitted();

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
