namespace Api.Models;

public class Ranking
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string GameId { get; set; } = string.Empty;
    public int EpisodeNumber { get; set; }
    public string UserId { get; set; } = string.Empty;
    public List<string> ContestantIds { get; set; } = new(); // ordered most→least suspect
    public DateTimeOffset SubmittedAt { get; set; } = DateTimeOffset.UtcNow;
}
