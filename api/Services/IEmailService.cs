namespace Api.Services;

public interface IEmailService
{
    Task SendPasswordResetAsync(string toEmail, string resetUrl);
}
