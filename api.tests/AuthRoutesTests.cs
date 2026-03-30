using Api.Auth;
using Api.Data;
using Api.Models;
using Api.Tests.Helpers;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

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
        _factory.EmailService.SentEmails.Clear();
        if (seed == null)
            return;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        seed(db);
        db.SaveChanges();
    }

    // ── Register ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Register_AdminEmail_WithPassword_ReturnsOkWithUserInfo()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = "admin@test.com",
                displayName = "Alice",
                password = "P@ssw0rd!",
            }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal("Alice", body!.RootElement.GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task Register_WithValidInviteCode_ReturnsOk()
    {
        PrepareDb(db =>
        {
            db.Games.Add(
                new Game
                {
                    Id = "game-1",
                    Name = "Test Game",
                    InviteCode = "VALIDCODE",
                    AdminUserId = "admin-1",
                }
            );
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = "alice@example.com",
                displayName = "Alice",
                password = "P@ssw0rd!",
                inviteCode = "VALIDCODE",
            }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithoutInviteCode_AndNotAdmin_ReturnsBadRequest()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = "alice@example.com",
                displayName = "Alice",
                password = "P@ssw0rd!",
            }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithInvalidInviteCode_ReturnsBadRequest()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = "alice@example.com",
                displayName = "Alice",
                password = "P@ssw0rd!",
                inviteCode = "BADCODE",
            }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithMissingEmail_ReturnsBadRequest()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = "",
                displayName = "Alice",
                password = "P@ssw0rd!",
            }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithMissingPassword_ReturnsBadRequest()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = "admin@test.com",
                displayName = "Alice",
                password = "",
            }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Register_DuplicateEmail_ReturnsConflict()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "existing-id",
                    Email = "admin@test.com",
                    DisplayName = "Old Name",
                    PasswordHash = PasswordHelper.Hash("oldpass"),
                }
            );
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = "admin@test.com",
                displayName = "New Name",
                password = "P@ssw0rd!",
            }
        );

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    // ── Login ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Login_WithCorrectCredentials_ReturnsOkWithUserInfo()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "user-1",
                    Email = "alice@test.com",
                    DisplayName = "Alice",
                    PasswordHash = PasswordHelper.Hash("correctpass"),
                }
            );
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { email = "alice@test.com", password = "correctpass" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal("Alice", body!.RootElement.GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsUnauthorized()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "user-1",
                    Email = "alice@test.com",
                    DisplayName = "Alice",
                    PasswordHash = PasswordHelper.Hash("correctpass"),
                }
            );
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { email = "alice@test.com", password = "wrongpass" }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithUnknownEmail_ReturnsUnauthorized()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { email = "nobody@test.com", password = "anypass" }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithMissingFields_ReturnsBadRequest()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { email = "", password = "" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── Forgot Password ─────────────────────────────────────────────────────

    [Fact]
    public async Task ForgotPassword_WithKnownEmail_ReturnsOkAndSendsEmail()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "user-1",
                    Email = "alice@test.com",
                    DisplayName = "Alice",
                    PasswordHash = PasswordHelper.Hash("pass"),
                }
            );
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/forgot-password",
            new { email = "alice@test.com" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Single(_factory.EmailService.SentEmails);
        Assert.Equal("alice@test.com", _factory.EmailService.SentEmails[0].ToEmail);
    }

    [Fact]
    public async Task ForgotPassword_WithUnknownEmail_StillReturnsOkButNoEmail()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/forgot-password",
            new { email = "nobody@test.com" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(_factory.EmailService.SentEmails);
    }

    // ── Reset Password ──────────────────────────────────────────────────────

    [Fact]
    public async Task ResetPassword_WithValidToken_ReturnsOkAndUpdatesPassword()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "user-1",
                    Email = "alice@test.com",
                    DisplayName = "Alice",
                    PasswordHash = PasswordHelper.Hash("oldpass"),
                    PasswordResetToken = "validtoken",
                    PasswordResetTokenExpiry = DateTimeOffset.UtcNow.AddHours(1),
                }
            );
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/reset-password",
            new { token = "validtoken", newPassword = "NewP@ss123" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.AppUsers.FindAsync("user-1");
        Assert.True(PasswordHelper.Verify("NewP@ss123", user!.PasswordHash));
        Assert.Null(user.PasswordResetToken);
    }

    [Fact]
    public async Task ResetPassword_WithExpiredToken_ReturnsBadRequest()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "user-1",
                    Email = "alice@test.com",
                    DisplayName = "Alice",
                    PasswordHash = PasswordHelper.Hash("oldpass"),
                    PasswordResetToken = "expiredtoken",
                    PasswordResetTokenExpiry = DateTimeOffset.UtcNow.AddHours(-1),
                }
            );
        });
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/reset-password",
            new { token = "expiredtoken", newPassword = "NewP@ss123" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_WithInvalidToken_ReturnsBadRequest()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/reset-password",
            new { token = "badtoken", newPassword = "NewP@ss123" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_WithMissingFields_ReturnsBadRequest()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/reset-password",
            new { token = "", newPassword = "" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── Logout ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Logout_ReturnsRedirectToRoot()
    {
        PrepareDb();
        var client = CreateClient();

        var response = await client.GetAsync("/api/auth/logout");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("/", response.Headers.Location?.OriginalString);
    }

    // ── GetMe ────────────────────────────────────────────────────────────────

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

    // ── UpdateProfile ────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateProfile_WithValidName_ReturnsOkWithUpdatedUserInfo()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "test-user-id",
                    Email = "alice@test.com",
                    DisplayName = "Old Name",
                    PasswordHash = PasswordHelper.Hash("pass"),
                }
            );
        });
        var client = CreateClient();

        var response = await client.PatchAsJsonAsync("/api/me", new { displayName = "New Name" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal("New Name", body!.RootElement.GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task UpdateProfile_WithEmptyName_ReturnsBadRequest()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "test-user-id",
                    Email = "alice@test.com",
                    DisplayName = "Old Name",
                    PasswordHash = PasswordHelper.Hash("pass"),
                }
            );
        });
        var client = CreateClient();

        var response = await client.PatchAsJsonAsync("/api/me", new { displayName = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateProfile_AlsoUpdatesPlayerDisplayName()
    {
        PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "test-user-id",
                    Email = "alice@test.com",
                    DisplayName = "Old Name",
                    PasswordHash = PasswordHelper.Hash("pass"),
                }
            );
            db.Games.Add(
                new Game
                {
                    Id = "game-1",
                    Name = "Test Game",
                    InviteCode = "CODE",
                    AdminUserId = "test-user-id",
                }
            );
            db.Players.Add(
                new Player
                {
                    Id = "player-1",
                    GameId = "game-1",
                    UserId = "test-user-id",
                    DisplayName = "Old Name",
                }
            );
        });
        var client = CreateClient();

        await client.PatchAsJsonAsync("/api/me", new { displayName = "New Name" });

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var player = await db.Players.FindAsync("player-1");
        Assert.Equal("New Name", player!.DisplayName);
    }

    [Fact]
    public async Task UpdateProfile_WhenNotAuthenticated_ReturnsUnauthorized()
    {
        PrepareDb();
        TestAuthHandler.IsAuthenticated = false;
        try
        {
            var client = CreateClient();

            var response = await client.PatchAsJsonAsync("/api/me", new { displayName = "Test" });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        finally
        {
            TestAuthHandler.IsAuthenticated = true;
            TestAuthHandler.Roles = ["authenticated", "admin"];
        }
    }
}
