using Api.Auth;
using Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Api.Routes;

public static class AdminRoutes
{
    public static void MapAdminRoutes(this WebApplication app)
    {
        app.MapPost(
                "/api/admin/users/{userId}/grant-admin",
                async (HttpContext ctx, AppDbContext db, string userId) =>
                {
                    var caller = AuthHelper.GetUserInfo(ctx);
                    if (caller == null)
                        return Results.Unauthorized();

                    if (!caller.Roles.Contains("admin"))
                        return Results.Forbid();

                    var target = await db.AppUsers.FindAsync(userId);
                    if (target == null)
                        return Results.NotFound(new { error = "User not found." });

                    target.IsAdmin = true;
                    await db.SaveChangesAsync();

                    return Results.Ok(
                        new MessageResponse($"{target.DisplayName} is now an admin.")
                    );
                }
            )
            .WithName("GrantAdmin")
            .WithTags("Admin")
            .Produces<MessageResponse>();

        app.MapGet(
                "/api/admin/users",
                async (HttpContext ctx, AppDbContext db) =>
                {
                    var caller = AuthHelper.GetUserInfo(ctx);
                    if (caller == null)
                        return Results.Unauthorized();

                    if (!caller.Roles.Contains("admin"))
                        return Results.Forbid();

                    var users = await db
                        .AppUsers.Select(u => new AdminUserResponse(
                            u.Id,
                            u.Email,
                            u.DisplayName,
                            u.IsAdmin
                        ))
                        .ToListAsync();

                    return Results.Ok(users);
                }
            )
            .WithName("ListUsers")
            .WithTags("Admin")
            .Produces<List<AdminUserResponse>>();
    }

    private sealed record MessageResponse(string Message);

    private sealed record AdminUserResponse(
        string Id,
        string Email,
        string DisplayName,
        bool IsAdmin
    );
}
