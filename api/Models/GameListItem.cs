namespace Api.Models;

public sealed record MyGameResponse(
    string Id,
    string Name,
    string AdminUserId,
    List<Contestant> Contestants,
    List<Episode> Episodes,
    string? MoleContestantId,
    string InviteCode,
    int PlayerCount
);
