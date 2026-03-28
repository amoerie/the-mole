using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;

namespace Api.Auth;

public record UserInfo(string UserId, string DisplayName, string[] Roles);

public static class AuthHelper
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public static UserInfo? GetUserInfo(HttpRequest request)
    {
        if (!request.Headers.TryGetValue("x-ms-client-principal", out var headerValue))
            return null;

        var header = headerValue.FirstOrDefault();
        if (string.IsNullOrEmpty(header))
            return null;

        try
        {
            var decoded = Convert.FromBase64String(header);
            var json = Encoding.UTF8.GetString(decoded);
            var principal = JsonSerializer.Deserialize<ClientPrincipal>(json, JsonOptions);

            if (principal == null || string.IsNullOrEmpty(principal.UserId))
                return null;

            return new UserInfo(
                principal.UserId,
                principal.UserDetails ?? principal.UserId,
                principal.UserRoles ?? []
            );
        }
        catch
        {
            return null;
        }
    }

    private sealed class ClientPrincipal
    {
        public string? IdentityProvider { get; set; }
        public string? UserId { get; set; }
        public string? UserDetails { get; set; }
        public string[]? UserRoles { get; set; }
    }
}
