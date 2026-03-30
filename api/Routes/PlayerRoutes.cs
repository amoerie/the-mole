using Api.Auth;
using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Routes;

public static class PlayerRoutes
{
    public static void MapPlayerRoutes(this WebApplication app)
    {
        app.MapGet(
                "/api/games/{gameId}/players",
                async (HttpContext ctx, AppDbContext db, string gameId) =>
                {
                    var user = AuthHelper.GetUserInfo(ctx);
                    if (user == null)
                        return Results.Unauthorized();

                    var game = await db.Games.FindAsync(gameId);
                    if (game == null)
                        return Results.NotFound();

                    var isAdmin = game.AdminUserId == user.UserId;
                    var isPlayer = await db.Players.AnyAsync(p =>
                        p.GameId == gameId && p.UserId == user.UserId
                    );

                    if (!isAdmin && !isPlayer)
                        return Results.Unauthorized();

                    // OrderBy is applied after ToListAsync because SQLite does not support
                    // DateTimeOffset ordering natively at the database level.
                    var players = (await db.Players.Where(p => p.GameId == gameId).ToListAsync())
                        .OrderBy(p => p.JoinedAt)
                        .ToList();

                    return Results.Ok(players);
                }
            )
            .WithName("GetGamePlayers")
            .WithTags("Players")
            .Produces<List<Player>>();
    }
}
