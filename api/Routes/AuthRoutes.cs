using Api.Auth;
using AspNet.Security.OAuth.GitHub;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace Api.Routes;

public static class AuthRoutes
{
    public static void MapAuthRoutes(this WebApplication app)
    {
        app.MapGet(
            "/auth/login/github",
            (HttpContext ctx, IConfiguration config, string? returnUrl) =>
            {
                var frontendUrl = config["FrontendUrl"] ?? "/";
                var redirectUri = frontendUrl + (returnUrl ?? "");
                var properties = new AuthenticationProperties { RedirectUri = redirectUri };
                return Results.Challenge(
                    properties,
                    [GitHubAuthenticationDefaults.AuthenticationScheme]
                );
            }
        );

        app.MapGet(
            "/auth/logout",
            async (HttpContext ctx) =>
            {
                await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return Results.Redirect("/");
            }
        );

        app.MapGet(
            "/api/me",
            (HttpContext ctx) =>
            {
                var user = AuthHelper.GetUserInfo(ctx);
                if (user == null)
                    return Results.Unauthorized();

                return Results.Ok(
                    new
                    {
                        user.UserId,
                        user.DisplayName,
                        user.Roles,
                    }
                );
            }
        );
    }
}
