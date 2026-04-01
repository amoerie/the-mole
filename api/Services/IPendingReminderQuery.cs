namespace Api.Services;

public interface IPendingReminderQuery
{
    Task<IReadOnlyList<ReminderRecipient>> GetPendingRecipientsAsync(
        string baseUrl,
        CancellationToken ct
    );
}
