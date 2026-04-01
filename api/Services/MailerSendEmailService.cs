using System.Text;
using System.Text.Json;

namespace Api.Services;

public sealed class MailerSendEmailService(
    IHttpClientFactory httpClientFactory,
    IConfiguration config
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

        await SendAsync(toEmail, "Wachtwoord herstellen — De Mol", text, html);
    }

    public async Task SendRankingReminderAsync(
        string toEmail,
        string displayName,
        IEnumerable<(string GameName, string GameUrl)> games
    )
    {
        var baseUrl = (config["BaseUrl"] ?? "").TrimEnd('/');
        var gamesList = games.ToList();

        var gameLinks = string.Join(
            "\n",
            gamesList.Select(g =>
                $"""
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2a2a2a;">
                    <a href="{g.GameUrl}"
                       style="color:#00ff41;font-size:15px;font-weight:600;text-decoration:none;">
                      {EscapeHtml(g.GameName)}
                    </a>
                    <span style="display:block;margin-top:4px;">
                      <a href="{g.GameUrl}"
                         style="display:inline-block;margin-top:6px;padding:7px 16px;background-color:#00ff41;color:#000;font-weight:700;font-size:13px;text-decoration:none;border-radius:5px;">
                        Rangschikking indienen →
                      </a>
                    </span>
                  </td>
                </tr>
                """
            )
        );

        var content = $"""
            <p style="margin:0 0 16px;font-size:16px;color:#e0e0e0;">Hallo {EscapeHtml(
                displayName
            )},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#e0e0e0;">
              Je hebt voor de volgende {(
                gamesList.Count == 1 ? "spel" : "spellen"
            )} nog geen rangschikking ingediend voor de huidige aflevering:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              {gameLinks}
            </table>
            <p style="margin:0;font-size:13px;color:#888;">
              Je ontvangt deze herinnering elke zondag. Je kunt ze uitschakelen via je
              <a href="{baseUrl}/profile" style="color:#00cc33;">profielpagina</a>.
            </p>
            """;

        var html = BuildEmailHtml(baseUrl, content);

        var gameLines = string.Join("\n", gamesList.Select(g => $"- {g.GameName}: {g.GameUrl}"));
        var text =
            $"Hallo {displayName},\n\nJe hebt nog geen rangschikking ingediend voor de huidige aflevering in:\n\n{gameLines}\n\nJe kunt meldingen uitschakelen via {baseUrl}/profile.";

        await SendAsync(toEmail, "Vergeet je rangschikking niet — De Mol", text, html);
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
                          <span style="font-size:18px;font-weight:700;color:#00ff41;letter-spacing:0.08em;vertical-align:middle;">DE MOL</span>
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
                            © De Mol · <a href="{baseUrl}" style="color:#555;text-decoration:none;">{baseUrl}</a>
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

    private async Task SendAsync(string toEmail, string subject, string text, string html)
    {
        var apiKey = config["MailerSend:ApiKey"] ?? "";
        var fromEmail = config["MailerSend:FromEmail"] ?? "";
        var fromName = config["MailerSend:FromName"] ?? "De Mol";

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
