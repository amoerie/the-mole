namespace Api.Models;

public class Message
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string GameId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTimeOffset PostedAt { get; set; } = DateTimeOffset.UtcNow;
}
