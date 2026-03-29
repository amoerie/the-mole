using System.Security.Claims;
using Api.Auth;
using Microsoft.AspNetCore.Http;

namespace Api.Tests;

public class AuthHelperTests
{
    private static DefaultHttpContext CreateAuthenticatedContext(
        string userId,
        string? displayName = null
    )
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId) };
        if (displayName != null)
            claims.Add(new Claim(ClaimTypes.Name, displayName));

        var identity = new ClaimsIdentity(claims, "Passkey");
        var context = new DefaultHttpContext { User = new ClaimsPrincipal(identity) };
        return context;
    }

    [Fact]
    public void GetUserInfo_AuthenticatedUser_ReturnsCorrectUserIdAndDisplayName()
    {
        var ctx = CreateAuthenticatedContext("123456", "Test User");

        var result = AuthHelper.GetUserInfo(ctx);

        Assert.NotNull(result);
        Assert.Equal("123456", result!.UserId);
        Assert.Equal("Test User", result.DisplayName);
        Assert.Contains("authenticated", result.Roles);
    }

    [Fact]
    public void GetUserInfo_NoDisplayName_FallsBackToUserId()
    {
        var ctx = CreateAuthenticatedContext("123456");

        var result = AuthHelper.GetUserInfo(ctx);

        Assert.NotNull(result);
        Assert.Equal("123456", result!.DisplayName);
    }

    [Fact]
    public void GetUserInfo_UnauthenticatedUser_ReturnsNull()
    {
        var context = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) };

        var result = AuthHelper.GetUserInfo(context);

        Assert.Null(result);
    }
}
