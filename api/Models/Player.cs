namespace Api.Models;

public class Player
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string GameId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? NotebookColor { get; set; }
}
