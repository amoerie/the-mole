namespace Api.Services;

public record ReminderRecipient(
    string Email,
    string DisplayName,
    IReadOnlyList<(string GameName, string GameUrl)> Games
);
