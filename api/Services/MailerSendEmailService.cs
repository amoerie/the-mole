using System.Text;
using System.Text.Json;

namespace Api.Services;

public sealed class MailerSendEmailService(
    IHttpClientFactory httpClientFactory,
    IConfiguration config
) : IEmailService
{
    public async Task SendPasswordResetAsync(string toEmail, string resetUrl)
    {
        var apiKey = config["MailerSend:ApiKey"] ?? "";
        var fromEmail = config["MailerSend:FromEmail"] ?? "";
        var fromName = config["MailerSend:FromName"] ?? "De Mol";

        var body = new
        {
            from = new { email = fromEmail, name = fromName },
            to = new[] { new { email = toEmail } },
            subject = "Wachtwoord herstellen — De Mol",
            text = $"Klik op de volgende link om je wachtwoord te herstellen:\n\n{resetUrl}\n\nDeze link is 24 uur geldig.",
            html = $"<p>Klik op de volgende link om je wachtwoord te herstellen:</p><p><a href=\"{resetUrl}\">{resetUrl}</a></p><p>Deze link is 24 uur geldig.</p>",
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
