namespace Api.Services;

public record GameReminderInfo(
    string GameName,
    string GameUrl,
    DateTimeOffset Deadline,
    IReadOnlyList<string> RankedContestantNames
);
