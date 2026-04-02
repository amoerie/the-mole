using Api.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests.Helpers;

public sealed class TestContext
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly string _defaultUserId;
    private readonly string _defaultDisplayName;
    private readonly string[] _defaultRoles;

    public FakeEmailService EmailService => _factory.EmailService;

    public TestContext(
        CustomWebApplicationFactory factory,
        string userId = "test-user-id",
        string displayName = "Test User",
        string[]? roles = null
    )
    {
        _factory = factory;
        _defaultUserId = userId;
        _defaultDisplayName = displayName;
        _defaultRoles = roles ?? ["authenticated", "admin"];
        ResetAuth();
    }

    public HttpClient CreateClient() =>
        _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    public void PrepareDb(Action<AppDbContext>? seed = null)
    {
        _factory.ResetDb();
        _factory.EmailService.SentEmails.Clear();
        _factory.EmailService.SentReminders.Clear();
        if (seed == null)
            return;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        seed(db);
        db.SaveChanges();
    }

    public T ReadDb<T>(Func<AppDbContext, T> query)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return query(db);
    }

    public async Task<T> ReadDbAsync<T>(Func<AppDbContext, Task<T>> query)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await query(db);
    }

    public IDisposable AsUnauthenticated()
    {
        TestAuthHandler.IsAuthenticated = false;
        return new DeferredAction(ResetAuth);
    }

    public IDisposable AsNonAdmin()
    {
        TestAuthHandler.IsAuthenticated = true;
        TestAuthHandler.Roles = ["authenticated"];
        return new DeferredAction(ResetAuth);
    }

    private void ResetAuth()
    {
        TestAuthHandler.UserId = _defaultUserId;
        TestAuthHandler.DisplayName = _defaultDisplayName;
        TestAuthHandler.IsAuthenticated = true;
        TestAuthHandler.Roles = _defaultRoles;
    }

    private sealed class DeferredAction(Action action) : IDisposable
    {
        public void Dispose() => action();
    }
}
