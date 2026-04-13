namespace Api.Models;

public class NotebookNote
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = string.Empty;
    public string GameId { get; set; } = string.Empty;
    public int EpisodeNumber { get; set; }
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Stored as a JSON string via a value converter.
    /// Keys are contestant IDs; values are suspicion levels 1–5.
    /// </summary>
    public Dictionary<string, int> SuspicionLevels { get; set; } = new();

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
