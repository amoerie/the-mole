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

                    var allMessages = (
                        await db.Messages.Where(m => m.GameId == gameId).ToListAsync()
                    )
                        .OrderBy(m => m.PostedAt)
                        .ToList();

                    var total = allMessages.Count;
                    var page = allMessages.Skip(skip).Take(PageSize).ToList();

                    return Results.Ok(new MessagesResponse(page, total > skip + PageSize));
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

                    if (string.IsNullOrWhiteSpace(body.Content))
                        return Results.BadRequest(new { error = "Content is required." });

                    if (body.Content.Length > 500)
                        return Results.BadRequest(
                            new { error = "Content must be 500 characters or fewer." }
                        );

                    var message = new Message
                    {
                        GameId = gameId,
                        UserId = user.UserId,
                        DisplayName = user.DisplayName,
                        Content = body.Content.Trim(),
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
