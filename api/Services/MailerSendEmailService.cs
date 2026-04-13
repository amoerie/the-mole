using System.Globalization;
using System.Text;
using System.Text.Json;
using Api.Data;
using Api.Models;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Services;

public sealed class MailerSendEmailService(
    IHttpClientFactory httpClientFactory,
    IConfiguration config,
    IServiceScopeFactory scopeFactory
) : IEmailService
{
    public async Task SendPasswordResetAsync(string toEmail, string displayName, string resetUrl)
    {
        var baseUrl = (config["BaseUrl"] ?? "").TrimEnd('/');
        var content = $"""
            <p style="margin:0 0 16px;font-size:16px;color:#e0e0e0;">Hallo {EscapeHtml(
                displayName
            )},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#e0e0e0;">
              We ontvingen een verzoek om het wachtwoord van je account te herstellen.
              Klik op de knop hieronder om een nieuw wachtwoord in te stellen.
            </p>
            <p style="margin:0 0 24px;text-align:center;">
              <a href="{resetUrl}"
                 style="display:inline-block;padding:12px 28px;background-color:#00ff41;color:#000;font-weight:700;font-size:15px;text-decoration:none;border-radius:6px;">
                Wachtwoord herstellen
              </a>
            </p>
            <p style="margin:0;font-size:13px;color:#888;">Deze link is 24 uur geldig. Als je dit verzoek niet hebt ingediend, kan je deze e-mail veilig negeren.</p>
            """;

        var html = BuildEmailHtml(baseUrl, content);
        var text =
            $"Hallo {displayName},\n\nKlik op de volgende link om je wachtwoord te herstellen:\n\n{resetUrl}\n\nDeze link is 24 uur geldig.";

        await SendAndLogAsync(
            toEmail,
            displayName,
            "Wachtwoord herstellen — Mollenjagers",
            text,
            html,
            EmailType.PasswordReset
        );
    }

    public async Task SendRankingReminderAsync(
        string toEmail,
        string displayName,
        IEnumerable<GameReminderInfo> games
    )
    {
        var baseUrl = (config["BaseUrl"] ?? "").TrimEnd('/');
        var gamesList = games.ToList();

        var gameBlocks = string.Join(
            "\n",
            gamesList.Select(g =>
            {
                var deadline = FormatDeadlineDutch(g.Deadline);
                var contestantRows = string.Join(
                    "\n",
                    g.RankedContestantNames.Select(
                        (name, i) =>
                            $"""
                            <tr>
                              <td style="padding:3px 0;font-size:14px;color:#e0e0e0;">
                                <span style="color:#00ff41;font-weight:700;margin-right:8px;">{i
                                + 1}.</span>{EscapeHtml(name)}
                              </td>
                            </tr>
                            """
                    )
                );

                return $"""
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #2a2a2a;">
                    <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#e0e0e0;">{EscapeHtml(
                    g.GameName
                )}</p>
                    <p style="margin:0 0 8px;font-size:13px;color:#888;">Deadline: {EscapeHtml(
                    deadline
                )}</p>
                    <table cellpadding="0" cellspacing="0" style="margin:0 0 10px;">
                      {contestantRows}
                    </table>
                    <a href="{g.GameUrl}"
                       style="display:inline-block;padding:7px 16px;background-color:#00ff41;color:#000;font-weight:700;font-size:13px;text-decoration:none;border-radius:5px;">
                      Wijzig rangschikking →
                    </a>
                  </td>
                </tr>
                """;
            })
        );

        var content = $"""
            <p style="margin:0 0 16px;font-size:16px;color:#e0e0e0;">Hallo {EscapeHtml(
                displayName
            )},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#e0e0e0;">
              Hieronder zie je je huidige rangschikking. Je kunt deze nog wijzigen vóór de deadline.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              {gameBlocks}
            </table>
            <p style="margin:0;font-size:13px;color:#888;">
              Je ontvangt deze herinnering elke zondag. Je kunt ze uitschakelen via je
              <a href="{baseUrl}/profile" style="color:#00cc33;">profielpagina</a>.
            </p>
            """;

        var html = BuildEmailHtml(baseUrl, content);

        var textGames = string.Join(
            "\n\n",
            gamesList.Select(g =>
            {
                var deadline = FormatDeadlineDutch(g.Deadline);
                var ranked = string.Join(
                    "\n",
                    g.RankedContestantNames.Select((n, i) => $"  {i + 1}. {n}")
                );
                return $"{g.GameName} (deadline: {deadline}):\n{ranked}\n{g.GameUrl}";
            })
        );
        var text =
            $"Hallo {displayName},\n\nHieronder zie je je huidige rangschikking:\n\n{textGames}\n\nJe kunt meldingen uitschakelen via {baseUrl}/profile.";

        await SendAndLogAsync(
            toEmail,
            displayName,
            "Jouw rangschikking voor deze week — Mollenjagers",
            text,
            html,
            EmailType.RankingReminder
        );
    }

    public async Task RetryAsync(
        string toEmail,
        string toName,
        string subject,
        string textBody,
        string htmlBody,
        EmailType type
    )
    {
        await SendAndLogAsync(toEmail, toName, subject, textBody, htmlBody, type);
    }

    private async Task SendAndLogAsync(
        string toEmail,
        string toName,
        string subject,
        string text,
        string html,
        EmailType type
    )
    {
        bool success = false;
        string? errorMessage = null;

        try
        {
            await PostToMailerSendAsync(toEmail, subject, text, html);
            success = true;
        }
        catch (Exception ex)
        {
            errorMessage = ex.Message;
            throw;
        }
        finally
        {
            await LogEmailAsync(toEmail, toName, subject, html, text, type, success, errorMessage);
        }
    }

    private async Task LogEmailAsync(
        string toEmail,
        string toName,
        string subject,
        string html,
        string text,
        EmailType type,
        bool success,
        string? errorMessage
    )
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.EmailLogs.Add(
                new EmailLog
                {
                    SentAt = DateTimeOffset.UtcNow,
                    ToEmail = toEmail,
                    ToName = toName,
                    Subject = subject,
                    HtmlBody = html,
                    TextBody = text,
                    Type = type,
                    Success = success,
                    ErrorMessage = errorMessage,
                }
            );
            await db.SaveChangesAsync();
        }
        catch
        {
            // Log failure must never mask the original exception
        }
    }

    private static string FormatDeadlineDutch(DateTimeOffset deadline)
    {
        TimeZoneInfo tz;
        try
        {
            tz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Brussels");
        }
        catch
        {
            tz = TimeZoneInfo.FindSystemTimeZoneById("Romance Standard Time");
        }

        var local = TimeZoneInfo.ConvertTimeFromUtc(deadline.UtcDateTime, tz);
        return local.ToString("dddd d MMMM 'om' HH:mm", new CultureInfo("nl-NL"));
    }

    private static string BuildEmailHtml(string baseUrl, string bodyContent) =>
        $"""
            <!DOCTYPE html>
            <html lang="nl">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width,initial-scale=1">
            </head>
            <body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;">
                <tr>
                  <td align="center" style="padding:32px 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
                      <!-- Header -->
                      <tr>
                        <td style="background-color:#141414;border:1px solid #2a2a2a;border-bottom:none;border-radius:8px 8px 0 0;padding:20px 24px;text-align:center;">
                          <img src="{baseUrl}/favicon.ico" alt="" width="20" height="20"
                               style="vertical-align:middle;margin-right:8px;display:inline-block;">
                          <span style="font-size:18px;font-weight:700;color:#00ff41;letter-spacing:0.08em;vertical-align:middle;">MOLLENJAGERS</span>
                        </td>
                      </tr>
                      <!-- Body -->
                      <tr>
                        <td style="background-color:#141414;border-left:1px solid #2a2a2a;border-right:1px solid #2a2a2a;padding:28px 24px;">
                          {bodyContent}
                        </td>
                      </tr>
                      <!-- Footer -->
                      <tr>
                        <td style="background-color:#0f0f0f;border:1px solid #2a2a2a;border-top:none;border-radius:0 0 8px 8px;padding:14px 24px;text-align:center;">
                          <p style="margin:0;font-size:12px;color:#555;">
                            © Mollenjagers · <a href="{baseUrl}" style="color:#555;text-decoration:none;">{baseUrl}</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;

    private static string EscapeHtml(string text) =>
        text.Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;")
            .Replace("\"", "&quot;");

    private async Task PostToMailerSendAsync(
        string toEmail,
        string subject,
        string text,
        string html
    )
    {
        var apiKey = config["MailerSend:ApiKey"] ?? "";
        var fromEmail = config["MailerSend:FromEmail"] ?? "";
        var fromName = config["MailerSend:FromName"] ?? "Mollenjagers";

        var body = new
        {
            from = new { email = fromEmail, name = fromName },
            to = new[] { new { email = toEmail } },
            subject,
            text,
            html,
        };

        using var client = httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            "https://api.mailersend.com/v1/email"
        );
        request.Headers.Add("Authorization", $"Bearer {apiKey}");
        request.Content = new StringContent(
            JsonSerializer.Serialize(body),
            Encoding.UTF8,
            "application/json"
        );

        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
    }
}
