namespace Api.Models;

public class DataProtectionKey
{
    public int Id { get; set; }
    public required string FriendlyName { get; set; }
    public required string XmlData { get; set; }
}
