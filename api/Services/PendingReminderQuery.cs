using Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public sealed class PendingReminderQuery(AppDbContext db) : IPendingReminderQuery
{
    public async Task<IReadOnlyList<ReminderRecipient>> GetPendingRecipientsAsync(
        string baseUrl,
        CancellationToken ct
    )
    {
        var now = DateTimeOffset.UtcNow;

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
            return [];

        var openGameIds = openGames.Select(g => g.Id).ToList();

        var episodeByGame = openGames.ToDictionary(g => g.Id, g => g.OpenEpisode!.Number);

        var rankingsForOpenGames = await db
            .Rankings.Where(r => openGameIds.Contains(r.GameId))
            .Select(r => new
            {
                r.GameId,
                r.UserId,
                r.EpisodeNumber,
            })
            .ToListAsync(ct);

        var submittedSet = rankingsForOpenGames
            .Where(r => episodeByGame.TryGetValue(r.GameId, out var ep) && r.EpisodeNumber == ep)
            .Select(r => (r.GameId, r.UserId))
            .ToHashSet();

        var players = await db.Players.Where(p => openGameIds.Contains(p.GameId)).ToListAsync(ct);

        var missingByUser = players
            .Where(p => !submittedSet.Contains((p.GameId, p.UserId)))
            .GroupBy(p => p.UserId)
            .ToDictionary(g => g.Key, g => g.Select(p => p.GameId).ToList());

        if (missingByUser.Count == 0)
            return [];

        var userIds = missingByUser.Keys.ToList();
        var users = await db
            .AppUsers.Where(u => userIds.Contains(u.Id) && u.ReminderEmailsEnabled)
            .ToListAsync(ct);

        var openGameById = openGames.ToDictionary(g => g.Id);

        return users
            .Select(user =>
            {
                var gameLinks = missingByUser[user.Id]
                    .Where(gid => openGameById.ContainsKey(gid))
                    .Select(gid => openGameById[gid])
                    .Select(g => (g.Name, $"{baseUrl}/login?redirect=/game/{g.Id}"))
                    .ToList<(string GameName, string GameUrl)>();

                return new ReminderRecipient(user.Email, user.DisplayName, gameLinks);
            })
            .Where(r => r.Games.Count > 0)
            .ToList();
    }
}
