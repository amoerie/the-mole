using Api.Models;
using Api.Services;

namespace Api.Tests;

public class ScoringServiceTests
{
    /// <summary>
    /// Creates a game with N contestants (including the mole) and the specified episodes.
    /// Contestants eliminated before each episode are tracked via Episode.EliminatedContestantIds.
    /// </summary>
    private static Game CreateGame(
        string moleId,
        List<string> allContestantIds,
        List<(int number, string? eliminatedId)> episodes
    )
    {
        var game = new Game
        {
            Id = "game-1",
            MoleContestantId = moleId,
            Contestants = allContestantIds
                .Select(id => new Contestant { Id = id, Name = id })
                .ToList(),
            Episodes = episodes
                .Select(e => new Episode
                {
                    Number = e.number,
                    EliminatedContestantIds = e.eliminatedId != null ? [e.eliminatedId] : [],
                })
                .ToList(),
        };
        return game;
    }

    private static Game CreateSimpleGame(
        string moleId,
        int contestantCount,
        int episodeCount = 1
    ) =>
        CreateGame(
            moleId,
            Enumerable.Range(1, contestantCount - 1).Select(i => $"c{i}").Prepend(moleId).ToList(),
            Enumerable.Range(1, episodeCount).Select(i => (i, (string?)null)).ToList()
        );

    private static Player CreatePlayer(string userId, string displayName = "Player") =>
        new()
        {
            Id = Guid.NewGuid().ToString(),
            UserId = userId,
            DisplayName = displayName,
        };

    private static Ranking CreateRanking(
        string userId,
        int episodeNumber,
        List<string> contestantIds
    ) =>
        new()
        {
            UserId = userId,
            EpisodeNumber = episodeNumber,
            ContestantIds = contestantIds,
        };

    /// <summary>
    /// Builds a ranking list with the mole at the given 1-based rank position,
    /// filling remaining slots with filler contestant IDs.
    /// </summary>
    private static List<string> BuildRankingWithMoleAt(
        string moleId,
        int moleRank,
        int totalContestants
    )
    {
        var ranked = new List<string>();
        int filler = 1;
        for (int pos = 1; pos <= totalContestants; pos++)
        {
            if (pos == moleRank)
                ranked.Add(moleId);
            else
                ranked.Add($"c{filler++}");
        }
        return ranked;
    }

    // ────────────────────────────────────────────
    // Episode score formula: ((N - R) / (N - 1)) * 100
    // ────────────────────────────────────────────

    [Theory]
    [InlineData(10, 1, 100.0)]
    [InlineData(10, 10, 0.0)]
    public void Score_With10Contestants_ReturnsExpected(int n, int rank, double expected)
    {
        var game = CreateSimpleGame("mole", n);
        var player = CreatePlayer("user1");
        var ranking = CreateRanking("user1", 1, BuildRankingWithMoleAt("mole", rank, n));

        var leaderboard = ScoringService.CalculateLeaderboard(game, [player], [ranking]);

        Assert.Equal(expected, Assert.Single(leaderboard).TotalScore);
    }

    [Theory]
    [InlineData(5, 1, 100.0)]
    [InlineData(5, 3, 50.0)]
    [InlineData(5, 5, 0.0)]
    public void Score_With5Contestants_ReturnsExpected(int n, int rank, double expected)
    {
        var game = CreateSimpleGame("mole", n);
        var player = CreatePlayer("user1");
        var ranking = CreateRanking("user1", 1, BuildRankingWithMoleAt("mole", rank, n));

        var leaderboard = ScoringService.CalculateLeaderboard(game, [player], [ranking]);

        Assert.Equal(expected, Assert.Single(leaderboard).TotalScore);
    }

    [Theory]
    [InlineData(3, 1, 100.0)]
    [InlineData(3, 2, 50.0)]
    [InlineData(3, 3, 0.0)]
    public void Score_With3Contestants_NearFinale_ReturnsExpected(int n, int rank, double expected)
    {
        var game = CreateSimpleGame("mole", n);
        var player = CreatePlayer("user1");
        var ranking = CreateRanking("user1", 1, BuildRankingWithMoleAt("mole", rank, n));

        var leaderboard = ScoringService.CalculateLeaderboard(game, [player], [ranking]);

        Assert.Equal(expected, Assert.Single(leaderboard).TotalScore);
    }

    [Fact]
    public void Score_With2Contestants_EdgeCase_ReturnsExpected()
    {
        var game = CreateSimpleGame("mole", 2);
        var player = CreatePlayer("user1");

        // Rank mole #1 → 100
        var r1 = CreateRanking("user1", 1, BuildRankingWithMoleAt("mole", 1, 2));
        Assert.Equal(
            100.0,
            Assert.Single(ScoringService.CalculateLeaderboard(game, [player], [r1])).TotalScore
        );

        // Rank mole #2 → 0
        var r2 = CreateRanking("user1", 1, BuildRankingWithMoleAt("mole", 2, 2));
        Assert.Equal(
            0.0,
            Assert.Single(ScoringService.CalculateLeaderboard(game, [player], [r2])).TotalScore
        );
    }

    // ────────────────────────────────────────────
    // Full leaderboard with multiple players/episodes
    // ────────────────────────────────────────────

    [Fact]
    public void CalculateLeaderboard_MultiplePlayersAndEpisodes_RanksCorrectly()
    {
        // 5 contestants: mole, c1, c2, c3, c4
        // Episode 1: all 5 present, then c4 eliminated
        // Episode 2: 4 remaining (mole, c1, c2, c3)
        var game = CreateGame("mole", ["mole", "c1", "c2", "c3", "c4"], [(1, "c4"), (2, null)]);

        var alice = CreatePlayer("alice", "Alice");
        var bob = CreatePlayer("bob", "Bob");

        var rankings = new List<Ranking>
        {
            // Ep1 (N=5): Alice ranks mole #1 → 100, Bob ranks mole #3 → 50
            CreateRanking("alice", 1, BuildRankingWithMoleAt("mole", 1, 5)),
            CreateRanking("bob", 1, BuildRankingWithMoleAt("mole", 3, 5)),
            // Ep2 (N=4): Alice ranks mole #2 → 66.67, Bob ranks mole #1 → 100
            CreateRanking("alice", 2, BuildRankingWithMoleAt("mole", 2, 4)),
            CreateRanking("bob", 2, BuildRankingWithMoleAt("mole", 1, 4)),
        };

        var leaderboard = ScoringService.CalculateLeaderboard(game, [alice, bob], rankings);

        Assert.Equal(2, leaderboard.Count);

        var aliceEntry = leaderboard.First(e => e.UserId == "alice");
        var bobEntry = leaderboard.First(e => e.UserId == "bob");

        // Alice: 100 + 66.67 = 166.67
        Assert.Equal(166.67, aliceEntry.TotalScore);
        // Bob: 50 + 100 = 150
        Assert.Equal(150.0, bobEntry.TotalScore);

        // Alice should be ranked higher
        Assert.True(leaderboard.IndexOf(aliceEntry) < leaderboard.IndexOf(bobEntry));
    }

    // ────────────────────────────────────────────
    // Tiebreaker: same total, different later-episode rankings
    // ────────────────────────────────────────────

    [Fact]
    public void CalculateLeaderboard_Tiebreaker_PlayerWhoRankedMoleHigherInLaterEpisodeWins()
    {
        // 5 contestants, 2 episodes, no eliminations
        var game = CreateGame("mole", ["mole", "c1", "c2", "c3", "c4"], [(1, null), (2, null)]);

        var alice = CreatePlayer("alice", "Alice");
        var bob = CreatePlayer("bob", "Bob");

        var rankings = new List<Ranking>
        {
            // Ep1 (N=5): Alice mole #1 → 100, Bob mole #5 → 0
            CreateRanking("alice", 1, BuildRankingWithMoleAt("mole", 1, 5)),
            CreateRanking("bob", 1, BuildRankingWithMoleAt("mole", 5, 5)),
            // Ep2 (N=5): Alice mole #5 → 0, Bob mole #1 → 100
            CreateRanking("alice", 2, BuildRankingWithMoleAt("mole", 5, 5)),
            CreateRanking("bob", 2, BuildRankingWithMoleAt("mole", 1, 5)),
        };

        var leaderboard = ScoringService.CalculateLeaderboard(game, [alice, bob], rankings);

        Assert.Equal(2, leaderboard.Count);
        Assert.Equal(leaderboard[0].TotalScore, leaderboard[1].TotalScore); // tied
        Assert.Equal("bob", leaderboard[0].UserId); // Bob wins: ranked mole #1 in ep2
    }

    // ────────────────────────────────────────────
    // What-if leaderboard
    // ────────────────────────────────────────────

    [Fact]
    public void CalculateWhatIfLeaderboard_DifferentHypotheticalMoles_ProduceDifferentScores()
    {
        var game = CreateSimpleGame("mole", 5);
        var alice = CreatePlayer("alice", "Alice");

        // Alice's ranking order: mole, c1, c2, c3, c4
        var ranking = CreateRanking("alice", 1, ["mole", "c1", "c2", "c3", "c4"]);

        // What-if mole is "mole" (rank 1) → 100
        var lb1 = ScoringService.CalculateWhatIfLeaderboard(game, [alice], [ranking], "mole");
        Assert.Equal(100.0, Assert.Single(lb1).TotalScore);

        // What-if mole is "c4" (rank 5) → 0
        var lb2 = ScoringService.CalculateWhatIfLeaderboard(game, [alice], [ranking], "c4");
        Assert.Equal(0.0, Assert.Single(lb2).TotalScore);

        // What-if mole is "c2" (rank 3) → 50
        var lb3 = ScoringService.CalculateWhatIfLeaderboard(game, [alice], [ranking], "c2");
        Assert.Equal(50.0, Assert.Single(lb3).TotalScore);
    }

    // ────────────────────────────────────────────
    // Missing ranking → 0 points for that episode
    // ────────────────────────────────────────────

    [Fact]
    public void CalculateLeaderboard_MissingRankingForEpisode_GetsZeroForThatEpisode()
    {
        var game = CreateGame("mole", ["mole", "c1", "c2", "c3", "c4"], [(1, "c4"), (2, null)]);

        var player = CreatePlayer("user1", "Alice");

        // Only submit ranking for episode 1
        var rankings = new List<Ranking>
        {
            CreateRanking("user1", 1, BuildRankingWithMoleAt("mole", 1, 5)), // 100 points
            // No ranking for episode 2 → 0 points
        };

        var leaderboard = ScoringService.CalculateLeaderboard(game, [player], rankings);

        var entry = Assert.Single(leaderboard);
        Assert.Equal(100.0, entry.TotalScore); // 100 + 0
        Assert.Single(entry.EpisodeScores); // only 1 episode score recorded
    }

    // ────────────────────────────────────────────
    // Null mole → empty leaderboard
    // ────────────────────────────────────────────

    [Fact]
    public void CalculateLeaderboard_NoMoleSet_ReturnsEmptyList()
    {
        var game = CreateSimpleGame("mole", 5);
        game.MoleContestantId = null;

        var player = CreatePlayer("user1");
        var ranking = CreateRanking("user1", 1, BuildRankingWithMoleAt("mole", 1, 5));

        var leaderboard = ScoringService.CalculateLeaderboard(game, [player], [ranking]);

        Assert.Empty(leaderboard);
    }
}
