using System.Security.Claims;
using System.Security.Cryptography;
using Api.Auth;
using Api.Data;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

namespace Api.Routes;

public static class AuthRoutes
{
    public static void MapAuthRoutes(this WebApplication app)
    {
        app.MapPost(
                "/api/auth/register",
                async (
                    RegisterRequest req,
                    AppDbContext db,
                    IConfiguration config,
                    HttpContext ctx
                ) =>
                {
                    if (
                        string.IsNullOrWhiteSpace(req.Email)
                        || string.IsNullOrWhiteSpace(req.DisplayName)
                        || string.IsNullOrWhiteSpace(req.Password)
                    )
                        return Results.BadRequest(
                            new { error = "E-mailadres, naam en wachtwoord zijn verplicht." }
                        );

                    var email = req.Email.Trim().ToLowerInvariant();
                    var adminEmail = (config["AdminEmail"] ?? "").Trim().ToLowerInvariant();

                    if (email != adminEmail)
                    {
                        var inviteCode = req.InviteCode?.Trim();
                        if (string.IsNullOrEmpty(inviteCode))
                            return Results.BadRequest(
                                new
                                {
                                    error = "Een uitnodigingscode is verplicht om te registreren.",
                                }
                            );

                        var gameExists = await db.Games.AnyAsync(g => g.InviteCode == inviteCode);
                        if (!gameExists)
                            return Results.BadRequest(
                                new { error = "Ongeldige uitnodigingscode." }
                            );
                    }

                    var existing = await db.AppUsers.FirstOrDefaultAsync(u => u.Email == email);
                    if (existing != null)
                        return Results.Conflict(
                            new { error = "Dit e-mailadres is al in gebruik." }
                        );

                    var user = new AppUser
                    {
                        Email = email,
                        DisplayName = req.DisplayName.Trim(),
                        IsAdmin = email == adminEmail,
                        PasswordHash = PasswordHelper.Hash(req.Password),
                    };
                    db.AppUsers.Add(user);
                    await db.SaveChangesAsync();

                    await SignIn(ctx, user);
                    string[] roles = user.IsAdmin ? ["authenticated", "admin"] : ["authenticated"];
                    return Results.Ok(new UserInfo(user.Id, user.DisplayName, roles));
                }
            )
            .WithName("Register")
            .WithTags("Auth")
            .RequireRateLimiting("register")
            .Produces<UserInfo>();

        app.MapPost(
                "/api/auth/login",
                async (LoginRequest req, AppDbContext db, HttpContext ctx) =>
                {
                    if (
                        string.IsNullOrWhiteSpace(req.Email)
                        || string.IsNullOrWhiteSpace(req.Password)
                    )
                        return Results.BadRequest(
                            new { error = "E-mailadres en wachtwoord zijn verplicht." }
                        );

                    var email = req.Email.Trim().ToLowerInvariant();
                    var user = await db.AppUsers.FirstOrDefaultAsync(u => u.Email == email);

                    if (user == null || !PasswordHelper.Verify(req.Password, user.PasswordHash))
                        return Results.Unauthorized();

                    await SignIn(ctx, user);
                    string[] roles = user.IsAdmin ? ["authenticated", "admin"] : ["authenticated"];
                    return Results.Ok(new UserInfo(user.Id, user.DisplayName, roles));
                }
            )
            .WithName("Login")
            .WithTags("Auth")
            .RequireRateLimiting("login")
            .Produces<UserInfo>();

        app.MapPost(
                "/api/auth/forgot-password",
                async (
                    ForgotPasswordRequest req,
                    AppDbContext db,
                    IEmailService emailService,
                    IConfiguration config
                ) =>
                {
                    if (string.IsNullOrWhiteSpace(req.Email))
                        return Results.BadRequest(new { error = "E-mailadres is verplicht." });

                    var email = req.Email.Trim().ToLowerInvariant();
                    var user = await db.AppUsers.FirstOrDefaultAsync(u => u.Email == email);

                    if (user != null)
                    {
                        var tokenBytes = RandomNumberGenerator.GetBytes(32);
                        var token = Convert.ToHexString(tokenBytes);
                        var tokenHash = Convert.ToHexString(
                            System.Security.Cryptography.SHA256.HashData(tokenBytes)
                        );
                        user.PasswordResetToken = tokenHash;
                        user.PasswordResetTokenExpiry = DateTimeOffset.UtcNow.AddHours(24);
                        await db.SaveChangesAsync();

                        var baseUrl = (config["BaseUrl"] ?? "").TrimEnd('/');
                        var resetUrl = $"{baseUrl}/reset-password?token={token}";
                        await emailService.SendPasswordResetAsync(user.Email, resetUrl);
                    }

                    return Results.Ok(
                        new MessageResponse(
                            "Als dit e-mailadres bekend is, ontvang je een herstelmail."
                        )
                    );
                }
            )
            .WithName("ForgotPassword")
            .WithTags("Auth")
            .RequireRateLimiting("forgotPassword")
            .Produces<MessageResponse>();

        app.MapPost(
                "/api/auth/reset-password",
                async (ResetPasswordRequest req, AppDbContext db, HttpContext ctx) =>
                {
                    if (
                        string.IsNullOrWhiteSpace(req.Token)
                        || string.IsNullOrWhiteSpace(req.NewPassword)
                    )
                        return Results.BadRequest(
                            new { error = "Token en nieuw wachtwoord zijn verplicht." }
                        );

                    string incomingHash;
                    try
                    {
                        incomingHash = Convert.ToHexString(
                            System.Security.Cryptography.SHA256.HashData(
                                Convert.FromHexString(req.Token)
                            )
                        );
                    }
                    catch (FormatException)
                    {
                        return Results.BadRequest(
                            new { error = "Ongeldige of verlopen herstelcode." }
                        );
                    }

                    var user = await db.AppUsers.FirstOrDefaultAsync(u =>
                        u.PasswordResetToken == incomingHash
                    );

                    if (
                        user == null
                        || !user.PasswordResetTokenExpiry.HasValue
                        || user.PasswordResetTokenExpiry.Value < DateTimeOffset.UtcNow
                    )
                        return Results.BadRequest(
                            new { error = "Ongeldige of verlopen herstelcode." }
                        );

                    user.PasswordHash = PasswordHelper.Hash(req.NewPassword);
                    user.PasswordResetToken = null;
                    user.PasswordResetTokenExpiry = null;
                    await db.SaveChangesAsync();

                    await SignIn(ctx, user);
                    string[] roles = user.IsAdmin ? ["authenticated", "admin"] : ["authenticated"];
                    return Results.Ok(new UserInfo(user.Id, user.DisplayName, roles));
                }
            )
            .WithName("ResetPassword")
            .WithTags("Auth")
            .RequireRateLimiting("resetPassword")
            .Produces<UserInfo>();

        app.MapGet(
                "/api/auth/logout",
                async (HttpContext ctx) =>
                {
                    await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                    return Results.Redirect("/");
                }
            )
            .WithName("Logout")
            .WithTags("Auth");

        app.MapGet(
                "/api/me",
                (HttpContext ctx) =>
                {
                    var user = AuthHelper.GetUserInfo(ctx);
                    if (user == null)
                        return Results.Unauthorized();

                    return Results.Ok(user);
                }
            )
            .WithName("GetMe")
            .WithTags("Auth")
            .Produces<UserInfo>();

        app.MapPatch(
                "/api/me",
                async (HttpContext ctx, AppDbContext db, UpdateProfileRequest req) =>
                {
                    var userInfo = AuthHelper.GetUserInfo(ctx);
                    if (userInfo == null)
                        return Results.Unauthorized();

                    if (string.IsNullOrWhiteSpace(req.DisplayName))
                        return Results.BadRequest(new { error = "Naam is verplicht." });

                    var user = await db.AppUsers.FindAsync(userInfo.UserId);
                    if (user == null)
                        return Results.Unauthorized();

                    var displayName = req.DisplayName.Trim();
                    user.DisplayName = displayName;

                    var players = await db.Players.Where(p => p.UserId == user.Id).ToListAsync();
                    foreach (var player in players)
                        player.DisplayName = displayName;

                    await db.SaveChangesAsync();

                    await SignIn(ctx, user);
                    string[] roles = user.IsAdmin ? ["authenticated", "admin"] : ["authenticated"];
                    return Results.Ok(new UserInfo(user.Id, displayName, roles));
                }
            )
            .WithName("UpdateProfile")
            .WithTags("Auth")
            .RequireAuthorization()
            .Produces<UserInfo>();
    }

    private static async Task SignIn(HttpContext ctx, AppUser user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.DisplayName),
            new(ClaimTypes.Role, "authenticated"),
        };
        if (user.IsAdmin)
            claims.Add(new Claim(ClaimTypes.Role, "admin"));

        var identity = new ClaimsIdentity(
            claims,
            CookieAuthenticationDefaults.AuthenticationScheme
        );
        await ctx.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = true }
        );
    }

    private sealed record RegisterRequest(
        string Email,
        string DisplayName,
        string Password,
        string? InviteCode
    );

    private sealed record LoginRequest(string Email, string Password);

    private sealed record ForgotPasswordRequest(string Email);

    private sealed record ResetPasswordRequest(string Token, string NewPassword);

    private sealed record UpdateProfileRequest(string DisplayName);

    private sealed record MessageResponse(string Message);
}
