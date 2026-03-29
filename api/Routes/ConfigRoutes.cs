namespace Api.Routes;

public static class ConfigRoutes
{
    public static void MapConfigRoutes(this WebApplication app)
    {
        app.MapGet(
                "/api/config",
                (IConfiguration config) =>
                    Results.Ok(new AppConfig(config["Passwordless:ApiKey"] ?? ""))
            )
            .WithName("GetConfig")
            .WithTags("Config")
            .AllowAnonymous()
            .Produces<AppConfig>();
    }

    private sealed record AppConfig(string PasswordlessApiKey);
}
