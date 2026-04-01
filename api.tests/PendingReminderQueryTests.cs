using Api.Data;
using Api.Models;
using Api.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Api.Tests;

public sealed class PendingReminderQueryTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _db;

    public PendingReminderQueryTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        _db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options
        );
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private PendingReminderQuery CreateQuery() => new(_db);

    private static readonly DateTimeOffset FutureDeadline = DateTimeOffset.UtcNow.AddDays(7);
    private static readonly DateTimeOffset PastDeadline = DateTimeOffset.UtcNow.AddDays(-1);

    // ── Helpers ─────────────────────────────────────────────────────────────

    private AppUser SeedUser(
        string id = "user-1",
        string email = "user@test.com",
        string displayName = "User",
        bool reminderEmailsEnabled = true
    )
    {
        var user = new AppUser
        {
            Id = id,
            Email = email,
            DisplayName = displayName,
            PasswordHash = "hash",
            ReminderEmailsEnabled = reminderEmailsEnabled,
        };
        _db.AppUsers.Add(user);
        _db.SaveChanges();
        return user;
    }

    private Game SeedGame(
        string id = "game-1",
        int episodeNumber = 1,
        DateTimeOffset? deadline = null
    )
    {
        var game = new Game
        {
            Id = id,
            Name = $"Game {id}",
            AdminUserId = "admin",
            InviteCode = id,
            Episodes =
            [
                new Episode { Number = episodeNumber, Deadline = deadline ?? FutureDeadline },
            ],
        };
        _db.Games.Add(game);
        _db.SaveChanges();
        return game;
    }

    private Player SeedPlayer(string gameId, string userId, string? id = null)
    {
        var player = new Player
        {
            Id = id ?? Guid.NewGuid().ToString(),
            GameId = gameId,
            UserId = userId,
            DisplayName = "Player",
            JoinedAt = DateTimeOffset.UtcNow,
        };
        _db.Players.Add(player);
        _db.SaveChanges();
        return player;
    }

    private void SeedRanking(string gameId, string userId, int episodeNumber)
    {
        _db.Rankings.Add(
            new Ranking
            {
                Id = Guid.NewGuid().ToString(),
                GameId = gameId,
                UserId = userId,
                EpisodeNumber = episodeNumber,
                ContestantIds = [],
                SubmittedAt = DateTimeOffset.UtcNow,
            }
        );
        _db.SaveChanges();
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetPendingRecipients_WhenNoGames_ReturnsEmpty()
    {
        var result = await CreateQuery().GetPendingRecipientsAsync("https://example.com", default);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetPendingRecipients_WhenGameHasNoOpenEpisode_ReturnsEmpty()
    {
        SeedGame(deadline: PastDeadline);

        var result = await CreateQuery().GetPendingRecipientsAsync("https://example.com", default);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetPendingRecipients_WhenOpenEpisodeButNoPlayers_ReturnsEmpty()
    {
        SeedGame();

        var result = await CreateQuery().GetPendingRecipientsAsync("https://example.com", default);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetPendingRecipients_WhenPlayerHasSubmittedRanking_ReturnsEmpty()
    {
        var user = SeedUser();
        SeedGame();
        SeedPlayer("game-1", user.Id);
        SeedRanking("game-1", user.Id, episodeNumber: 1);

        var result = await CreateQuery().GetPendingRecipientsAsync("https://example.com", default);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetPendingRecipients_WhenPlayerHasNotSubmitted_ReturnsRecipient()
    {
        var user = SeedUser(email: "alice@test.com", displayName: "Alice");
        SeedGame();
        SeedPlayer("game-1", user.Id);

        var result = await CreateQuery().GetPendingRecipientsAsync("https://example.com", default);

        var recipient = Assert.Single(result);
        Assert.Equal("alice@test.com", recipient.Email);
        Assert.Equal("Alice", recipient.DisplayName);
        Assert.Single(recipient.Games);
    }

    [Fact]
    public async Task GetPendingRecipients_GameUrlContainsBaseUrlAndGameId()
    {
        var user = SeedUser();
        SeedGame(id: "game-abc");
        SeedPlayer("game-abc", user.Id);

        var result = await CreateQuery().GetPendingRecipientsAsync("https://example.com", default);

        var recipient = Assert.Single(result);
        var (_, gameUrl) = Assert.Single(recipient.Games);
        Assert.Equal("https://example.com/login?redirect=/game/game-abc", gameUrl);
    }

    [Fact]
    public async Task GetPendingRecipients_WhenUserOptedOut_ReturnsEmpty()
    {
        var user = SeedUser(reminderEmailsEnabled: false);
        SeedGame();
        SeedPlayer("game-1", user.Id);

        var result = await CreateQuery().GetPendingRecipientsAsync("https://example.com", default);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetPendingRecipients_WhenPlayerMissingInSomeGames_OnlyIncludesMissingGames()
    {
        var user = SeedUser();
        SeedGame(id: "game-1");
        SeedGame(id: "game-2");
        SeedPlayer("game-1", user.Id);
        SeedPlayer("game-2", user.Id);
        SeedRanking("game-1", user.Id, episodeNumber: 1); // submitted for game-1 only

        var result = await CreateQuery().GetPendingRecipientsAsync("https://example.com", default);

        var recipient = Assert.Single(result);
        var (gameName, _) = Assert.Single(recipient.Games);
        Assert.Equal("Game game-2", gameName);
    }

    [Fact]
    public async Task GetPendingRecipients_WithMultipleUsersNeedingReminders_ReturnsAll()
    {
        var alice = SeedUser(id: "alice", email: "alice@test.com", displayName: "Alice");
        var bob = SeedUser(id: "bob", email: "bob@test.com", displayName: "Bob");
        SeedGame();
        SeedPlayer("game-1", alice.Id);
        SeedPlayer("game-1", bob.Id);

        var result = await CreateQuery().GetPendingRecipientsAsync("https://example.com", default);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, r => r.Email == "alice@test.com");
        Assert.Contains(result, r => r.Email == "bob@test.com");
    }

    [Fact]
    public async Task GetPendingRecipients_WhenSubmittingForDifferentEpisode_StillReturnsRecipient()
    {
        // Submitted for episode 2, but open episode is 1 — should still remind
        var user = SeedUser();
        SeedGame(episodeNumber: 1);
        SeedPlayer("game-1", user.Id);
        SeedRanking("game-1", user.Id, episodeNumber: 2);

        var result = await CreateQuery().GetPendingRecipientsAsync("https://example.com", default);

        Assert.Single(result);
    }
}
