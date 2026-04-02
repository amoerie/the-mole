using Api.Auth;
using Api.Models;

namespace Api.Tests.Helpers;

public static class TestData
{
    public static Game Game(string adminUserId = "test-user-id") =>
        new()
        {
            Id = "game-1",
            Name = "Test Game",
            AdminUserId = adminUserId,
            InviteCode = "INVITE01",
        };

    public static Game GameWithContestants(string adminUserId = "test-user-id") =>
        new()
        {
            Id = "game-1",
            Name = "Test Game",
            AdminUserId = adminUserId,
            InviteCode = "INVITE01",
            Contestants =
            [
                new Contestant
                {
                    Id = "contestant-1",
                    Name = "Alice",
                    Age = 30,
                    PhotoUrl = "",
                },
                new Contestant
                {
                    Id = "contestant-2",
                    Name = "Bob",
                    Age = 25,
                    PhotoUrl = "",
                },
            ],
        };

    public static (Game Game, Player Player) GameWithPlayer(string adminUserId = "admin-user")
    {
        var game = GameWithContestants(adminUserId);
        game.Episodes.Add(Episode());
        return (game, Player());
    }

    public static Player Player(
        string gameId = "game-1",
        string userId = "test-user-id",
        string displayName = "Test User"
    ) =>
        new()
        {
            GameId = gameId,
            UserId = userId,
            DisplayName = displayName,
        };

    public static AppUser User(
        string id = "test-user-id",
        string email = "alice@test.com",
        string displayName = "Alice",
        string password = "P@ssw0rd!"
    ) =>
        new()
        {
            Id = id,
            Email = email,
            DisplayName = displayName,
            PasswordHash = PasswordHelper.Hash(password),
        };

    public static Episode Episode(int number = 1, bool future = true) =>
        new()
        {
            Number = number,
            Deadline = future
                ? DateTimeOffset.UtcNow.AddDays(7)
                : DateTimeOffset.UtcNow.AddDays(-1),
        };
}
