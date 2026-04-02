namespace Api.Models;

public class AppUser
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool IsAdmin { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public string? PasswordResetToken { get; set; }
    public DateTimeOffset? PasswordResetTokenExpiry { get; set; }
    public bool ReminderEmailsEnabled { get; set; } = true;
}
