using Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public sealed class ReminderEmailBackgroundService(
    IServiceScopeFactory scopeFactory,
    IConfiguration config,
    ILogger<ReminderEmailBackgroundService> logger
) : BackgroundService
{
    // In-memory guard: the date (in Brussels time) on which reminders were last sent.
    // Prevents double-sending if the service restarts within the send window.
    private DateOnly? _lastSentDate;

    // Send window: Sunday, 08:00–10:00 Brussels time.
    private static readonly TimeOnly WindowStart = new(8, 0);
    private static readonly TimeOnly WindowEnd = new(10, 0);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Align with the next 30-minute mark before entering the loop so the
        // first tick happens at a predictable time.
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(30));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await TrySendRemindersAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error while sending ranking reminder emails");
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
            logger.LogDebug(
                "Ranking reminders already sent today ({Date}), skipping",
                todayBelgium
            );
            return;
        }

        logger.LogInformation("Sending Sunday ranking reminders ({Date})", todayBelgium);

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
            logger.LogDebug("No open episodes found, skipping reminders");
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
            logger.LogInformation("All players have submitted rankings, no reminders needed");
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
                logger.LogDebug(
                    "Sent ranking reminder to {UserId} for {Count} game(s)",
                    user.Id,
                    gameLinks.Count
                );
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to send ranking reminder to {UserId}", user.Id);
            }
        }

        logger.LogInformation("Sent {Count} ranking reminder email(s)", sent);
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
}
