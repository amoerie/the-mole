using System.Text.Json;
using Api.Auth;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace Api.Functions;

public class RankingFunctions
{
    private readonly CosmosDbService _cosmos;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public RankingFunctions(CosmosDbService cosmos)
    {
        _cosmos = cosmos;
    }

    [Function("SubmitRanking")]
    public async Task<IActionResult> SubmitRanking(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "games/{gameId}/episodes/{episodeNumber:int}/rankings")] HttpRequest req,
        string gameId,
        int episodeNumber)
    {
        var user = AuthHelper.GetUserInfo(req);
        if (user == null)
            return new UnauthorizedResult();

        var game = await _cosmos.GetAsync<Game>(gameId, gameId, "games");
        if (game == null)
            return new NotFoundResult();

        // Verify user is a player
        var players = await _cosmos.GetAllAsync<Player>(gameId, "players");
        if (!players.Any(p => p.UserId == user.UserId))
            return new UnauthorizedResult();

        var episode = game.Episodes.FirstOrDefault(e => e.Number == episodeNumber);
        if (episode == null)
            return new NotFoundObjectResult(new { error = "Episode not found." });

        // Deadline enforcement
        if (DateTimeOffset.UtcNow > episode.Deadline)
            return new BadRequestObjectResult(new { error = "Deadline has passed for this episode." });

        var body = await JsonSerializer.DeserializeAsync<SubmitRankingRequest>(req.Body, JsonOptions);
        if (body == null || body.ContestantIds == null || body.ContestantIds.Count == 0)
            return new BadRequestObjectResult(new { error = "ContestantIds are required." });

        // Check for existing ranking and update it (upsert behavior)
        var existingRankings = await _cosmos.QueryAsync<Ranking>(
            "SELECT * FROM c WHERE c.gameId = @gameId AND c.episodeNumber = @ep AND c.userId = @userId",
            "rankings",
            new Dictionary<string, object>
            {
                ["@gameId"] = gameId,
                ["@ep"] = episodeNumber,
                ["@userId"] = user.UserId
            });

        var ranking = existingRankings.FirstOrDefault() ?? new Ranking();
        ranking.GameId = gameId;
        ranking.EpisodeNumber = episodeNumber;
        ranking.UserId = user.UserId;
        ranking.ContestantIds = body.ContestantIds;
        ranking.SubmittedAt = DateTimeOffset.UtcNow;

        await _cosmos.UpsertAsync(ranking, ranking.PartitionKey, "rankings");

        return new OkObjectResult(ranking);
    }

    [Function("GetMyRanking")]
    public async Task<IActionResult> GetMyRanking(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "games/{gameId}/episodes/{episodeNumber:int}/rankings/mine")] HttpRequest req,
        string gameId,
        int episodeNumber)
    {
        var user = AuthHelper.GetUserInfo(req);
        if (user == null)
            return new UnauthorizedResult();

        var rankings = await _cosmos.QueryAsync<Ranking>(
            "SELECT * FROM c WHERE c.gameId = @gameId AND c.episodeNumber = @ep AND c.userId = @userId",
            "rankings",
            new Dictionary<string, object>
            {
                ["@gameId"] = gameId,
                ["@ep"] = episodeNumber,
                ["@userId"] = user.UserId
            });

        var ranking = rankings.FirstOrDefault();
        if (ranking == null)
            return new NotFoundResult();

        return new OkObjectResult(ranking);
    }

    [Function("GetMyRankingsForGame")]
    public async Task<IActionResult> GetMyRankingsForGame(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "games/{gameId}/rankings")] HttpRequest req,
        string gameId)
    {
        var user = AuthHelper.GetUserInfo(req);
        if (user == null)
            return new UnauthorizedResult();

        var rankings = await _cosmos.QueryAsync<Ranking>(
            "SELECT * FROM c WHERE c.gameId = @gameId AND c.userId = @userId ORDER BY c.episodeNumber",
            "rankings",
            new Dictionary<string, object>
            {
                ["@gameId"] = gameId,
                ["@userId"] = user.UserId
            });

        return new OkObjectResult(rankings);
    }

    private class SubmitRankingRequest
    {
        public List<string>? ContestantIds { get; set; }
    }
}
