using Api.Auth;
using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Routes;

public static class RankingRoutes
{
    public static void MapRankingRoutes(this WebApplication app)
    {
        app.MapPost(
                "/api/games/{gameId}/episodes/{episodeNumber:int}/rankings",
                async (
                    HttpContext ctx,
                    AppDbContext db,
                    string gameId,
                    int episodeNumber,
                    SubmitRankingRequest body
                ) =>
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

                    var episode = game.Episodes.FirstOrDefault(e => e.Number == episodeNumber);
                    if (episode == null)
                        return Results.NotFound(new { error = "Episode not found." });

                    if (DateTimeOffset.UtcNow > episode.Deadline)
                        return Results.BadRequest(
                            new { error = "Deadline has passed for this episode." }
                        );

                    if (body.ContestantIds == null || body.ContestantIds.Count == 0)
                        return Results.BadRequest(new { error = "ContestantIds are required." });

                    var eliminatedBeforeThisEpisode = game
                        .Episodes.Where(e => e.Number < episodeNumber)
                        .SelectMany(e => e.EliminatedContestantIds ?? [])
                        .ToHashSet();
                    var activeContestantIds = game
                        .Contestants.Select(c => c.Id)
                        .Where(id => !eliminatedBeforeThisEpisode.Contains(id))
                        .ToHashSet();
                    if (!body.ContestantIds.ToHashSet().SetEquals(activeContestantIds))
                        return Results.BadRequest(
                            new { error = "Je rangschikking bevat niet de juiste kandidaten." }
                        );

                    var ranking = await db.Rankings.FirstOrDefaultAsync(r =>
                        r.GameId == gameId
                        && r.EpisodeNumber == episodeNumber
                        && r.UserId == user.UserId
                    );

                    if (ranking == null)
                    {
                        ranking = new Ranking
                        {
                            GameId = gameId,
                            EpisodeNumber = episodeNumber,
                            UserId = user.UserId,
                        };
                        db.Rankings.Add(ranking);
                    }

                    ranking.ContestantIds = body.ContestantIds;
                    ranking.SubmittedAt = DateTimeOffset.UtcNow;

                    await db.SaveChangesAsync();
                    return Results.Ok(ranking);
                }
            )
            .WithName("SubmitRanking")
            .WithTags("Rankings")
            .Produces<Ranking>();

        app.MapGet(
                "/api/games/{gameId}/episodes/{episodeNumber:int}/rankings",
                async (HttpContext ctx, AppDbContext db, string gameId, int episodeNumber) =>
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

                    var episode = game.Episodes.FirstOrDefault(e => e.Number == episodeNumber);
                    if (episode == null)
                        return Results.NotFound(new { error = "Episode not found." });

                    if (DateTimeOffset.UtcNow <= episode.Deadline)
                        return Results.BadRequest(
                            new { error = "Rangschikkingen zijn pas zichtbaar na de deadline." }
                        );

                    var rankings = await db
                        .Rankings.Where(r => r.GameId == gameId && r.EpisodeNumber == episodeNumber)
                        .ToListAsync();

                    var userIds = rankings.Select(r => r.UserId).ToList();
                    var players = await db
                        .Players.Where(p => p.GameId == gameId && userIds.Contains(p.UserId))
                        .ToListAsync();

                    var result = rankings
                        .Select(r => new PlayerRankingResponse(
                            r.UserId,
                            players.FirstOrDefault(p => p.UserId == r.UserId)?.DisplayName
                                ?? r.UserId,
                            r.ContestantIds,
                            r.SubmittedAt
                        ))
                        .ToList();

                    return Results.Ok(result);
                }
            )
            .WithName("GetEpisodeRankings")
            .WithTags("Rankings")
            .Produces<List<PlayerRankingResponse>>();

        app.MapGet(
                "/api/games/{gameId}/episodes/{episodeNumber:int}/rankings/mine",
                async (HttpContext ctx, AppDbContext db, string gameId, int episodeNumber) =>
                {
                    var user = AuthHelper.GetUserInfo(ctx);
                    if (user == null)
                        return Results.Unauthorized();

                    var ranking = await db.Rankings.FirstOrDefaultAsync(r =>
                        r.GameId == gameId
                        && r.EpisodeNumber == episodeNumber
                        && r.UserId == user.UserId
                    );

                    return ranking == null ? Results.NotFound() : Results.Ok(ranking);
                }
            )
            .WithName("GetMyRanking")
            .WithTags("Rankings")
            .Produces<Ranking>();

        app.MapGet(
                "/api/games/{gameId}/rankings",
                async (HttpContext ctx, AppDbContext db, string gameId) =>
                {
                    var user = AuthHelper.GetUserInfo(ctx);
                    if (user == null)
                        return Results.Unauthorized();

                    var rankings = await db
                        .Rankings.Where(r => r.GameId == gameId && r.UserId == user.UserId)
                        .OrderBy(r => r.EpisodeNumber)
                        .ToListAsync();

                    return Results.Ok(rankings);
                }
            )
            .WithName("GetMyRankings")
            .WithTags("Rankings")
            .Produces<List<Ranking>>();
    }

    private sealed record SubmitRankingRequest(List<string>? ContestantIds);

    private sealed record PlayerRankingResponse(
        string UserId,
        string DisplayName,
        List<string> ContestantIds,
        DateTimeOffset SubmittedAt
    );
}
