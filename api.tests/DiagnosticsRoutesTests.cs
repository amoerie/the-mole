using System.Net.Http.Json;
using Api.Data;
using Api.Models;
using Api.Tests.Helpers;

namespace Api.Tests;

[Collection("Integration")]
public sealed class DiagnosticsRoutesTests : IClassFixture<CustomWebApplicationFactory>
{
    // The AdminEmail configured in CustomWebApplicationFactory is "admin@test.com".
    private const string AdminEmail = "admin@test.com";
    private const string AdminUserId = "diag-admin-id";

    private readonly TestContext _ctx;

    public DiagnosticsRoutesTests(CustomWebApplicationFactory factory)
    {
        _ctx = new TestContext(factory, userId: AdminUserId, displayName: "Diag Admin");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// <summary>Seeds the DB with a super-admin user matching the test auth identity.</summary>
    private void PrepareWithAdmin(Action<AppDbContext>? extra = null) =>
        _ctx.PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = AdminUserId,
                    Email = AdminEmail,
                    DisplayName = "Diag Admin",
                    IsAdmin = true,
                }
            );
            extra?.Invoke(db);
        });

    // ── POST /api/admin/diagnostics/query ────────────────────────────────────

    [Fact]
    public async Task Query_WhenSuperAdmin_ReturnsColumnsAndRows()
    {
        PrepareWithAdmin();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/admin/diagnostics/query",
            new { sql = "SELECT 1 AS n" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal("n", body!.RootElement.GetProperty("columns")[0].GetString());
        Assert.Equal("1", body.RootElement.GetProperty("rows")[0][0].GetString());
    }

    [Fact]
    public async Task Query_EmptyResultSet_ReturnsColumnsAndEmptyRows()
    {
        PrepareWithAdmin();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/admin/diagnostics/query",
            new { sql = "SELECT id FROM AppUsers WHERE id = 'does-not-exist'" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body);
        Assert.Equal(0, body!.RootElement.GetProperty("rows").GetArrayLength());
    }

    [Fact]
    public async Task Query_WriteStatement_ReturnsOk()
    {
        PrepareWithAdmin();
        var client = _ctx.CreateClient();

        // A no-op DELETE proves write statements are accepted.
        // Using a WHERE clause that matches nothing avoids constraint issues
        // and the concurrent-connection race that INSERT triggers on the
        // shared in-memory SQLite connection in the test environment.
        var response = await client.PostAsJsonAsync(
            "/api/admin/diagnostics/query",
            new { sql = "DELETE FROM AppUsers WHERE 1=0" }
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Query_EmptySql_ReturnsBadRequest()
    {
        PrepareWithAdmin();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/admin/diagnostics/query",
            new { sql = "   " }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Query_SqliteError_ReturnsBadRequest()
    {
        PrepareWithAdmin();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/admin/diagnostics/query",
            new { sql = "SELECT * FROM NonExistentTable" }
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(body!.RootElement.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Query_WhenNonAdminRole_ReturnsForbidden()
    {
        PrepareWithAdmin();
        using var _ = _ctx.AsNonAdmin();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/admin/diagnostics/query",
            new { sql = "SELECT 1" }
        );

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Query_WhenUnauthenticated_ReturnsUnauthorized()
    {
        PrepareWithAdmin();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/admin/diagnostics/query",
            new { sql = "SELECT 1" }
        );

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Query_WhenAdminRoleButNotSuperAdminEmail_ReturnsForbidden()
    {
        _ctx.PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = AdminUserId,
                    Email = "other-admin@test.com", // different email than AdminEmail
                    DisplayName = "Other Admin",
                    IsAdmin = true,
                }
            );
        });
        var client = _ctx.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/admin/diagnostics/query",
            new { sql = "SELECT 1" }
        );

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ── GET /api/admin/diagnostics/logs/stream ───────────────────────────────

    [Fact]
    public async Task LogStream_WhenSuperAdmin_ReturnsTextEventStream()
    {
        PrepareWithAdmin();
        var client = _ctx.CreateClient();

        // Use a CancellationToken so the SSE stream doesn't block the test
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            "/api/admin/diagnostics/logs/stream"
        );
        request.Headers.Accept.ParseAdd("text/event-stream");

        var response = await client.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cts.Token
        );

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/event-stream", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task LogStream_WhenUnauthenticated_ReturnsUnauthorized()
    {
        PrepareWithAdmin();
        using var _ = _ctx.AsUnauthenticated();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/diagnostics/logs/stream");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task LogStream_WhenNonAdminRole_ReturnsForbidden()
    {
        PrepareWithAdmin();
        using var _ = _ctx.AsNonAdmin();
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/diagnostics/logs/stream");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task LogStream_WhenAdminRoleButNotSuperAdminEmail_ReturnsForbidden()
    {
        _ctx.PrepareDb(db =>
        {
            db.AppUsers.Add(
                new AppUser
                {
                    Id = AdminUserId,
                    Email = "other-admin@test.com",
                    DisplayName = "Other Admin",
                    IsAdmin = true,
                }
            );
        });
        var client = _ctx.CreateClient();

        var response = await client.GetAsync("/api/admin/diagnostics/logs/stream");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
