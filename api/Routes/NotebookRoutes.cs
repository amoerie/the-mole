using Api.Auth;
using Api.Data;
using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Routes;

public static class NotebookRoutes
{
    private static readonly HashSet<string> ValidColors =
    [
        "red",
        "orange",
        "yellow",
        "green",
        "teal",
        "blue",
        "purple",
        "pink",
    ];

    public static void MapNotebookRoutes(this WebApplication app)
    {
        app.MapGet(
                "/api/games/{gameId}/molboekje",
                async (HttpContext ctx, AppDbContext db, string gameId) =>
                {
                    var user = AuthHelper.GetUserInfo(ctx);
                    if (user == null)
                        return Results.Unauthorized();

                    var game = await db.Games.FindAsync(gameId);
                    if (game == null)
                        return Results.NotFound();

                    var player = await db.Players.FirstOrDefaultAsync(p =>
                        p.GameId == gameId && p.UserId == user.UserId
                    );
                    if (player == null)
                        return Results.Unauthorized();

                    var notes = await db
                        .NotebookNotes.Where(n => n.GameId == gameId && n.UserId == user.UserId)
                        .OrderBy(n => n.EpisodeNumber)
                        .ToListAsync();

                    return Results.Ok(
                        new NotebookResponse(
                            player.NotebookColor,
                            notes
                                .Select(n => new NoteResponse(
                                    n.EpisodeNumber,
                                    n.Content,
                                    n.SuspicionLevels,
                                    n.UpdatedAt
                                ))
                                .ToList()
                        )
                    );
                }
            )
            .WithName("GetNotebook")
            .WithTags("Notebook")
            .Produces<NotebookResponse>();

        app.MapPut(
                "/api/games/{gameId}/molboekje/notes/{episodeNumber:int}",
                async (
                    HttpContext ctx,
                    AppDbContext db,
                    string gameId,
                    int episodeNumber,
                    SaveNoteRequest body
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
                        return Results.UnprocessableEntity(
                            new { error = "Aflevering bestaat niet." }
                        );

                    if (body.Content.Length > 5000)
                        return Results.UnprocessableEntity(
                            new { error = "Notities mogen maximaal 5000 tekens bevatten." }
                        );

                    var validIds = game.Contestants.Select(c => c.Id).ToHashSet();
                    foreach (var (id, level) in body.SuspicionLevels)
                    {
                        if (!validIds.Contains(id))
                            return Results.UnprocessableEntity(
                                new { error = $"Onbekende kandidaat: {id}" }
                            );
                        if (level < 1 || level > 5)
                            return Results.UnprocessableEntity(
                                new { error = "Verdachtigheidsniveau moet tussen 1 en 5 zijn." }
                            );
                    }

                    var note = await db.NotebookNotes.FirstOrDefaultAsync(n =>
                        n.GameId == gameId
                        && n.UserId == user.UserId
                        && n.EpisodeNumber == episodeNumber
                    );

                    if (note == null)
                    {
                        note = new NotebookNote
                        {
                            GameId = gameId,
                            UserId = user.UserId,
                            EpisodeNumber = episodeNumber,
                        };
                        db.NotebookNotes.Add(note);
                    }

                    note.Content = body.Content;
                    note.SuspicionLevels = body.SuspicionLevels;
                    note.UpdatedAt = DateTimeOffset.UtcNow;

                    await db.SaveChangesAsync();
                    return Results.NoContent();
                }
            )
            .WithName("SaveNote")
            .WithTags("Notebook")
            .Produces(StatusCodes.Status204NoContent);

        app.MapPatch(
                "/api/games/{gameId}/molboekje/color",
                async (
                    HttpContext ctx,
                    AppDbContext db,
                    string gameId,
                    UpdateNotebookColorRequest body
                ) =>
                {
                    var user = AuthHelper.GetUserInfo(ctx);
                    if (user == null)
                        return Results.Unauthorized();

                    var game = await db.Games.FindAsync(gameId);
                    if (game == null)
                        return Results.NotFound();

                    var player = await db.Players.FirstOrDefaultAsync(p =>
                        p.GameId == gameId && p.UserId == user.UserId
                    );
                    if (player == null)
                        return Results.Unauthorized();

                    if (!ValidColors.Contains(body.Color))
                        return Results.UnprocessableEntity(new { error = "Ongeldige kleur." });

                    player.NotebookColor = body.Color;
                    await db.SaveChangesAsync();
                    return Results.NoContent();
                }
            )
            .WithName("UpdateNotebookColor")
            .WithTags("Notebook")
            .Produces(StatusCodes.Status204NoContent);
    }

    private sealed record SaveNoteRequest(string Content, Dictionary<string, int> SuspicionLevels);

    private sealed record UpdateNotebookColorRequest(string Color);

    private sealed record NoteResponse(
        int EpisodeNumber,
        string Content,
        Dictionary<string, int> SuspicionLevels,
        DateTimeOffset UpdatedAt
    );

    private sealed record NotebookResponse(string? NotebookColor, List<NoteResponse> Notes);
}
