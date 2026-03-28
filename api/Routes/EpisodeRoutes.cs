using Api.Auth;
using Api.Data;
using Api.Models;

namespace Api.Routes;

public static class EpisodeRoutes
{
    public static void MapEpisodeRoutes(this WebApplication app)
    {
        app.MapPost(
            "/api/games/{gameId}/episodes",
            async (HttpContext ctx, AppDbContext db, string gameId, CreateEpisodeRequest body) =>
            {
                var user = AuthHelper.GetUserInfo(ctx);
                if (user == null)
                    return Results.Unauthorized();

                var game = await db.Games.FindAsync(gameId);
                if (game == null)
                    return Results.NotFound();

                if (game.AdminUserId != user.UserId)
                    return Results.Unauthorized();

                int nextNumber = game.Episodes.Count > 0 ? game.Episodes.Max(e => e.Number) + 1 : 1;

                var episode = new Episode
                {
                    Number = nextNumber,
                    Deadline = body.Deadline,
                    EliminatedContestantId = body.EliminatedContestantId,
                };

                if (!string.IsNullOrEmpty(body.EliminatedContestantId))
                {
                    var contestant = game.Contestants.FirstOrDefault(c =>
                        c.Id == body.EliminatedContestantId
                    );
                    if (contestant != null)
                        contestant.EliminatedInEpisode = nextNumber;
                }

                game.Episodes.Add(episode);
                await db.SaveChangesAsync();

                return Results.Ok(episode);
            }
        );

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

                if (body.EliminatedContestantId != null)
                {
                    var prevEliminated = game.Contestants.FirstOrDefault(c =>
                        c.EliminatedInEpisode == episodeNumber
                    );
                    if (prevEliminated != null)
                        prevEliminated.EliminatedInEpisode = null;

                    episode.EliminatedContestantId = body.EliminatedContestantId;

                    if (!string.IsNullOrEmpty(body.EliminatedContestantId))
                    {
                        var contestant = game.Contestants.FirstOrDefault(c =>
                            c.Id == body.EliminatedContestantId
                        );
                        if (contestant != null)
                            contestant.EliminatedInEpisode = episodeNumber;
                    }
                }

                await db.SaveChangesAsync();
                return Results.Ok(episode);
            }
        );

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

                return Results.Ok(new { message = "Mole revealed.", game.MoleContestantId });
            }
        );
    }

    private sealed record CreateEpisodeRequest(
        DateTimeOffset Deadline,
        string? EliminatedContestantId
    );

    private sealed record UpdateEpisodeRequest(
        DateTimeOffset? Deadline,
        string? EliminatedContestantId
    );

    private sealed record RevealMoleRequest(string? MoleContestantId);
}
