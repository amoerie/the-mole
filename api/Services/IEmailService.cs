namespace Api.Services;

public interface IEmailService
{
    Task SendPasswordResetAsync(string toEmail, string displayName, string resetUrl);
    Task SendRankingReminderAsync(
        string toEmail,
        string displayName,
        IEnumerable<(string GameName, string GameUrl)> games
    );
}
