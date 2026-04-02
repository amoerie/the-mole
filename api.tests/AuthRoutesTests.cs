using System.Security.Cryptography;
using Api.Auth;
using Api.Data;
using Api.Models;
using Api.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests;

[Collection("Integration")]
public sealed class AuthRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly TestContext _ctx;

    public AuthRoutesTests(CustomWebApplicationFactory factory)
    {
        _ctx = new TestContext(factory);
    }

    /// <summary>Mimics the server: SHA256-hash the raw hex token bytes before storing.</summary>
    private static string HashToken(string hexToken) =>
        Convert.ToHexString(SHA256.HashData(Convert.FromHexString(hexToken)));

    // ── Register ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Register_AdminEmail_WithPassword_ReturnsOkWithUserInfo()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

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
        _ctx.PrepareDb(db =>
            db.Games.Add(
                new Game
                {
                    Id = "game-1",
                    Name = "Test Game",
                    InviteCode = "VALIDCODE",
                    AdminUserId = "admin-1",
                }
            )
        );
        var client = _ctx.CreateClient();

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
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

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
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

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
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

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
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

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
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "existing-id",
                    Email = "admin@test.com",
                    DisplayName = "Old Name",
                    PasswordHash = PasswordHelper.Hash("oldpass"),
                }
            )
        );
        var client = _ctx.CreateClient();

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
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(TestData.User("user-1", "alice@test.com", "Alice", "correctpass"))
        );
        var client = _ctx.CreateClient();

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
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(TestData.User("user-1", "alice@test.com", "Alice", "correctpass"))
        );
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { email = "alice@test.com", password = "wrongpass" }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithUnknownEmail_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { email = "nobody@test.com", password = "anypass" }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithMissingFields_ReturnsBadRequest()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

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
        _ctx.PrepareDb(db => db.AppUsers.Add(TestData.User("user-1", "alice@test.com", "Alice")));
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/forgot-password",
            new { email = "alice@test.com" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Single(_ctx.EmailService.SentEmails);
        Assert.Equal("alice@test.com", _ctx.EmailService.SentEmails[0].ToEmail);
    }

    [Fact]
    public async Task ForgotPassword_WithMissingEmail_ReturnsBadRequest()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/forgot-password",
            new { email = "" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ForgotPassword_WithUnknownEmail_StillReturnsOkButNoEmail()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/forgot-password",
            new { email = "nobody@test.com" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(_ctx.EmailService.SentEmails);
    }

    // ── Reset Password ──────────────────────────────────────────────────────

    [Fact]
    public async Task ResetPassword_WithValidToken_ReturnsOkAndUpdatesPassword()
    {
        // Raw token (64 hex chars = 32 bytes) sent in the email link; DB stores its SHA256 hash
        const string rawToken = "AABBCCDDEEFF00112233445566778899AABBCCDDEEFF00112233445566778899";
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "user-1",
                    Email = "alice@test.com",
                    DisplayName = "Alice",
                    PasswordHash = PasswordHelper.Hash("oldpass"),
                    PasswordResetToken = HashToken(rawToken),
                    PasswordResetTokenExpiry = DateTimeOffset.UtcNow.AddHours(1),
                }
            )
        );
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/reset-password",
            new { token = rawToken, newPassword = "NewP@ss123" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var user = await _ctx.ReadDbAsync(db => db.AppUsers.FindAsync("user-1").AsTask());
        Assert.True(PasswordHelper.Verify("NewP@ss123", user!.PasswordHash));
        Assert.Null(user.PasswordResetToken);
    }

    [Fact]
    public async Task ResetPassword_WithExpiredToken_ReturnsBadRequest()
    {
        const string rawToken = "FFEEDDCCBBAA99887766554433221100FFEEDDCCBBAA99887766554433221100";
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "user-1",
                    Email = "alice@test.com",
                    DisplayName = "Alice",
                    PasswordHash = PasswordHelper.Hash("oldpass"),
                    PasswordResetToken = HashToken(rawToken),
                    PasswordResetTokenExpiry = DateTimeOffset.UtcNow.AddHours(-1),
                }
            )
        );
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/reset-password",
            new { token = rawToken, newPassword = "NewP@ss123" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_WithInvalidToken_ReturnsBadRequest()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/reset-password",
            new { token = "badtoken", newPassword = "NewP@ss123" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ResetPassword_WithMissingFields_ReturnsBadRequest()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

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
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/auth/logout");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("/", response.Headers.Location?.OriginalString);
    }

    // ── GetMe ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetMe_WhenAuthenticated_ReturnsUserInfo()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

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
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(TestData.User("test-user-id", "alice@test.com", "Old Name"))
        );
        var client = _ctx.CreateClient();

        var response = await client.PatchAsJsonAsync("/api/me", new { displayName = "New Name" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal("New Name", body!.RootElement.GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task UpdateProfile_WithEmptyName_ReturnsBadRequest()
    {
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(TestData.User("test-user-id", "alice@test.com", "Old Name"))
        );
        var client = _ctx.CreateClient();

        var response = await client.PatchAsJsonAsync("/api/me", new { displayName = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateProfile_AlsoUpdatesPlayerDisplayName()
    {
        _ctx.PrepareDb(db =>
        {
            db.AppUsers.Add(TestData.User("test-user-id", "alice@test.com", "Old Name"));
            db.Games.Add(TestData.Game());
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
        var client = _ctx.CreateClient();

        await client.PatchAsJsonAsync("/api/me", new { displayName = "New Name" });

        var player = await _ctx.ReadDbAsync(db => db.Players.FindAsync("player-1").AsTask());
        Assert.Equal("New Name", player!.DisplayName);
    }

    [Fact]
    public async Task UpdateProfile_WhenNotAuthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.PatchAsJsonAsync("/api/me", new { displayName = "Test" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ── GetPreferences ───────────────────────────────────────────────────────

    [Fact]
    public async Task GetPreferences_WhenAuthenticated_ReturnsReminderEmailsEnabled()
    {
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "test-user-id",
                    Email = "alice@test.com",
                    DisplayName = "Alice",
                    PasswordHash = PasswordHelper.Hash("pass"),
                    ReminderEmailsEnabled = true,
                }
            )
        );
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/me/preferences");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.True(body!.RootElement.GetProperty("reminderEmailsEnabled").GetBoolean());
    }

    [Fact]
    public async Task GetPreferences_WhenNotAuthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/me/preferences");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ── UpdatePreferences ────────────────────────────────────────────────────

    [Fact]
    public async Task UpdatePreferences_DisablesReminders()
    {
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "test-user-id",
                    Email = "alice@test.com",
                    DisplayName = "Alice",
                    PasswordHash = PasswordHelper.Hash("pass"),
                    ReminderEmailsEnabled = true,
                }
            )
        );
        var client = _ctx.CreateClient();

        var response = await client.PatchAsJsonAsync(
            "/api/me/preferences",
            new { reminderEmailsEnabled = false }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.False(body!.RootElement.GetProperty("reminderEmailsEnabled").GetBoolean());

        var user = await _ctx.ReadDbAsync(db => db.AppUsers.FindAsync("test-user-id").AsTask());
        Assert.False(user!.ReminderEmailsEnabled);
    }

    [Fact]
    public async Task UpdatePreferences_ReEnablesReminders()
    {
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "test-user-id",
                    Email = "alice@test.com",
                    DisplayName = "Alice",
                    PasswordHash = PasswordHelper.Hash("pass"),
                    ReminderEmailsEnabled = false,
                }
            )
        );
        var client = _ctx.CreateClient();

        var response = await client.PatchAsJsonAsync(
            "/api/me/preferences",
            new { reminderEmailsEnabled = true }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.True(body!.RootElement.GetProperty("reminderEmailsEnabled").GetBoolean());
    }

    [Fact]
    public async Task UpdatePreferences_WhenNotAuthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.PatchAsJsonAsync(
            "/api/me/preferences",
            new { reminderEmailsEnabled = false }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePreferences_WithInvalidBody_ReturnsBadRequest()
    {
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "test-user-id",
                    Email = "user@test.com",
                    DisplayName = "User",
                    PasswordHash = "hash",
                }
            )
        );
        var client = _ctx.CreateClient();

        var response = await client.PatchAsync(
            "/api/me/preferences",
            new StringContent("not-valid-json", System.Text.Encoding.UTF8, "application/json")
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
