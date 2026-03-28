using Api.Models;

namespace Api.Services;

public class ScoringService
{
    public List<LeaderboardEntry> CalculateLeaderboard(Game game, List<Player> players, List<Ranking> rankings)
    {
        if (string.IsNullOrEmpty(game.MoleContestantId))
            return [];

        return CalculateLeaderboardInternal(game, players, rankings, game.MoleContestantId);
    }

    public List<LeaderboardEntry> CalculateWhatIfLeaderboard(
        Game game, List<Player> players, List<Ranking> rankings, string hypotheticalMoleId)
    {
        return CalculateLeaderboardInternal(game, players, rankings, hypotheticalMoleId);
    }

    private static List<LeaderboardEntry> CalculateLeaderboardInternal(
        Game game, List<Player> players, List<Ranking> rankings, string moleContestantId)
    {
        var episodesByNumber = game.Episodes
            .OrderBy(e => e.Number)
            .ToDictionary(e => e.Number);

        var eliminatedBefore = new Dictionary<int, HashSet<string>>();
        var eliminatedSoFar = new HashSet<string>();
        foreach (var ep in game.Episodes.OrderBy(e => e.Number))
        {
            eliminatedBefore[ep.Number] = new HashSet<string>(eliminatedSoFar);
            if (!string.IsNullOrEmpty(ep.EliminatedContestantId))
                eliminatedSoFar.Add(ep.EliminatedContestantId);
        }

        var entries = new List<LeaderboardEntry>();

        foreach (var player in players)
        {
            var playerRankings = rankings
                .Where(r => r.UserId == player.UserId)
                .ToDictionary(r => r.EpisodeNumber);

            var episodeScores = new List<EpisodeScore>();

            foreach (var episode in game.Episodes.OrderBy(e => e.Number))
            {
                if (!playerRankings.TryGetValue(episode.Number, out var ranking))
                    continue;

                var eliminated = eliminatedBefore.GetValueOrDefault(episode.Number) ?? [];
                var remainingContestants = game.Contestants
                    .Where(c => !eliminated.Contains(c.Id))
                    .ToList();

                int n = remainingContestants.Count;
                if (n <= 1) continue;

                // Find the rank given to the mole (1-based position in the contestant list)
                int moleIndex = ranking.ContestantIds.IndexOf(moleContestantId);
                if (moleIndex < 0) continue;

                int r = moleIndex + 1; // 1-based rank

                double score = Math.Round(((n - r) / (double)(n - 1)) * 100, 2);

                episodeScores.Add(new EpisodeScore
                {
                    EpisodeNumber = episode.Number,
                    Score = score,
                    RankGiven = r,
                    TotalContestants = n
                });
            }

            entries.Add(new LeaderboardEntry
            {
                UserId = player.UserId,
                DisplayName = player.DisplayName,
                TotalScore = Math.Round(episodeScores.Sum(s => s.Score), 2),
                EpisodeScores = episodeScores
            });
        }

        // Sort descending by total score, tiebreak: higher rank for mole in later episodes wins
        entries.Sort((a, b) =>
        {
            int cmp = b.TotalScore.CompareTo(a.TotalScore);
            if (cmp != 0) return cmp;

            // Tiebreaker: compare episode scores from latest to earliest
            // The player who ranked the mole higher (lower RankGiven) in later episodes wins
            var aScores = a.EpisodeScores.OrderByDescending(s => s.EpisodeNumber).ToList();
            var bScores = b.EpisodeScores.OrderByDescending(s => s.EpisodeNumber).ToList();

            int maxEpisodes = Math.Max(aScores.Count, bScores.Count);
            for (int i = 0; i < maxEpisodes; i++)
            {
                int aRank = i < aScores.Count ? aScores[i].RankGiven : int.MaxValue;
                int bRank = i < bScores.Count ? bScores[i].RankGiven : int.MaxValue;
                // Lower rank (closer to 1) is better
                cmp = aRank.CompareTo(bRank);
                if (cmp != 0) return cmp;
            }

            return 0;
        });

        return entries;
    }
}
