using Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public sealed partial class ReminderEmailBackgroundService(
    IServiceScopeFactory scopeFactory,
    IConfiguration config,
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
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(30));

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

    private async Task TrySendRemindersAsync(CancellationToken ct)
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
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
        var baseUrl = (config["BaseUrl"] ?? "").TrimEnd('/');
        var now = DateTimeOffset.UtcNow;

        // Load all games that have at least one open episode (deadline in the future).
        var games = await db.Games.Include(g => g.Episodes).ToListAsync(ct);

        var openGames = games
            .Select(g => new
            {
                g.Id,
                g.Name,
                OpenEpisode = g
                    .Episodes.Where(e => e.Deadline > now)
                    .OrderBy(e => e.Number)
                    .FirstOrDefault(),
            })
            .Where(g => g.OpenEpisode != null)
            .ToList();

        if (openGames.Count == 0)
        {
            LogNoOpenEpisodes();
            return;
        }

        var openGameIds = openGames.Select(g => g.Id).ToList();

        // For each open game, find players who haven't submitted a ranking yet.
        var submittedByGameAndUser = await db
            .Rankings.Where(r =>
                openGameIds.Contains(r.GameId)
                && openGames
                    .Where(g => g.Id == r.GameId)
                    .Select(g => g.OpenEpisode!.Number)
                    .Contains(r.EpisodeNumber)
            )
            .Select(r => new { r.GameId, r.UserId })
            .ToListAsync(ct);

        var submittedSet = submittedByGameAndUser.Select(x => (x.GameId, x.UserId)).ToHashSet();

        // Load all players in open games.
        var players = await db.Players.Where(p => openGameIds.Contains(p.GameId)).ToListAsync(ct);

        // Group by user — collect games where they're missing a ranking.
        var remindersByUser = players
            .Where(p => !submittedSet.Contains((p.GameId, p.UserId)))
            .GroupBy(p => p.UserId)
            .ToDictionary(g => g.Key, g => g.Select(p => p.GameId).ToList());

        if (remindersByUser.Count == 0)
        {
            LogAllSubmitted();
            _lastSentDate = todayBelgium;
            return;
        }

        // Load user details for those who need reminders and have opted in.
        var userIds = remindersByUser.Keys.ToList();
        var users = await db
            .AppUsers.Where(u => userIds.Contains(u.Id) && u.ReminderEmailsEnabled)
            .ToListAsync(ct);

        int sent = 0;
        foreach (var user in users)
        {
            if (!remindersByUser.TryGetValue(user.Id, out var missingGameIds))
                continue;

            var gameLinks = missingGameIds
                .Select(gid => openGames.FirstOrDefault(g => g.Id == gid))
                .Where(g => g != null)
                .Select(g => (g!.Name, $"{baseUrl}/login?redirect=/game/{g.Id}"))
                .ToList();

            if (gameLinks.Count == 0)
                continue;

            try
            {
                await emailService.SendRankingReminderAsync(
                    user.Email,
                    user.DisplayName,
                    gameLinks
                );
                sent++;
                LogReminderSent(user.Id, gameLinks.Count);
            }
            catch (Exception ex)
            {
                LogReminderFailed(ex, user.Id);
            }
        }

        LogSendComplete(sent);
        _lastSentDate = todayBelgium;
    }

    private static DateTime GetBelgiumTime()
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
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
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
        Message = "Sent ranking reminder to {UserId} for {Count} game(s)"
    )]
    private partial void LogReminderSent(string userId, int count);

    [LoggerMessage(Level = LogLevel.Error, Message = "Failed to send ranking reminder to {UserId}")]
    private partial void LogReminderFailed(Exception ex, string userId);

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "Sent {Count} ranking reminder email(s)"
    )]
    private partial void LogSendComplete(int count);
}
