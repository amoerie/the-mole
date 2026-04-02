using Api.Data;
using Api.Models;
using Api.Tests.Helpers;

namespace Api.Tests;

[Collection("Integration")]
public sealed class AdminRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly TestContext _ctx;

    public AdminRoutesTests(CustomWebApplicationFactory factory)
    {
        _ctx = new TestContext(factory, userId: "admin-user-id", displayName: "Admin User");
    }

    [Fact]
    public async Task ListUsers_WhenAdmin_ReturnsOkWithUsers()
    {
        _ctx.PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "u1",
                    Email = "alice@test.com",
                    DisplayName = "Alice",
                    IsAdmin = false,
                }
            );
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "u2",
                    Email = "bob@test.com",
                    DisplayName = "Bob",
                    IsAdmin = true,
                }
            );
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(2, body!.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task ListUsers_WhenNotAdmin_ReturnsForbidden()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsNonAdmin();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ListUsers_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/users");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GrantAdmin_WhenAdmin_SetsUserAsAdmin()
    {
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "target-user",
                    Email = "target@test.com",
                    DisplayName = "Target",
                    IsAdmin = false,
                }
            )
        );
        var client = _ctx.CreateClient();

        var response = await client.PostAsync("/api/admin/users/target-user/grant-admin", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var user = await _ctx.ReadDbAsync(db => db.AppUsers.FindAsync("target-user").AsTask());
        Assert.True(user!.IsAdmin);
    }

    [Fact]
    public async Task GrantAdmin_WhenUserNotFound_ReturnsNotFound()
    {
        _ctx.PrepareDb();
        var client = _ctx.CreateClient();

        var response = await client.PostAsync("/api/admin/users/nonexistent/grant-admin", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GrantAdmin_WhenNotAdmin_ReturnsForbidden()
    {
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "target-user",
                    Email = "target@test.com",
                    DisplayName = "Target",
                    IsAdmin = false,
                }
            )
        );
        using var _ = _ctx.AsNonAdmin();
        var client = _ctx.CreateClient();

        var response = await client.PostAsync("/api/admin/users/target-user/grant-admin", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GrantAdmin_WhenUnauthenticated_ReturnsUnauthorized()
    {
        _ctx.PrepareDb(db =>
            db.AppUsers.Add(
                new AppUser
                {
                    Id = "target-user",
                    Email = "target@test.com",
                    DisplayName = "Target",
                    IsAdmin = false,
                }
            )
        );
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.PostAsync("/api/admin/users/target-user/grant-admin", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
