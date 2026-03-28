using System.Text;
using System.Text.Json;
using Api.Auth;
using Microsoft.AspNetCore.Http;

namespace Api.Tests;

public class AuthHelperTests
{
    private static HttpRequest CreateRequestWithHeader(string? headerValue)
    {
        var context = new DefaultHttpContext();
        if (headerValue != null)
            context.Request.Headers["x-ms-client-principal"] = headerValue;
        return context.Request;
    }

    private static string EncodeClientPrincipal(object principal) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(principal)));

    [Fact]
    public void GetUserInfo_ValidHeader_ReturnsCorrectUserIdAndDisplayName()
    {
        var principal = new
        {
            identityProvider = "github",
            userId = "test-user-123",
            userDetails = "testuser",
            userRoles = new[] { "authenticated", "anonymous" },
        };
        var request = CreateRequestWithHeader(EncodeClientPrincipal(principal));

        var result = AuthHelper.GetUserInfo(request);

        Assert.NotNull(result);
        Assert.Equal("test-user-123", result!.UserId);
        Assert.Equal("testuser", result.DisplayName);
        Assert.Contains("authenticated", result.Roles);
        Assert.Contains("anonymous", result.Roles);
    }

    [Fact]
    public void GetUserInfo_DifferentProvider_ReturnsCorrectValues()
    {
        var principal = new
        {
            identityProvider = "aad",
            userId = "aad-user-456",
            userDetails = "aaduser@example.com",
            userRoles = new[] { "authenticated" },
        };
        var request = CreateRequestWithHeader(EncodeClientPrincipal(principal));

        var result = AuthHelper.GetUserInfo(request);

        Assert.NotNull(result);
        Assert.Equal("aad-user-456", result!.UserId);
        Assert.Equal("aaduser@example.com", result.DisplayName);
    }

    [Fact]
    public void GetUserInfo_MissingHeader_ReturnsNull()
    {
        var request = CreateRequestWithHeader(null);

        var result = AuthHelper.GetUserInfo(request);

        Assert.Null(result);
    }

    [Fact]
    public void GetUserInfo_EmptyHeader_ReturnsNull()
    {
        var request = CreateRequestWithHeader("");

        var result = AuthHelper.GetUserInfo(request);

        Assert.Null(result);
    }

    [Fact]
    public void GetUserInfo_InvalidBase64_ReturnsNull()
    {
        var request = CreateRequestWithHeader("not-valid-base64!!!");

        var result = AuthHelper.GetUserInfo(request);

        Assert.Null(result);
    }

    [Fact]
    public void GetUserInfo_InvalidJson_ReturnsNull()
    {
        var encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes("this is not json"));
        var request = CreateRequestWithHeader(encoded);

        var result = AuthHelper.GetUserInfo(request);

        Assert.Null(result);
    }
}
