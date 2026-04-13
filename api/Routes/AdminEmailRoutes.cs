using Api.Auth;
using Api.Data;
using Api.Models;
using Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Api.Routes;

public static class AdminEmailRoutes
{
    public static void MapAdminEmailRoutes(this WebApplication app)
    {
        app.MapGet(
                "/api/admin/emails",
                async (HttpContext ctx, AppDbContext db, int page = 1, int pageSize = 50) =>
                {
                    var caller = AuthHelper.GetUserInfo(ctx);
                    if (caller == null)
                        return Results.Unauthorized();
                    if (!caller.Roles.Contains("admin"))
                        return Results.Forbid();

                    pageSize = Math.Clamp(pageSize, 1, 200);
                    page = Math.Max(1, page);

                    // Load all logs and sort client-side; SQLite does not support
                    // DateTimeOffset in ORDER BY clauses via EF Core.
                    var all = await db.EmailLogs.ToListAsync();
                    var total = all.Count;
                    var items = all.OrderByDescending(e => e.SentAt)
                        .Skip((page - 1) * pageSize)
                        .Take(pageSize)
                        .Select(e => new EmailLogSummaryResponse(
                            e.Id,
                            e.SentAt,
                            e.ToEmail,
                            e.ToName,
                            e.Subject,
                            e.Type,
                            e.Success,
                            e.ErrorMessage
                        ))
                        .ToList();

                    return Results.Ok(new EmailLogPageResponse(total, page, pageSize, items));
                }
            )
            .WithName("ListEmailLogs")
            .WithTags("AdminEmail")
            .Produces<EmailLogPageResponse>();

        app.MapGet(
                "/api/admin/emails/{id}",
                async (HttpContext ctx, AppDbContext db, string id) =>
                {
                    var caller = AuthHelper.GetUserInfo(ctx);
                    if (caller == null)
                        return Results.Unauthorized();
                    if (!caller.Roles.Contains("admin"))
                        return Results.Forbid();

                    var log = await db.EmailLogs.FindAsync(id);
                    if (log == null)
                        return Results.NotFound();

                    return Results.Ok(
                        new EmailLogDetailResponse(
                            log.Id,
                            log.SentAt,
                            log.ToEmail,
                            log.ToName,
                            log.Subject,
                            log.HtmlBody,
                            log.TextBody,
                            log.Type,
                            log.Success,
                            log.ErrorMessage
                        )
                    );
                }
            )
            .WithName("GetEmailLog")
            .WithTags("AdminEmail")
            .Produces<EmailLogDetailResponse>();

        app.MapPost(
                "/api/admin/emails/send-reminder",
                async (
                    HttpContext ctx,
                    AppDbContext db,
                    IPendingReminderQuery query,
                    IEmailService emailService,
                    IConfiguration config,
                    SendReminderRequest req
                ) =>
                {
                    var caller = AuthHelper.GetUserInfo(ctx);
                    if (caller == null)
                        return Results.Unauthorized();
                    if (!caller.Roles.Contains("admin"))
                        return Results.Forbid();

                    var user = await db.AppUsers.FindAsync(req.UserId);
                    if (user == null)
                        return Results.NotFound(new ErrorResponse("Gebruiker niet gevonden."));

                    var baseUrl = (config["BaseUrl"] ?? "").TrimEnd('/');
                    var recipient = await query.GetRecipientForUserAsync(user.Id, baseUrl, default);
                    if (recipient == null)
                        return Results.BadRequest(
                            new ErrorResponse("Geen open afleveringen gevonden voor deze speler.")
                        );

                    await emailService.SendRankingReminderAsync(
                        recipient.Email,
                        recipient.DisplayName,
                        recipient.Games
                    );

                    return Results.Ok(new SendReminderResponse(user.Email));
                }
            )
            .WithName("SendReminderEmail")
            .WithTags("AdminEmail")
            .Produces<SendReminderResponse>();

        app.MapPost(
                "/api/admin/emails/{id}/retry",
                async (HttpContext ctx, AppDbContext db, IEmailService emailService, string id) =>
                {
                    var caller = AuthHelper.GetUserInfo(ctx);
                    if (caller == null)
                        return Results.Unauthorized();
                    if (!caller.Roles.Contains("admin"))
                        return Results.Forbid();

                    var log = await db.EmailLogs.FindAsync(id);
                    if (log == null)
                        return Results.NotFound();

                    await emailService.RetryAsync(
                        log.ToEmail,
                        log.ToName,
                        log.Subject,
                        log.TextBody,
                        log.HtmlBody,
                        log.Type
                    );

                    return Results.Ok(new RetryResponse(true));
                }
            )
            .WithName("RetryEmailLog")
            .WithTags("AdminEmail")
            .Produces<RetryResponse>();
    }

    internal sealed record EmailLogSummaryResponse(
        string Id,
        DateTimeOffset SentAt,
        string ToEmail,
        string ToName,
        string Subject,
        EmailType Type,
        bool Success,
        string? ErrorMessage
    );

    internal sealed record EmailLogDetailResponse(
        string Id,
        DateTimeOffset SentAt,
        string ToEmail,
        string ToName,
        string Subject,
        string HtmlBody,
        string TextBody,
        EmailType Type,
        bool Success,
        string? ErrorMessage
    );

    internal sealed record EmailLogPageResponse(
        int Total,
        int Page,
        int PageSize,
        List<EmailLogSummaryResponse> Items
    );

    internal sealed record SendReminderRequest(string UserId);

    internal sealed record SendReminderResponse(string SentTo);

    internal sealed record RetryResponse(bool Success);

    internal sealed record ErrorResponse(string Error);
}
