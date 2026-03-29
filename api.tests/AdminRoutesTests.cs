using Api.Data;
using Api.Models;
using Api.Tests.Helpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests;

[Collection("Integration")]
public sealed class AdminRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AdminRoutesTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        TestAuthHandler.UserId = "admin-user-id";
        TestAuthHandler.DisplayName = "Admin User";
        TestAuthHandler.IsAuthenticated = true;
        TestAuthHandler.Roles = ["authenticated", "admin"];
    }

    private HttpClient CreateClient() =>
        _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    private void PrepareDb(Action<AppDbContext>? seed = null)
    {
        _factory.ResetDb();
        if (seed == null)
            return;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        seed(db);
        db.SaveChanges();
    }

    [Fact]
    public async Task ListUsers_WhenAdmin_ReturnsOkWithUsers()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "u1",
                    Email = "alice@test.com",
                    DisplayName = "Alice",
                    IsAdmin = false,
                }
            );
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "u2",
                    Email = "bob@test.com",
                    DisplayName = "Bob",
                    IsAdmin = true,
                }
            );
        });
        var client = CreateClient();

        var response = await client.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(2, body!.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task ListUsers_WhenNotAdmin_ReturnsForbidden()
    {
        PrepareDb();
        TestAuthHandler.Roles = ["authenticated"];
        try
        {
            var client = CreateClient();

            var response = await client.GetAsync("/api/admin/users");

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
        finally
        {
            TestAuthHandler.Roles = ["authenticated", "admin"];
        }
    }

    [Fact]
    public async Task ListUsers_WhenUnauthenticated_ReturnsUnauthorized()
    {
        PrepareDb();
        TestAuthHandler.IsAuthenticated = false;
        try
        {
            var client = CreateClient();

            var response = await client.GetAsync("/api/admin/users");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        finally
        {
            TestAuthHandler.IsAuthenticated = true;
        }
    }

    [Fact]
    public async Task GrantAdmin_WhenAdmin_SetsUserAsAdmin()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "target-user",
                    Email = "target@test.com",
                    DisplayName = "Target",
                    IsAdmin = false,
                }
            );
        });
        var client = CreateClient();

        var response = await client.PostAsync("/api/admin/users/target-user/grant-admin", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.AppUsers.FindAsync("target-user");
        Assert.True(user!.IsAdmin);
    }

    [Fact]
    public async Task GrantAdmin_WhenUserNotFound_ReturnsNotFound()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsync("/api/admin/users/nonexistent/grant-admin", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GrantAdmin_WhenNotAdmin_ReturnsForbidden()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "target-user",
                    Email = "target@test.com",
                    DisplayName = "Target",
                    IsAdmin = false,
                }
            );
        });
        TestAuthHandler.Roles = ["authenticated"];
        try
        {
            var client = CreateClient();

            var response = await client.PostAsync("/api/admin/users/target-user/grant-admin", null);

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }
        finally
        {
            TestAuthHandler.Roles = ["authenticated", "admin"];
        }
    }

    [Fact]
    public async Task GrantAdmin_WhenUnauthenticated_ReturnsUnauthorized()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "target-user",
                    Email = "target@test.com",
                    DisplayName = "Target",
                    IsAdmin = false,
                }
            );
        });
        TestAuthHandler.IsAuthenticated = false;
        try
        {
            var client = CreateClient();

            var response = await client.PostAsync("/api/admin/users/target-user/grant-admin", null);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        finally
        {
            TestAuthHandler.IsAuthenticated = true;
        }
    }
}
