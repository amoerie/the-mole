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
        DateTimeOffset? deadline = null,
        List<Contestant>? contestants = null
    )
    {
        var game = new Game
        {
            Id = id,
            Name = $"Game {id}",
            AdminUserId = "admin",
            InviteCode = id,
            Contestants = contestants ?? [],
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

    private void SeedRanking(
        string gameId,
        string userId,
        int episodeNumber,
        List<string>? contestantIds = null
    )
    {
        _db.Rankings.Add(
            new Ranking
            {
                Id = Guid.NewGuid().ToString(),
                GameId = gameId,
                UserId = userId,
                EpisodeNumber = episodeNumber,
                ContestantIds = contestantIds ?? [],
                SubmittedAt = DateTimeOffset.UtcNow,
            }
        );
        _db.SaveChanges();
    }

    // ── GetRecipientsAsync ───────────────────────────────────────────────────

    [Fact]
    public async Task GetRecipients_WhenNoGames_ReturnsEmpty()
    {
        var result = await CreateQuery().GetRecipientsAsync("https://example.com", default);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetRecipients_WhenGameHasNoOpenEpisode_ReturnsEmpty()
    {
        SeedGame(deadline: PastDeadline);

        var result = await CreateQuery().GetRecipientsAsync("https://example.com", default);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetRecipients_WhenOpenEpisodeButNoPlayers_ReturnsEmpty()
    {
        SeedGame();

        var result = await CreateQuery().GetRecipientsAsync("https://example.com", default);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetRecipients_WhenPlayerHasNoRanking_ReturnsEmpty()
    {
        var user = SeedUser();
        SeedGame();
        SeedPlayer("game-1", user.Id);
        // No ranking seeded

        var result = await CreateQuery().GetRecipientsAsync("https://example.com", default);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetRecipients_WhenPlayerHasRanking_ReturnsRecipient()
    {
        var user = SeedUser(email: "alice@test.com", displayName: "Alice");
        SeedGame();
        SeedPlayer("game-1", user.Id);
        SeedRanking("game-1", user.Id, episodeNumber: 1);

        var result = await CreateQuery().GetRecipientsAsync("https://example.com", default);

        var recipient = Assert.Single(result);
        Assert.Equal("alice@test.com", recipient.Email);
        Assert.Equal("Alice", recipient.DisplayName);
        Assert.Single(recipient.Games);
    }

    [Fact]
    public async Task GetRecipients_GameUrlContainsBaseUrlAndGameId()
    {
        var user = SeedUser();
        SeedGame(id: "game-abc");
        SeedPlayer("game-abc", user.Id);
        SeedRanking("game-abc", user.Id, episodeNumber: 1);

        var result = await CreateQuery().GetRecipientsAsync("https://example.com", default);

        var recipient = Assert.Single(result);
        var gameInfo = Assert.Single(recipient.Games);
        Assert.Equal("https://example.com/login?redirect=/game/game-abc", gameInfo.GameUrl);
    }

    [Fact]
    public async Task GetRecipients_DeadlineIsIncludedInGameInfo()
    {
        var user = SeedUser();
        SeedGame(deadline: FutureDeadline);
        SeedPlayer("game-1", user.Id);
        SeedRanking("game-1", user.Id, episodeNumber: 1);

        var result = await CreateQuery().GetRecipientsAsync("https://example.com", default);

        var gameInfo = Assert.Single(Assert.Single(result).Games);
        Assert.Equal(FutureDeadline.ToUnixTimeSeconds(), gameInfo.Deadline.ToUnixTimeSeconds());
    }

    [Fact]
    public async Task GetRecipients_RankedContestantNamesAreMapped()
    {
        var user = SeedUser();
        var c1 = new Contestant
        {
            Id = "c1",
            Name = "Alice",
            Age = 30,
            PhotoUrl = "",
        };
        var c2 = new Contestant
        {
            Id = "c2",
            Name = "Bob",
            Age = 25,
            PhotoUrl = "",
        };
        SeedGame(contestants: [c1, c2]);
        SeedPlayer("game-1", user.Id);
        SeedRanking("game-1", user.Id, episodeNumber: 1, contestantIds: ["c1", "c2"]);

        var result = await CreateQuery().GetRecipientsAsync("https://example.com", default);

        var gameInfo = Assert.Single(Assert.Single(result).Games);
        Assert.Equal(["Alice", "Bob"], gameInfo.RankedContestantNames);
    }

    [Fact]
    public async Task GetRecipients_WhenUserOptedOut_ReturnsEmpty()
    {
        var user = SeedUser(reminderEmailsEnabled: false);
        SeedGame();
        SeedPlayer("game-1", user.Id);
        SeedRanking("game-1", user.Id, episodeNumber: 1);

        var result = await CreateQuery().GetRecipientsAsync("https://example.com", default);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetRecipients_WhenPlayerHasRankingInOnlyOneGame_ReturnsOnlyThatGame()
    {
        var user = SeedUser();
        SeedGame(id: "game-1");
        SeedGame(id: "game-2");
        SeedPlayer("game-1", user.Id);
        SeedPlayer("game-2", user.Id);
        SeedRanking("game-1", user.Id, episodeNumber: 1);
        // No ranking for game-2

        var result = await CreateQuery().GetRecipientsAsync("https://example.com", default);

        var recipient = Assert.Single(result);
        var gameInfo = Assert.Single(recipient.Games);
        Assert.Equal("Game game-1", gameInfo.GameName);
    }

    [Fact]
    public async Task GetRecipients_WithMultipleUsers_ReturnsAll()
    {
        var alice = SeedUser(id: "alice", email: "alice@test.com", displayName: "Alice");
        var bob = SeedUser(id: "bob", email: "bob@test.com", displayName: "Bob");
        SeedGame();
        SeedPlayer("game-1", alice.Id);
        SeedPlayer("game-1", bob.Id);
        SeedRanking("game-1", alice.Id, episodeNumber: 1);
        SeedRanking("game-1", bob.Id, episodeNumber: 1);

        var result = await CreateQuery().GetRecipientsAsync("https://example.com", default);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, r => r.Email == "alice@test.com");
        Assert.Contains(result, r => r.Email == "bob@test.com");
    }

    [Fact]
    public async Task GetRecipients_WhenRankingIsForDifferentEpisode_ReturnsEmpty()
    {
        // Submitted for episode 2, but open episode is 1 — ranking doesn't match
        var user = SeedUser();
        SeedGame(episodeNumber: 1);
        SeedPlayer("game-1", user.Id);
        SeedRanking("game-1", user.Id, episodeNumber: 2);

        var result = await CreateQuery().GetRecipientsAsync("https://example.com", default);

        Assert.Empty(result);
    }

    // ── GetRecipientForUserAsync ─────────────────────────────────────────────

    [Fact]
    public async Task GetRecipientForUser_WhenUserHasRanking_ReturnsRecipient()
    {
        var user = SeedUser(email: "alice@test.com", displayName: "Alice");
        SeedGame();
        SeedPlayer("game-1", user.Id);
        SeedRanking("game-1", user.Id, episodeNumber: 1);

        var result = await CreateQuery()
            .GetRecipientForUserAsync(user.Id, "https://example.com", default);

        Assert.NotNull(result);
        Assert.Equal("alice@test.com", result.Email);
        Assert.Single(result.Games);
    }

    [Fact]
    public async Task GetRecipientForUser_WhenUserNotFound_ReturnsNull()
    {
        var result = await CreateQuery()
            .GetRecipientForUserAsync("nonexistent", "https://example.com", default);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetRecipientForUser_WhenUserHasNoOpenGames_ReturnsNull()
    {
        var user = SeedUser();
        // No games seeded

        var result = await CreateQuery()
            .GetRecipientForUserAsync(user.Id, "https://example.com", default);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetRecipientForUser_WhenUserHasNoRankingForOpenEpisode_ReturnsNull()
    {
        var user = SeedUser();
        SeedGame();
        SeedPlayer("game-1", user.Id);
        // No ranking seeded

        var result = await CreateQuery()
            .GetRecipientForUserAsync(user.Id, "https://example.com", default);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetRecipientForUser_WhenNotAPlayerInAnyOpenGame_ReturnsNull()
    {
        var user = SeedUser();
        SeedGame(); // game exists but user is not a player

        var result = await CreateQuery()
            .GetRecipientForUserAsync(user.Id, "https://example.com", default);

        Assert.Null(result);
    }
}
