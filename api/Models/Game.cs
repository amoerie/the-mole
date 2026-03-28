namespace Api.Models;

public class Game
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string AdminUserId { get; set; } = string.Empty;
    public List<Contestant> Contestants { get; set; } = new();
    public List<Episode> Episodes { get; set; } = new();
    public string? MoleContestantId { get; set; }
    public string InviteCode { get; set; } = Guid.NewGuid().ToString("N")[..8];
}

public class Contestant
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public int Age { get; set; }
    public string PhotoUrl { get; set; } = string.Empty;
    public int? EliminatedInEpisode { get; set; }
}

public class Episode
{
    public int Number { get; set; }
    public DateTimeOffset Deadline { get; set; }
    public string? EliminatedContestantId { get; set; }
}
