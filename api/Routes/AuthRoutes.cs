using System.Security.Claims;
using Api.Auth;
using Api.Data;
using Api.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Passwordless;
using Passwordless.Models;

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
                    IPasswordlessClient passwordlessClient,
                    IConfiguration config
                ) =>
                {
                    if (
                        string.IsNullOrWhiteSpace(req.Email)
                        || string.IsNullOrWhiteSpace(req.DisplayName)
                    )
                        return Results.BadRequest(
                            new { error = "E-mailadres en naam zijn verplicht." }
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

                    var user = await db.AppUsers.FirstOrDefaultAsync(u => u.Email == email);
                    if (user == null)
                    {
                        user = new AppUser
                        {
                            Email = email,
                            DisplayName = req.DisplayName.Trim(),
                            IsAdmin = email == adminEmail,
                        };
                        db.AppUsers.Add(user);
                    }
                    else
                    {
                        user.DisplayName = req.DisplayName.Trim();
                    }

                    await db.SaveChangesAsync();

                    var tokenResponse = await passwordlessClient.CreateRegisterTokenAsync(
                        new RegisterOptions(user.Id, user.DisplayName)
                        {
                            Aliases = [user.Email],
                            AliasHashing = false,
                        }
                    );

                    return Results.Ok(new RegisterTokenResponse(tokenResponse.Token));
                }
            )
            .WithName("RegisterPasskey")
            .WithTags("Auth")
            .Produces<RegisterTokenResponse>();

        app.MapPost(
                "/api/auth/verify",
                async (
                    HttpContext ctx,
                    VerifyRequest req,
                    AppDbContext db,
                    IPasswordlessClient passwordlessClient
                ) =>
                {
                    VerifiedUser verified;
                    try
                    {
                        verified = await passwordlessClient.VerifyAuthenticationTokenAsync(
                            req.Token
                        );
                    }
                    catch (PasswordlessApiException)
                    {
                        return Results.Unauthorized();
                    }

                    var user = await db.AppUsers.FindAsync(verified.UserId);
                    if (user == null)
                        return Results.Unauthorized();

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
                        new ClaimsPrincipal(identity)
                    );

                    return Results.Ok(new UserInfo(user.Id, user.DisplayName, ["authenticated"]));
                }
            )
            .WithName("VerifyPasskey")
            .WithTags("Auth")
            .Produces<UserInfo>();

        app.MapPost(
                "/api/auth/recover",
                async (
                    RecoverRequest req,
                    AppDbContext db,
                    IPasswordlessClient passwordlessClient,
                    IConfiguration config
                ) =>
                {
                    var email = req.Email.Trim().ToLowerInvariant();
                    var user = await db.AppUsers.FirstOrDefaultAsync(u => u.Email == email);

                    if (user != null)
                    {
                        var baseUrl = (config["BaseUrl"] ?? "").TrimEnd('/');
                        await passwordlessClient.SendMagicLinkAsync(
                            new SendMagicLinkRequest(
                                user.Email,
                                $"{baseUrl}/magic-link?token=$TOKEN",
                                user.Id,
                                TimeSpan.FromHours(1)
                            )
                        );
                    }

                    return Results.Ok(
                        new MessageResponse(
                            "Als dit e-mailadres bekend is, ontvang je een herstelmail."
                        )
                    );
                }
            )
            .WithName("RequestRecovery")
            .WithTags("Auth")
            .Produces<MessageResponse>();

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
    }

    private sealed record RegisterRequest(string Email, string DisplayName, string? InviteCode);

    private sealed record VerifyRequest(string Token);

    private sealed record RecoverRequest(string Email);

    private sealed record RegisterTokenResponse(string Token);

    private sealed record MessageResponse(string Message);
}
