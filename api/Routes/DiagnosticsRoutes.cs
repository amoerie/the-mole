using System.Text.Json;
using Api.Auth;
using Api.Data;
using Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Api.Routes;

public static class DiagnosticsRoutes
{
    private static readonly JsonSerializerOptions CamelCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public static void MapDiagnosticsRoutes(this WebApplication app)
    {
        app.MapPost(
                "/api/admin/diagnostics/query",
                async (
                    HttpContext ctx,
                    AppDbContext db,
                    IConfiguration config,
                    QueryRequest request
                ) =>
                {
                    if (await RejectIfNotSuperAdmin(ctx, db, config) is { } rejection)
                        return rejection;

                    var sql = request.Sql?.Trim() ?? "";
                    if (string.IsNullOrWhiteSpace(sql))
                        return Results.BadRequest(new { error = "SQL query is required." });

                    var ct = ctx.RequestAborted;

                    try
                    {
                        var connection = db.Database.GetDbConnection();
                        if (connection.State != System.Data.ConnectionState.Open)
                            await connection.OpenAsync(ct);

                        await using var command = connection.CreateCommand();
                        command.CommandText = sql;
                        command.CommandTimeout = 30;

                        await using var reader = await command.ExecuteReaderAsync(ct);

                        var columns = Enumerable
                            .Range(0, reader.FieldCount)
                            .Select(i => reader.GetName(i))
                            .ToList();

                        var rows = new List<List<string?>>();
                        while (await reader.ReadAsync(ct))
                        {
                            var row = Enumerable
                                .Range(0, reader.FieldCount)
                                .Select(i =>
                                    reader.IsDBNull(i) ? null : reader.GetValue(i)?.ToString()
                                )
                                .ToList();
                            rows.Add(row);
                        }

                        return Results.Ok(new QueryResult(columns, rows));
                    }
                    catch (Exception ex)
                    {
                        return Results.BadRequest(new { error = ex.Message });
                    }
                }
            )
            .WithName("ExecuteQuery")
            .WithTags("Admin")
            .Produces<QueryResult>();

        app.MapGet(
                "/api/admin/diagnostics/logs/stream",
                async (
                    HttpContext ctx,
                    AppDbContext db,
                    IConfiguration config,
                    LogBroadcaster broadcaster
                ) =>
                {
                    if (await RejectIfNotSuperAdmin(ctx, db, config) is { } rejection)
                    {
                        await rejection.ExecuteAsync(ctx);
                        return;
                    }

                    ctx.Response.Headers.Append("Content-Type", "text/event-stream");
                    ctx.Response.Headers.Append("Cache-Control", "no-cache");
                    ctx.Response.Headers.Append("Connection", "keep-alive");
                    ctx.Response.Headers.Append("X-Accel-Buffering", "no");

                    // Subscribe and snapshot history atomically so no entry can appear
                    // in both the replay and the live channel (duplicate-free guarantee).
                    var (channel, history) = broadcaster.SubscribeWithHistory();
                    var ct = ctx.RequestAborted;

                    try
                    {
                        foreach (var entry in history)
                            await WriteEntry(ctx.Response, entry, ct);

                        await ctx.Response.Body.FlushAsync(ct);

                        await foreach (var entry in channel.Reader.ReadAllAsync(ct))
                        {
                            await WriteEntry(ctx.Response, entry, ct);
                            await ctx.Response.Body.FlushAsync(ct);
                        }
                    }
                    catch (OperationCanceledException) { }
                    finally
                    {
                        broadcaster.Unsubscribe(channel);
                    }
                }
            )
            .WithName("StreamLogs")
            .WithTags("Admin");
    }

    private static async Task<IResult?> RejectIfNotSuperAdmin(
        HttpContext ctx,
        AppDbContext db,
        IConfiguration config
    )
    {
        var caller = AuthHelper.GetUserInfo(ctx);
        if (caller == null)
            return Results.Unauthorized();

        if (!caller.Roles.Contains("admin"))
            return Results.Forbid();

        var adminEmail = (config["AdminEmail"] ?? "").Trim().ToLowerInvariant();
        var user = await db.AppUsers.FindAsync(caller.UserId);
        if (
            user == null
            || !string.Equals(user.Email.Trim(), adminEmail, StringComparison.OrdinalIgnoreCase)
        )
            return Results.Forbid();

        return null;
    }

    private static async Task WriteEntry(
        HttpResponse response,
        LogEntry entry,
        CancellationToken ct
    )
    {
        var json = JsonSerializer.Serialize(entry, CamelCase);
        await response.WriteAsync($"data: {json}\n\n", ct);
    }

    private sealed record QueryRequest(string? Sql);

    private sealed record QueryResult(List<string> Columns, List<List<string?>> Rows);
}
