using Api.Services;

namespace Api.Tests.Helpers;

public sealed class FakeEmailService : IEmailService
{
    public List<(string ToEmail, string ResetUrl)> SentEmails { get; } = [];

    public Task SendPasswordResetAsync(string toEmail, string resetUrl)
    {
        SentEmails.Add((toEmail, resetUrl));
        return Task.CompletedTask;
    }
}
