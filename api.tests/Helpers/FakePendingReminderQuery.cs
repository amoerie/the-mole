using Api.Services;

namespace Api.Tests.Helpers;

internal sealed class FakePendingReminderQuery(
    IReadOnlyList<ReminderRecipient> recipients,
    ReminderRecipient? singleUserRecipient = null
) : IPendingReminderQuery
{
    public int CallCount { get; private set; }

    public Task<IReadOnlyList<ReminderRecipient>> GetRecipientsAsync(
        string baseUrl,
        CancellationToken ct
    )
    {
        CallCount++;
        return Task.FromResult(recipients);
    }

    public Task<ReminderRecipient?> GetRecipientForUserAsync(
        string userId,
        string baseUrl,
        CancellationToken ct
    ) => Task.FromResult(singleUserRecipient);
}
