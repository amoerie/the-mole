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

                    // Project summary fields only (no HtmlBody/TextBody) to avoid loading
                    // large bodies for all rows. Sort client-side: SQLite stores DateTimeOffset
                    // as ISO 8601 text, which sorts correctly as a string, but EF Core's SQLite
                    // provider cannot translate DateTimeOffset in ORDER BY to SQL.
                    var total = await db.EmailLogs.CountAsync();
                    var items = (
                        await db
                            .EmailLogs.Select(e => new
                            {
                                e.Id,
                                e.SentAt,
                                e.ToEmail,
                                e.ToName,
                                e.Subject,
                                e.Type,
                                e.Success,
                                e.ErrorMessage,
                            })
                            .ToListAsync()
                    ).OrderByDescending(e => e.SentAt).Skip((page - 1) * pageSize).Take(pageSize).Select(e => new EmailLogSummaryResponse(e.Id, e.SentAt, e.ToEmail, e.ToName, e.Subject, e.Type, e.Success, e.ErrorMessage)).ToList();

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

                    // Redact body content for password-reset emails: the HTML contains the
                    // raw reset URL/token and should not be exposed via this endpoint.
                    var isPasswordReset = log.Type == EmailType.PasswordReset;
                    return Results.Ok(
                        new EmailLogDetailResponse(
                            log.Id,
                            log.SentAt,
                            log.ToEmail,
                            log.ToName,
                            log.Subject,
                            isPasswordReset ? "[redacted]" : log.HtmlBody,
                            isPasswordReset ? "[redacted]" : log.TextBody,
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
                    SendReminderRequest req,
                    CancellationToken ct
                ) =>
                {
                    var caller = AuthHelper.GetUserInfo(ctx);
                    if (caller == null)
                        return Results.Unauthorized();
                    if (!caller.Roles.Contains("admin"))
                        return Results.Forbid();

                    if (string.IsNullOrWhiteSpace(req.UserId))
                        return Results.BadRequest(new ErrorResponse("UserId is verplicht."));

                    var user = await db.AppUsers.FindAsync([req.UserId], ct);
                    if (user == null)
                        return Results.NotFound(new ErrorResponse("Gebruiker niet gevonden."));

                    var baseUrl = (config["BaseUrl"] ?? "").TrimEnd('/');
                    var recipient = await query.GetRecipientForUserAsync(user.Id, baseUrl, ct);
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

                    // Password-reset tokens expire quickly and contain sensitive reset URLs;
                    // retrying them is not useful and would re-expose the token.
                    if (log.Type == EmailType.PasswordReset)
                        return Results.BadRequest(
                            new ErrorResponse(
                                "Wachtwoord-reset e-mails kunnen niet opnieuw worden verstuurd."
                            )
                        );

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
