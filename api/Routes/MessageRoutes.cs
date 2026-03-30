using Api.Auth;
using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Routes;

public static class MessageRoutes
{
    private const int PageSize = 20;

    public static void MapMessageRoutes(this WebApplication app)
    {
        app.MapGet(
                "/api/games/{gameId}/messages",
                async (HttpContext ctx, AppDbContext db, string gameId, int skip = 0) =>
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

                    // Clamp negative skip values to 0
                    var normalizedSkip = Math.Max(0, skip);

                    // SQLite does not support ORDER BY on DateTimeOffset columns via EF Core,
                    // so we sort in memory. The PageSize+1 trick avoids a separate count query.
                    var candidates = (
                        await db
                            .Messages.AsNoTracking()
                            .Where(m => m.GameId == gameId)
                            .ToListAsync()
                    )
                        .OrderByDescending(m => m.PostedAt)
                        .Skip(normalizedSkip)
                        .Take(PageSize + 1)
                        .ToList();

                    var hasMore = candidates.Count > PageSize;
                    if (hasMore)
                        candidates.RemoveAt(PageSize);

                    return Results.Ok(new MessagesResponse(candidates, hasMore));
                }
            )
            .WithName("GetMessages")
            .WithTags("Messages")
            .Produces<MessagesResponse>();

        app.MapPost(
                "/api/games/{gameId}/messages",
                async (HttpContext ctx, AppDbContext db, string gameId, PostMessageRequest body) =>
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

                    // Trim first so validation reflects what will actually be stored
                    var trimmed = body.Content?.Trim() ?? string.Empty;

                    if (trimmed.Length == 0)
                        return Results.BadRequest(new { error = "Content is required." });

                    if (trimmed.Length > 500)
                        return Results.BadRequest(
                            new { error = "Content must be 500 characters or fewer." }
                        );

                    var message = new Message
                    {
                        GameId = gameId,
                        UserId = user.UserId,
                        DisplayName = user.DisplayName,
                        Content = trimmed,
                    };

                    db.Messages.Add(message);
                    await db.SaveChangesAsync();

                    return Results.Created($"/api/games/{gameId}/messages/{message.Id}", message);
                }
            )
            .WithName("PostMessage")
            .WithTags("Messages")
            .RequireRateLimiting("postMessage")
            .Produces<Message>(StatusCodes.Status201Created);
    }

    private sealed record PostMessageRequest(string? Content);

    private sealed record MessagesResponse(List<Message> Items, bool HasMore);
}
