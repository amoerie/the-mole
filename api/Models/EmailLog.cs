namespace Api.Models;

public class EmailLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public DateTimeOffset SentAt { get; set; }
    public string ToEmail { get; set; } = string.Empty;
    public string ToName { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;
    public string TextBody { get; set; } = string.Empty;
    public EmailType Type { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}
