using Api.Models;

namespace Api.Services;

public interface IEmailService
{
    Task SendPasswordResetAsync(string toEmail, string displayName, string resetUrl);

    Task SendRankingReminderAsync(
        string toEmail,
        string displayName,
        IEnumerable<GameReminderInfo> games
    );

    Task RetryAsync(
        string toEmail,
        string toName,
        string subject,
        string textBody,
        string htmlBody,
        EmailType type
    );
}
