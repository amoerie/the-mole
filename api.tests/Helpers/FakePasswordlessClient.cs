using Passwordless;
using Passwordless.Models;

namespace Api.Tests.Helpers;

public sealed class FakePasswordlessClient : IPasswordlessClient
{
    public string RegisterToken { get; set; } = "fake-register-token";
    public string VerifyUserId { get; set; } = "test-user-id";
    public bool VerifySuccess { get; set; } = true;

    public Task<RegisterTokenResponse> CreateRegisterTokenAsync(
        RegisterOptions registerOptions,
        CancellationToken cancellationToken = default
    ) => Task.FromResult(new RegisterTokenResponse(RegisterToken));

    public Task<AuthenticationTokenResponse> GenerateAuthenticationTokenAsync(
        AuthenticationOptions authenticationOptions,
        CancellationToken cancellationToken = default
    ) => Task.FromResult(new AuthenticationTokenResponse("fake-auth-token"));

    public Task<VerifiedUser> VerifyAuthenticationTokenAsync(
        string authenticationToken,
        CancellationToken cancellationToken = default
    )
    {
        if (!VerifySuccess)
            throw new PasswordlessApiException(
                new PasswordlessProblemDetails("", "Invalid token", 401, "", "")
            );

        return Task.FromResult(
            new VerifiedUser(
                VerifyUserId,
                [],
                true,
                DateTime.UtcNow,
                string.Empty,
                string.Empty,
                string.Empty,
                string.Empty,
                string.Empty,
                DateTime.UtcNow,
                Guid.NewGuid(),
                string.Empty,
                string.Empty
            )
        );
    }

    public Task<UsersCount> GetUsersCountAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(new UsersCount(0));

    public Task<IReadOnlyList<PasswordlessUserSummary>> ListUsersAsync(
        CancellationToken cancellationToken = default
    ) =>
        Task.FromResult<IReadOnlyList<PasswordlessUserSummary>>(
            Array.Empty<PasswordlessUserSummary>()
        );

    public Task DeleteUserAsync(string userId, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task<IReadOnlyList<AliasPointer>> ListAliasesAsync(
        string userId,
        CancellationToken cancellationToken = default
    ) => Task.FromResult<IReadOnlyList<AliasPointer>>(Array.Empty<AliasPointer>());

    public Task SetAliasAsync(
        SetAliasRequest request,
        CancellationToken cancellationToken = default
    ) => Task.CompletedTask;

    public Task<IReadOnlyList<Credential>> ListCredentialsAsync(
        string userId,
        CancellationToken cancellationToken = default
    ) => Task.FromResult<IReadOnlyList<Credential>>(Array.Empty<Credential>());

    public Task DeleteCredentialAsync(string id, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task DeleteCredentialAsync(byte[] id, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task<GetEventLogResponse> GetEventLogAsync(
        GetEventLogRequest request,
        CancellationToken cancellationToken = default
    ) => Task.FromResult(new GetEventLogResponse(string.Empty, Array.Empty<ApplicationEvent>(), 0));

    public Task SendMagicLinkAsync(
        SendMagicLinkRequest request,
        CancellationToken cancellationToken = default
    ) => Task.CompletedTask;
}
