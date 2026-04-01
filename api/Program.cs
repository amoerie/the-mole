using System.Threading.RateLimiting;
using Api.Data;
using Api.DataProtection;
using Api.Routes;
using Api.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder
    .Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "__Host-Mollenjagers";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.Path = "/";
        options.ExpireTimeSpan = TimeSpan.FromDays(365);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(options =>
{
    static RateLimitPartition<string> FixedWindow(string key, int permitLimit, TimeSpan window) =>
        RateLimitPartition.GetFixedWindowLimiter(
            key,
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = window,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }
        );

    // Auth endpoints: keyed by IP so limits apply per caller, not globally
    options.AddPolicy(
        "login",
        ctx =>
            FixedWindow(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                permitLimit: 10,
                window: TimeSpan.FromMinutes(1)
            )
    );
    options.AddPolicy(
        "register",
        ctx =>
            FixedWindow(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                permitLimit: 5,
                window: TimeSpan.FromMinutes(1)
            )
    );
    options.AddPolicy(
        "forgotPassword",
        ctx =>
            FixedWindow(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                permitLimit: 5,
                window: TimeSpan.FromMinutes(1)
            )
    );
    options.AddPolicy(
        "resetPassword",
        ctx =>
            FixedWindow(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                permitLimit: 5,
                window: TimeSpan.FromMinutes(1)
            )
    );
    options.AddPolicy(
        "inviteCode",
        ctx =>
            FixedWindow(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                permitLimit: 20,
                window: TimeSpan.FromMinutes(1)
            )
    );
    options.AddPolicy(
        "postMessage",
        ctx =>
            FixedWindow(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                permitLimit: 30,
                window: TimeSpan.FromMinutes(1)
            )
    );
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

var dbPath = builder.Configuration["DatabasePath"] ?? "themole.db";
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite($"Data Source={dbPath}"));

builder.Services.AddSingleton<EfDataProtectionKeyRepository>();
builder.Services.AddDataProtection().SetApplicationName("the-mole");
builder
    .Services.AddOptions<KeyManagementOptions>()
    .Configure<EfDataProtectionKeyRepository>((options, repo) => options.XmlRepository = repo);

builder.Services.AddHttpClient();
builder.Services.AddSingleton<IEmailService, MailerSendEmailService>();
builder.Services.AddHostedService<ReminderEmailBackgroundService>();

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

var forwardedOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
};
forwardedOptions.KnownIPNetworks.Clear();
forwardedOptions.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedOptions);

if (!app.Environment.IsEnvironment("Test"))
    app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();

app.MapAuthRoutes();
app.MapGameRoutes();
app.MapEpisodeRoutes();
app.MapRankingRoutes();
app.MapLeaderboardRoutes();
app.MapMessageRoutes();
app.MapPlayerRoutes();
app.MapSuspectStatsRoutes();
app.MapAdminRoutes();
app.MapConfigRoutes();

if (!app.Environment.IsDevelopment())
    app.MapFallbackToFile("index.html");

app.Run();

public partial class Program { }
