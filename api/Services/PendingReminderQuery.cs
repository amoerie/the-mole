using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Services;

public sealed class PendingReminderQuery(AppDbContext db) : IPendingReminderQuery
{
    public async Task<IReadOnlyList<ReminderRecipient>> GetRecipientsAsync(
        string baseUrl,
        CancellationToken ct
    )
    {
        var now = DateTimeOffset.UtcNow;
        var games = await db.Games.Include(g => g.Episodes).ToListAsync(ct);

        var openGameInfos = BuildOpenGameInfos(games, now);
        if (openGameInfos.Count == 0)
            return [];

        var openGameIds = openGameInfos.Select(g => g.Id).ToList();
        var openGameById = openGameInfos.ToDictionary(g => g.Id);
        var episodeByGame = openGameInfos.ToDictionary(g => g.Id, g => g.EpisodeNumber);

        var rankings = await db.Rankings.Where(r => openGameIds.Contains(r.GameId)).ToListAsync(ct);
        var rankingByGameUser = BuildRankingLookup(rankings, episodeByGame);

        var players = await db.Players.Where(p => openGameIds.Contains(p.GameId)).ToListAsync(ct);
        var gamesByUser = players
            .GroupBy(p => p.UserId)
            .ToDictionary(g => g.Key, g => g.Select(p => p.GameId).ToList());

        if (gamesByUser.Count == 0)
            return [];

        var userIds = gamesByUser.Keys.ToList();
        var users = await db
            .AppUsers.Where(u => userIds.Contains(u.Id) && u.ReminderEmailsEnabled)
            .ToListAsync(ct);

        return users
            .Select(user =>
            {
                var gameInfos = gamesByUser[user.Id]
                    .Where(gid => openGameById.ContainsKey(gid))
                    .Select(gid =>
                        TryBuildGameReminderInfo(
                            gid,
                            user.Id,
                            baseUrl,
                            openGameById[gid],
                            rankingByGameUser
                        )
                    )
                    .OfType<GameReminderInfo>()
                    .ToList();

                return new ReminderRecipient(user.Email, user.DisplayName, gameInfos);
            })
            .Where(r => r.Games.Count > 0)
            .ToList();
    }

    public async Task<ReminderRecipient?> GetRecipientForUserAsync(
        string userId,
        string baseUrl,
        CancellationToken ct
    )
    {
        var user = await db.AppUsers.FindAsync([userId], ct);
        if (user == null)
            return null;

        var now = DateTimeOffset.UtcNow;
        var games = await db.Games.Include(g => g.Episodes).ToListAsync(ct);

        var openGameInfos = BuildOpenGameInfos(games, now);
        if (openGameInfos.Count == 0)
            return null;

        var openGameIds = openGameInfos.Select(g => g.Id).ToList();

        var playerGameIds = await db
            .Players.Where(p => p.UserId == userId && openGameIds.Contains(p.GameId))
            .Select(p => p.GameId)
            .ToListAsync(ct);

        if (playerGameIds.Count == 0)
            return null;

        var openGameById = openGameInfos.ToDictionary(g => g.Id);
        var episodeByGame = openGameInfos.ToDictionary(g => g.Id, g => g.EpisodeNumber);

        var rankings = await db
            .Rankings.Where(r => r.UserId == userId && playerGameIds.Contains(r.GameId))
            .ToListAsync(ct);

        var rankingByGameUser = BuildRankingLookup(rankings, episodeByGame);

        var gameInfos = playerGameIds
            .Where(gid => openGameById.ContainsKey(gid))
            .Select(gid =>
                TryBuildGameReminderInfo(gid, userId, baseUrl, openGameById[gid], rankingByGameUser)
            )
            .OfType<GameReminderInfo>()
            .ToList();

        if (gameInfos.Count == 0)
            return null;

        return new ReminderRecipient(user.Email, user.DisplayName, gameInfos);
    }

    private static GameReminderInfo? TryBuildGameReminderInfo(
        string gameId,
        string userId,
        string baseUrl,
        OpenGameInfo info,
        Dictionary<(string GameId, string UserId), Ranking> rankingLookup
    )
    {
        if (!rankingLookup.TryGetValue((gameId, userId), out var ranking))
            return null;

        var contestantById = info.Contestants.ToDictionary(c => c.Id, c => c.Name);
        var rankedNames = ranking
            .ContestantIds.Select(id => contestantById.GetValueOrDefault(id, id))
            .ToList();

        return new GameReminderInfo(
            info.Name,
            $"{baseUrl}/login?redirect=/game/{gameId}",
            info.Deadline,
            rankedNames
        );
    }

    private static Dictionary<(string GameId, string UserId), Ranking> BuildRankingLookup(
        List<Ranking> rankings,
        Dictionary<string, int> episodeByGame
    ) =>
        rankings
            .Where(r => episodeByGame.TryGetValue(r.GameId, out var ep) && r.EpisodeNumber == ep)
            .ToDictionary(r => (r.GameId, r.UserId));

    private static List<OpenGameInfo> BuildOpenGameInfos(List<Game> games, DateTimeOffset now) =>
        games
            .Select(g =>
            {
                var episode = g
                    .Episodes.Where(e => e.Deadline > now)
                    .OrderBy(e => e.Number)
                    .FirstOrDefault();
                return episode == null
                    ? null
                    : new OpenGameInfo(
                        g.Id,
                        g.Name,
                        g.Contestants,
                        episode.Number,
                        episode.Deadline
                    );
            })
            .OfType<OpenGameInfo>()
            .ToList();

    private sealed record OpenGameInfo(
        string Id,
        string Name,
        List<Contestant> Contestants,
        int EpisodeNumber,
        DateTimeOffset Deadline
    );
}
