namespace Api.Models;

public class MessageRead
{
    public string UserId { get; set; } = string.Empty;
    public string GameId { get; set; } = string.Empty;
    public DateTimeOffset LastReadAt { get; set; } = DateTimeOffset.MinValue;
}
