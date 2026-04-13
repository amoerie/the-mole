using Api.Models;
using Api.Services;

namespace Api.Tests.Helpers;

public sealed class FakeEmailService : IEmailService
{
    public List<(string ToEmail, string DisplayName, string ResetUrl)> SentEmails { get; } = [];
    public List<(
        string ToEmail,
        string DisplayName,
        List<GameReminderInfo> Games
    )> SentReminders { get; } = [];
    public List<(
        string ToEmail,
        string ToName,
        string Subject,
        string TextBody,
        string HtmlBody,
        EmailType Type
    )> Retried { get; } = [];

    public Task SendPasswordResetAsync(string toEmail, string displayName, string resetUrl)
    {
        SentEmails.Add((toEmail, displayName, resetUrl));
        return Task.CompletedTask;
    }

    public Task SendRankingReminderAsync(
        string toEmail,
        string displayName,
        IEnumerable<GameReminderInfo> games
    )
    {
        SentReminders.Add((toEmail, displayName, games.ToList()));
        return Task.CompletedTask;
    }

    public Task RetryAsync(
        string toEmail,
        string toName,
        string subject,
        string textBody,
        string htmlBody,
        EmailType type
    )
    {
        Retried.Add((toEmail, toName, subject, textBody, htmlBody, type));
        return Task.CompletedTask;
    }
}
