using Api.Data;
using Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests.Helpers;

public sealed class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    public FakeEmailService EmailService { get; } = new();

    public CustomWebApplicationFactory()
    {
        _connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Test");
        builder.ConfigureAppConfiguration(
            (_, config) =>
            {
                config.AddInMemoryCollection(
                    new Dictionary<string, string?> { ["AdminEmail"] = "admin@test.com" }
                );
            }
        );
        builder.ConfigureServices(services =>
        {
            var dbDescriptor = services.SingleOrDefault(d =>
                d.ServiceType == typeof(DbContextOptions<AppDbContext>)
            );
            if (dbDescriptor != null)
                services.Remove(dbDescriptor);

            services.AddDbContext<AppDbContext>(options => options.UseSqlite(_connection));

            var emailDescriptor = services.SingleOrDefault(d =>
                d.ServiceType == typeof(IEmailService)
            );
            if (emailDescriptor != null)
                services.Remove(emailDescriptor);

            services.AddSingleton<IEmailService>(EmailService);

            services
                .AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                    TestAuthHandler.SchemeName,
                    _ => { }
                );
        });
    }

    public void ResetDb()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.EnsureDeleted();
        db.Database.EnsureCreated();
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
            _connection.Dispose();
    }
}
