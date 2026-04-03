using System.Security.Cryptography;
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

                    if (!user.Roles.Contains("admin"))
                        return Results.Forbid();

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
            )
            .WithName("CreateGame")
            .WithTags("Games")
            .Produces<Game>();

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
            )
            .WithName("GetGame")
            .WithTags("Games")
            .Produces<Game>();

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
                        return Results.Ok(new MessageResponse("Already joined."));

                    db.Players.Add(
                        new Player
                        {
                            GameId = gameId,
                            UserId = user.UserId,
                            DisplayName = user.DisplayName,
                        }
                    );

                    await db.SaveChangesAsync();
                    return Results.Ok(new MessageResponse("Joined successfully."));
                }
            )
            .WithName("JoinGame")
            .WithTags("Games")
            .Produces<MessageResponse>();

        app.MapGet(
                "/api/games/by-invite/{inviteCode}",
                async (AppDbContext db, string inviteCode) =>
                {
                    var game = await db.Games.FirstOrDefaultAsync(g => g.InviteCode == inviteCode);
                    if (game == null)
                        return Results.NotFound();

                    return Results.Ok(
                        new GameSummaryResponse(
                            game.Id,
                            game.Name,
                            game.Contestants.Count,
                            game.Episodes.Count
                        )
                    );
                }
            )
            .WithName("GetGameByInvite")
            .WithTags("Games")
            .RequireRateLimiting("inviteCode")
            .Produces<GameSummaryResponse>();

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

                    var playerCounts = await db
                        .Players.Where(p => gameIds.Contains(p.GameId))
                        .GroupBy(p => p.GameId)
                        .Select(g => new { GameId = g.Key, Count = g.Count() })
                        .ToDictionaryAsync(x => x.GameId, x => x.Count);

                    foreach (var game in games)
                        game.PlayerCount = playerCounts.GetValueOrDefault(game.Id, 0);

                    return Results.Ok(games);
                }
            )
            .WithName("GetMyGames")
            .WithTags("Games")
            .Produces<List<Game>>();

        app.MapDelete(
                "/api/games/{gameId}",
                async (HttpContext ctx, AppDbContext db, string gameId) =>
                {
                    var user = AuthHelper.GetUserInfo(ctx);
                    if (user == null)
                        return Results.Unauthorized();

                    var game = await db.Games.FindAsync(gameId);
                    if (game == null)
                        return Results.NotFound();

                    if (game.AdminUserId != user.UserId)
                        return Results.Forbid();

                    var rankings = await db.Rankings.Where(r => r.GameId == gameId).ToListAsync();
                    db.Rankings.RemoveRange(rankings);

                    var players = await db.Players.Where(p => p.GameId == gameId).ToListAsync();
                    db.Players.RemoveRange(players);

                    db.Games.Remove(game);
                    await db.SaveChangesAsync();

                    return Results.NoContent();
                }
            )
            .WithName("DeleteGame")
            .WithTags("Games")
            .Produces(StatusCodes.Status204NoContent);

        app.MapPost(
                "/api/games/{gameId}/contestants",
                async (
                    HttpContext ctx,
                    AppDbContext db,
                    string gameId,
                    AddContestantsRequest body
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

                    if (body.Contestants == null || body.Contestants.Count == 0)
                        return Results.BadRequest(
                            new { error = "At least one contestant is required." }
                        );

                    foreach (var c in body.Contestants)
                    {
                        if (string.IsNullOrWhiteSpace(c.Name))
                            return Results.BadRequest(
                                new { error = "Contestant name is required." }
                            );

                        if (string.IsNullOrWhiteSpace(c.Id))
                            c.Id = Guid.NewGuid().ToString();
                    }

                    game.Contestants.AddRange(body.Contestants);
                    await db.SaveChangesAsync();

                    return Results.Ok(game);
                }
            )
            .WithName("AddContestants")
            .WithTags("Games")
            .Produces<Game>();

        app.MapPost(
                "/api/games/{gameId}/players/{userId}/password-reset-link",
                async (
                    HttpContext ctx,
                    AppDbContext db,
                    IConfiguration config,
                    string gameId,
                    string userId
                ) =>
                {
                    var caller = AuthHelper.GetUserInfo(ctx);
                    if (caller == null)
                        return Results.Unauthorized();

                    var game = await db.Games.FindAsync(gameId);
                    if (game == null)
                        return Results.NotFound(new { error = "Game not found." });

                    if (game.AdminUserId != caller.UserId)
                        return Results.Forbid();

                    if (userId == caller.UserId)
                        return Results.BadRequest(
                            new { error = "Je kunt geen herstellink voor jezelf aanmaken." }
                        );

                    var isPlayer = await db.Players.AnyAsync(p =>
                        p.GameId == gameId && p.UserId == userId
                    );
                    if (!isPlayer)
                        return Results.NotFound(
                            new { error = "Speler niet gevonden in dit spel." }
                        );

                    var targetUser = await db.AppUsers.FindAsync(userId);
                    if (targetUser == null)
                        return Results.NotFound(new { error = "Gebruiker niet gevonden." });

                    var tokenBytes = RandomNumberGenerator.GetBytes(32);
                    var token = Convert.ToHexString(tokenBytes);
                    var tokenHash = Convert.ToHexString(SHA256.HashData(tokenBytes));

                    targetUser.PasswordResetToken = tokenHash;
                    targetUser.PasswordResetTokenExpiry = DateTimeOffset.UtcNow.AddHours(24);
                    await db.SaveChangesAsync();

                    var baseUrl = (config["BaseUrl"] ?? "").TrimEnd('/');
                    var resetUrl = $"{baseUrl}/reset-password?token={token}";

                    return Results.Ok(new PasswordResetLinkResponse(resetUrl));
                }
            )
            .WithName("GeneratePasswordResetLink")
            .WithTags("Games")
            .Produces<PasswordResetLinkResponse>();
    }

    private sealed record CreateGameRequest(string? Name, List<Contestant>? Contestants);

    private sealed record JoinGameRequest(string? InviteCode);

    private sealed record AddContestantsRequest(List<Contestant>? Contestants);

    private sealed record MessageResponse(string Message);

    private sealed record PasswordResetLinkResponse(string ResetUrl);

    private sealed record GameSummaryResponse(
        string Id,
        string Name,
        int ContestantCount,
        int EpisodeCount
    );
}
