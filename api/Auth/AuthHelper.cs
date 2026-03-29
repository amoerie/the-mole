using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace Api.Auth;

public record UserInfo(string UserId, string DisplayName, string[] Roles);

public static class AuthHelper
{
    public static UserInfo? GetUserInfo(HttpContext context)
    {
        var user = context.User;
        if (user.Identity?.IsAuthenticated != true)
            return null;

        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return null;

        var displayName = user.FindFirstValue(ClaimTypes.Name) ?? userId;

        return new UserInfo(userId, displayName, ["authenticated"]);
    }
}
