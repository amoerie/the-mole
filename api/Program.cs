using Api.Data;
using Api.Routes;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Passwordless;

var builder = WebApplication.CreateBuilder(args);

builder
    .Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.Events.OnRedirectToLogin = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddPasswordlessSdk(options =>
{
    options.ApiKey = builder.Configuration["Passwordless:ApiKey"] ?? "";
    options.ApiSecret = builder.Configuration["Passwordless:ApiSecret"] ?? "";
});

var dbPath = builder.Configuration["DatabasePath"] ?? "themole.db";
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite($"Data Source={dbPath}"));

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddCors(options =>
        options.AddDefaultPolicy(policy =>
            policy
                .WithOrigins("http://localhost:5173")
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials()
        )
    );
}

builder.Services.AddOpenApi(
    "openapi",
    options =>
    {
        options.AddDocumentTransformer(
            (document, _, _) =>
            {
                document.Info.Title = "De Mol API";
                document.Info.Version = "v1";
                document.Servers = [new() { Url = "/" }];
                return Task.CompletedTask;
            }
        );
    }
);

builder.Services.AddApplicationInsightsTelemetry();

var app = builder.Build();

// Skip migrations when the build tool probes for the OpenAPI document
var isDocumentGeneration =
    Environment.GetEnvironmentVariable("DOTNET_RUNNING_AS_GETDOCUMENT") == "1";

if (!app.Environment.IsEnvironment("Test") && !isDocumentGeneration)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

if (!app.Environment.IsDevelopment())
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

if (app.Environment.IsDevelopment())
    app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();

app.MapAuthRoutes();
app.MapGameRoutes();
app.MapEpisodeRoutes();
app.MapRankingRoutes();
app.MapLeaderboardRoutes();

if (!app.Environment.IsDevelopment())
    app.MapFallbackToFile("index.html");

app.Run();

public partial class Program { }
