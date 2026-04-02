using Api.Services;

namespace Api.Tests.Helpers;

public sealed class FakeEmailService : IEmailService
{
    public List<(string ToEmail, string DisplayName, string ResetUrl)> SentEmails { get; } = [];
    public List<(
        string ToEmail,
        string DisplayName,
        List<(string GameName, string GameUrl)> Games
    )> SentReminders { get; } = [];

    public Task SendPasswordResetAsync(string toEmail, string displayName, string resetUrl)
    {
        SentEmails.Add((toEmail, displayName, resetUrl));
        return Task.CompletedTask;
    }

    public Task SendRankingReminderAsync(
        string toEmail,
        string displayName,
        IEnumerable<(string GameName, string GameUrl)> games
    )
    {
        SentReminders.Add((toEmail, displayName, games.ToList()));
        return Task.CompletedTask;
    }
}
