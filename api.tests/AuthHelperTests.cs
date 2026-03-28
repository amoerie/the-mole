using System.Security.Claims;
using Api.Auth;
using Microsoft.AspNetCore.Http;

namespace Api.Tests;

public class AuthHelperTests
{
    private static DefaultHttpContext CreateAuthenticatedContext(
        string userId,
        string login,
        string? fullName = null
    )
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId),
            new(ClaimTypes.Name, login),
        };
        if (fullName != null)
            claims.Add(new Claim("urn:github:name", fullName));

        var identity = new ClaimsIdentity(claims, "GitHub");
        var context = new DefaultHttpContext { User = new ClaimsPrincipal(identity) };
        return context;
    }

    [Fact]
    public void GetUserInfo_AuthenticatedUser_ReturnsCorrectUserIdAndDisplayName()
    {
        var ctx = CreateAuthenticatedContext("123456", "testuser", "Test User");

        var result = AuthHelper.GetUserInfo(ctx);

        Assert.NotNull(result);
        Assert.Equal("123456", result!.UserId);
        Assert.Equal("Test User", result.DisplayName);
        Assert.Contains("authenticated", result.Roles);
    }

    [Fact]
    public void GetUserInfo_NoFullName_FallsBackToLogin()
    {
        var ctx = CreateAuthenticatedContext("123456", "testuser");

        var result = AuthHelper.GetUserInfo(ctx);

        Assert.NotNull(result);
        Assert.Equal("testuser", result!.DisplayName);
    }

    [Fact]
    public void GetUserInfo_UnauthenticatedUser_ReturnsNull()
    {
        var context = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) };

        var result = AuthHelper.GetUserInfo(context);

        Assert.Null(result);
    }
}
