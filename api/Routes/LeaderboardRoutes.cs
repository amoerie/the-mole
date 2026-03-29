using Api.Auth;
using Api.Data;
using Api.Models;
using Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Api.Routes;

public static class LeaderboardRoutes
{
    public static void MapLeaderboardRoutes(this WebApplication app)
    {
        app.MapGet(
                "/api/games/{gameId}/leaderboard",
                async (HttpContext ctx, AppDbContext db, string gameId) =>
                {
                    var user = AuthHelper.GetUserInfo(ctx);
                    if (user == null)
                        return Results.Unauthorized();

                    var game = await db.Games.FindAsync(gameId);
                    if (game == null)
                        return Results.NotFound();

                    if (string.IsNullOrEmpty(game.MoleContestantId))
                        return Results.BadRequest(
                            new { error = "The mole has not been revealed yet." }
                        );

                    var players = await db.Players.Where(p => p.GameId == gameId).ToListAsync();
                    var rankings = await db.Rankings.Where(r => r.GameId == gameId).ToListAsync();

                    var leaderboard = ScoringService.CalculateLeaderboard(game, players, rankings);
                    return Results.Ok(leaderboard);
                }
            )
            .WithName("GetLeaderboard")
            .WithTags("Leaderboard")
            .Produces<List<LeaderboardEntry>>();

        app.MapGet(
                "/api/games/{gameId}/leaderboard/what-if/{contestantId}",
                async (HttpContext ctx, AppDbContext db, string gameId, string contestantId) =>
                {
                    var user = AuthHelper.GetUserInfo(ctx);
                    if (user == null)
                        return Results.Unauthorized();

                    var game = await db.Games.FindAsync(gameId);
                    if (game == null)
                        return Results.NotFound();

                    if (!game.Contestants.Any(c => c.Id == contestantId))
                        return Results.BadRequest(new { error = "Contestant not found." });

                    var players = await db.Players.Where(p => p.GameId == gameId).ToListAsync();
                    var rankings = await db.Rankings.Where(r => r.GameId == gameId).ToListAsync();

                    var leaderboard = ScoringService.CalculateWhatIfLeaderboard(
                        game,
                        players,
                        rankings,
                        contestantId
                    );
                    return Results.Ok(leaderboard);
                }
            )
            .WithName("GetWhatIfLeaderboard")
            .WithTags("Leaderboard")
            .Produces<List<LeaderboardEntry>>();
    }
}
