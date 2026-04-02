namespace Api.Models;

/// <summary>Key-value store for application-level settings that need to survive process restarts.</summary>
public class AppSetting
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}
