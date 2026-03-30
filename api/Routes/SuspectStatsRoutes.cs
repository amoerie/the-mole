using Api.Auth;
using Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Api.Routes;

public static class SuspectStatsRoutes
{
    public static void MapSuspectStatsRoutes(this WebApplication app)
    {
        app.MapGet(
                "/api/games/{gameId}/suspect-stats",
                async (HttpContext ctx, AppDbContext db, string gameId) =>
                {
                    var user = AuthHelper.GetUserInfo(ctx);
                    if (user == null)
                        return Results.Unauthorized();

                    var game = await db.Games.FindAsync(gameId);
                    if (game == null)
                        return Results.NotFound();

                    var isPlayer = await db.Players.AnyAsync(p =>
                        p.GameId == gameId && p.UserId == user.UserId
                    );
                    if (!isPlayer)
                        return Results.Unauthorized();

                    var now = DateTimeOffset.UtcNow;
                    var pastEpisodes = game.Episodes.Where(e => now > e.Deadline).ToList();

                    if (pastEpisodes.Count == 0)
                        return Results.Ok(Array.Empty<EpisodeStats>());

                    var allRankings = await db
                        .Rankings.Where(r => r.GameId == gameId)
                        .ToListAsync();

                    var result = pastEpisodes
                        .OrderBy(e => e.Number)
                        .Select(episode =>
                        {
                            var episodeRankings = allRankings
                                .Where(r => r.EpisodeNumber == episode.Number)
                                .ToList();

                            var eliminatedBefore = game
                                .Episodes.Where(e => e.Number < episode.Number)
                                .SelectMany(e => e.EliminatedContestantIds ?? [])
                                .ToHashSet();

                            var activeContestants = game
                                .Contestants.Where(c => !eliminatedBefore.Contains(c.Id))
                                .ToList();

                            var stats = activeContestants
                                .Select(contestant =>
                                {
                                    var ranks = episodeRankings
                                        .Select(r => r.ContestantIds.IndexOf(contestant.Id) + 1)
                                        .Where(rank => rank > 0)
                                        .ToList();

                                    var avgRank =
                                        ranks.Count > 0
                                            ? Math.Round(ranks.Average(), 1)
                                            : (double)activeContestants.Count;

                                    return new ContestantStats(
                                        contestant.Id,
                                        contestant.Name,
                                        avgRank,
                                        ranks.Count
                                    );
                                })
                                .OrderBy(s => s.AvgRank)
                                .ToList();

                            return new EpisodeStats(episode.Number, stats);
                        })
                        .ToList();

                    return Results.Ok(result);
                }
            )
            .WithName("GetSuspectStats")
            .WithTags("SuspectStats")
            .Produces<List<EpisodeStats>>();
    }

    private sealed record EpisodeStats(int EpisodeNumber, List<ContestantStats> Stats);

    private sealed record ContestantStats(
        string ContestantId,
        string Name,
        double AvgRank,
        int RankingCount
    );
}
