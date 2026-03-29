using Api.Auth;
using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Routes;

public static class EpisodeRoutes
{
    public static void MapEpisodeRoutes(this WebApplication app)
    {
        app.MapPost(
                "/api/games/{gameId}/episodes",
                async (
                    HttpContext ctx,
                    AppDbContext db,
                    string gameId,
                    CreateEpisodeRequest body
                ) =>
                {
                    var user = AuthHelper.GetUserInfo(ctx);
                    if (user == null)
                        return Results.Unauthorized();

                    var game = await db.Games.FindAsync(gameId);
                    if (game == null)
                        return Results.NotFound();

                    if (game.AdminUserId != user.UserId)
                        return Results.Unauthorized();

                    int nextNumber =
                        game.Episodes.Count > 0 ? game.Episodes.Max(e => e.Number) + 1 : 1;

                    var eliminatedIds = body.EliminatedContestantIds ?? [];

                    var episode = new Episode
                    {
                        Number = nextNumber,
                        Deadline = body.Deadline,
                        EliminatedContestantIds = eliminatedIds,
                    };

                    foreach (var eliminatedId in eliminatedIds)
                    {
                        var contestant = game.Contestants.FirstOrDefault(c => c.Id == eliminatedId);
                        if (contestant != null)
                            contestant.EliminatedInEpisode = nextNumber;
                    }

                    game.Episodes.Add(episode);

                    // Copy forward rankings from the previous episode, excluding newly eliminated contestants
                    int prevNumber = nextNumber - 1;
                    if (prevNumber >= 1)
                    {
                        var prevRankings = await db
                            .Rankings.Where(r =>
                                r.GameId == gameId && r.EpisodeNumber == prevNumber
                            )
                            .ToListAsync();

                        var allEliminated = game
                            .Episodes.SelectMany(e => e.EliminatedContestantIds ?? [])
                            .ToHashSet();

                        foreach (var prev in prevRankings)
                        {
                            db.Rankings.Add(
                                new Ranking
                                {
                                    GameId = gameId,
                                    EpisodeNumber = nextNumber,
                                    UserId = prev.UserId,
                                    ContestantIds = prev
                                        .ContestantIds.Where(id => !allEliminated.Contains(id))
                                        .ToList(),
                                }
                            );
                        }
                    }

                    await db.SaveChangesAsync();

                    return Results.Ok(episode);
                }
            )
            .WithName("CreateEpisode")
            .WithTags("Episodes")
            .Produces<Episode>();

        app.MapPut(
                "/api/games/{gameId}/episodes/{episodeNumber:int}",
                async (
                    HttpContext ctx,
                    AppDbContext db,
                    string gameId,
                    int episodeNumber,
                    UpdateEpisodeRequest body
                ) =>
                {
                    var user = AuthHelper.GetUserInfo(ctx);
                    if (user == null)
                        return Results.Unauthorized();

                    var game = await db.Games.FindAsync(gameId);
                    if (game == null)
                        return Results.NotFound();

                    if (game.AdminUserId != user.UserId)
                        return Results.Unauthorized();

                    var episode = game.Episodes.FirstOrDefault(e => e.Number == episodeNumber);
                    if (episode == null)
                        return Results.NotFound(new { error = "Episode not found." });

                    if (body.Deadline.HasValue)
                        episode.Deadline = body.Deadline.Value;

                    if (body.EliminatedContestantIds != null)
                    {
                        // Clear EliminatedInEpisode for previously eliminated contestants
                        foreach (
                            var c in game.Contestants.Where(c =>
                                c.EliminatedInEpisode == episodeNumber
                            )
                        )
                            c.EliminatedInEpisode = null;

                        episode.EliminatedContestantIds = body.EliminatedContestantIds;

                        foreach (var eliminatedId in body.EliminatedContestantIds)
                        {
                            var contestant = game.Contestants.FirstOrDefault(c =>
                                c.Id == eliminatedId
                            );
                            if (contestant != null)
                                contestant.EliminatedInEpisode = episodeNumber;
                        }
                    }

                    await db.SaveChangesAsync();
                    return Results.Ok(episode);
                }
            )
            .WithName("UpdateEpisode")
            .WithTags("Episodes")
            .Produces<Episode>();

        app.MapDelete(
                "/api/games/{gameId}/episodes/{episodeNumber:int}",
                async (HttpContext ctx, AppDbContext db, string gameId, int episodeNumber) =>
                {
                    var user = AuthHelper.GetUserInfo(ctx);
                    if (user == null)
                        return Results.Unauthorized();

                    var game = await db.Games.FindAsync(gameId);
                    if (game == null)
                        return Results.NotFound();

                    if (game.AdminUserId != user.UserId)
                        return Results.Unauthorized();

                    var episode = game.Episodes.FirstOrDefault(e => e.Number == episodeNumber);
                    if (episode == null)
                        return Results.NotFound(new { error = "Episode not found." });

                    foreach (var eliminatedId in episode.EliminatedContestantIds ?? [])
                    {
                        var contestant = game.Contestants.FirstOrDefault(c => c.Id == eliminatedId);
                        if (contestant != null)
                            contestant.EliminatedInEpisode = null;
                    }

                    game.Episodes.Remove(episode);

                    var rankings = db.Rankings.Where(r =>
                        r.GameId == gameId && r.EpisodeNumber == episodeNumber
                    );
                    db.Rankings.RemoveRange(rankings);

                    await db.SaveChangesAsync();

                    return Results.NoContent();
                }
            )
            .WithName("DeleteEpisode")
            .WithTags("Episodes");

        app.MapPost(
                "/api/games/{gameId}/reveal-mole",
                async (HttpContext ctx, AppDbContext db, string gameId, RevealMoleRequest body) =>
                {
                    var user = AuthHelper.GetUserInfo(ctx);
                    if (user == null)
                        return Results.Unauthorized();

                    var game = await db.Games.FindAsync(gameId);
                    if (game == null)
                        return Results.NotFound();

                    if (game.AdminUserId != user.UserId)
                        return Results.Unauthorized();

                    if (string.IsNullOrWhiteSpace(body.MoleContestantId))
                        return Results.BadRequest(new { error = "MoleContestantId is required." });

                    if (!game.Contestants.Any(c => c.Id == body.MoleContestantId))
                        return Results.BadRequest(new { error = "Contestant not found." });

                    game.MoleContestantId = body.MoleContestantId;
                    await db.SaveChangesAsync();

                    return Results.Ok(
                        new RevealMoleResponse("Mole revealed.", game.MoleContestantId)
                    );
                }
            )
            .WithName("RevealMole")
            .WithTags("Episodes")
            .Produces<RevealMoleResponse>();
    }

    private sealed record CreateEpisodeRequest(
        DateTimeOffset Deadline,
        List<string>? EliminatedContestantIds
    );

    private sealed record UpdateEpisodeRequest(
        DateTimeOffset? Deadline,
        List<string>? EliminatedContestantIds
    );

    private sealed record RevealMoleRequest(string? MoleContestantId);

    private sealed record RevealMoleResponse(string Message, string MoleContestantId);
}
