using Api.Auth;
using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Routes;

public static class GameRoutes
{
    public static void MapGameRoutes(this WebApplication app)
    {
        app.MapPost(
            "/api/games",
            async (HttpContext ctx, AppDbContext db, CreateGameRequest body) =>
            {
                var user = AuthHelper.GetUserInfo(ctx);
                if (user == null)
                    return Results.Unauthorized();

                if (string.IsNullOrWhiteSpace(body.Name))
                    return Results.BadRequest(new { error = "Name is required." });

                var game = new Game
                {
                    Name = body.Name,
                    AdminUserId = user.UserId,
                    Contestants = body.Contestants ?? [],
                };

                db.Games.Add(game);

                db.Players.Add(
                    new Player
                    {
                        GameId = game.Id,
                        UserId = user.UserId,
                        DisplayName = user.DisplayName,
                    }
                );

                await db.SaveChangesAsync();
                return Results.Ok(game);
            }
        );

        app.MapGet(
            "/api/games/{gameId}",
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

                return Results.Ok(game);
            }
        );

        app.MapPost(
            "/api/games/{gameId}/join",
            async (HttpContext ctx, AppDbContext db, string gameId, JoinGameRequest body) =>
            {
                var user = AuthHelper.GetUserInfo(ctx);
                if (user == null)
                    return Results.Unauthorized();

                if (string.IsNullOrWhiteSpace(body.InviteCode))
                    return Results.BadRequest(new { error = "Invite code is required." });

                var game = await db.Games.FindAsync(gameId);
                if (game == null)
                    return Results.NotFound();

                if (
                    !string.Equals(
                        game.InviteCode,
                        body.InviteCode,
                        StringComparison.OrdinalIgnoreCase
                    )
                )
                    return Results.BadRequest(new { error = "Invalid invite code." });

                var alreadyJoined = await db.Players.AnyAsync(p =>
                    p.GameId == gameId && p.UserId == user.UserId
                );

                if (alreadyJoined)
                    return Results.Ok(new { message = "Already joined." });

                db.Players.Add(
                    new Player
                    {
                        GameId = gameId,
                        UserId = user.UserId,
                        DisplayName = user.DisplayName,
                    }
                );

                await db.SaveChangesAsync();
                return Results.Ok(new { message = "Joined successfully." });
            }
        );

        app.MapGet(
            "/api/games/by-invite/{inviteCode}",
            async (AppDbContext db, string inviteCode) =>
            {
                var game = await db.Games.FirstOrDefaultAsync(g => g.InviteCode == inviteCode);
                if (game == null)
                    return Results.NotFound();

                return Results.Ok(
                    new
                    {
                        game.Id,
                        game.Name,
                        ContestantCount = game.Contestants.Count,
                        EpisodeCount = game.Episodes.Count,
                    }
                );
            }
        );

        app.MapGet(
            "/api/my-games",
            async (HttpContext ctx, AppDbContext db) =>
            {
                var user = AuthHelper.GetUserInfo(ctx);
                if (user == null)
                    return Results.Unauthorized();

                var gameIds = await db
                    .Players.Where(p => p.UserId == user.UserId)
                    .Select(p => p.GameId)
                    .ToListAsync();

                var games = await db.Games.Where(g => gameIds.Contains(g.Id)).ToListAsync();

                return Results.Ok(games);
            }
        );

        app.MapPost(
            "/api/games/{gameId}/contestants",
            async (HttpContext ctx, AppDbContext db, string gameId, AddContestantsRequest body) =>
            {
                var user = AuthHelper.GetUserInfo(ctx);
                if (user == null)
                    return Results.Unauthorized();

                var game = await db.Games.FindAsync(gameId);
                if (game == null)
                    return Results.NotFound();

                if (game.AdminUserId != user.UserId)
                    return Results.Unauthorized();

                if (body.Contestants == null || body.Contestants.Count == 0)
                    return Results.BadRequest(
                        new { error = "At least one contestant is required." }
                    );

                foreach (var c in body.Contestants)
                {
                    if (string.IsNullOrWhiteSpace(c.Name))
                        return Results.BadRequest(new { error = "Contestant name is required." });

                    if (string.IsNullOrWhiteSpace(c.Id))
                        c.Id = Guid.NewGuid().ToString();
                }

                game.Contestants.AddRange(body.Contestants);
                await db.SaveChangesAsync();

                return Results.Ok(game);
            }
        );
    }

    private sealed record CreateGameRequest(string? Name, List<Contestant>? Contestants);

    private sealed record JoinGameRequest(string? InviteCode);

    private sealed record AddContestantsRequest(List<Contestant>? Contestants);
}
