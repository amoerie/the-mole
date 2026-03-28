namespace Api.Models;

public class LeaderboardEntry
{
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public double TotalScore { get; set; }
    public List<EpisodeScore> EpisodeScores { get; set; } = new();
}

public class EpisodeScore
{
    public int EpisodeNumber { get; set; }
    public double Score { get; set; }
    public int RankGiven { get; set; }
    public int TotalContestants { get; set; }
}
