namespace Api.Services;

public interface IPendingReminderQuery
{
    Task<IReadOnlyList<ReminderRecipient>> GetRecipientsAsync(string baseUrl, CancellationToken ct);

    Task<ReminderRecipient?> GetRecipientForUserAsync(
        string userId,
        string baseUrl,
        CancellationToken ct
    );
}
