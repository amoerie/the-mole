using Api.Services;

namespace Api.Tests.Helpers;

internal sealed class FakePendingReminderQuery(IReadOnlyList<ReminderRecipient> recipients)
    : IPendingReminderQuery
{
    public int CallCount { get; private set; }

    public Task<IReadOnlyList<ReminderRecipient>> GetPendingRecipientsAsync(
        string baseUrl,
        CancellationToken ct
    )
    {
        CallCount++;
        return Task.FromResult(recipients);
    }
}
