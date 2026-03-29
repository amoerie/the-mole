using Api.Data;
using Api.Models;
using Api.Tests.Helpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Passwordless;

namespace Api.Tests;

[Collection("Integration")]
public sealed class AuthRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public AuthRoutesTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        TestAuthHandler.UserId = "test-user-id";
        TestAuthHandler.DisplayName = "Test User";
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
    public async Task Register_WithValidEmailAndName_ReturnsOkWithToken()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new { email = "test@example.com", displayName = "Alice" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal("fake-register-token", body!.RootElement.GetProperty("token").GetString());
    }

    [Fact]
    public async Task Register_WithMissingEmail_ReturnsBadRequest()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new { email = "", displayName = "Alice" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithMissingDisplayName_ReturnsBadRequest()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new { email = "test@example.com", displayName = "" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Register_ExistingUser_UpdatesDisplayNameAndReturnsToken()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "existing-id",
                    Email = "test@example.com",
                    DisplayName = "Old Name",
                }
            );
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new { email = "test@example.com", displayName = "New Name" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Verify_WithValidToken_ReturnsOkWithUserInfo()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "test-user-id",
                    Email = "test@example.com",
                    DisplayName = "Test User",
                }
            );
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/verify",
            new { token = "valid-token" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal("test-user-id", body!.RootElement.GetProperty("userId").GetString());
    }

    [Fact]
    public async Task Verify_WithInvalidToken_ReturnsUnauthorized()
    {
        PrepareDb();
        var fake = (FakePasswordlessClient)
            _factory.Services.GetRequiredService<IPasswordlessClient>();
        fake.VerifySuccess = false;
        try
        {
            var client = CreateClient();

            var response = await client.PostAsJsonAsync(
                "/api/auth/verify",
                new { token = "bad-token" }
            );

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        finally
        {
            fake.VerifySuccess = true;
        }
    }

    [Fact]
    public async Task Recover_WithKnownEmail_ReturnsOk()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "test-user-id",
                    Email = "test@example.com",
                    DisplayName = "Test User",
                }
            );
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/recover",
            new { email = "test@example.com" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Recover_WithUnknownEmail_StillReturnsOk()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/recover",
            new { email = "unknown@example.com" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Logout_ReturnsRedirectToRoot()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.GetAsync("/api/auth/logout");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("/", response.Headers.Location?.OriginalString);
    }

    [Fact]
    public async Task GetMe_WhenAuthenticated_ReturnsUserInfo()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.GetAsync("/api/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal("test-user-id", body!.RootElement.GetProperty("userId").GetString());
    }

    [Fact]
    public async Task GetMe_WhenNotAuthenticated_ReturnsUnauthorized()
    {
        PrepareDb();
        TestAuthHandler.IsAuthenticated = false;
        try
        {
            var client = CreateClient();

            var response = await client.GetAsync("/api/me");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        finally
        {
            TestAuthHandler.IsAuthenticated = true;
            TestAuthHandler.Roles = ["authenticated", "admin"];
        }
    }
}
