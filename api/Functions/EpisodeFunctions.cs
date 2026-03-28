using System.Text.Json;
using Api.Auth;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace Api.Functions;

public class EpisodeFunctions
{
    private readonly CosmosDbService _cosmos;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public EpisodeFunctions(CosmosDbService cosmos)
    {
        _cosmos = cosmos;
    }

    [Function("CreateEpisode")]
    public async Task<IActionResult> CreateEpisode(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "games/{gameId}/episodes")]
            HttpRequest req,
        string gameId
    )
    {
        var user = AuthHelper.GetUserInfo(req);
        if (user == null)
            return new UnauthorizedResult();

        var game = await _cosmos.GetAsync<Game>(gameId, gameId, "games");
        if (game == null)
            return new NotFoundResult();

        if (game.AdminUserId != user.UserId)
            return new UnauthorizedResult();

        var body = await JsonSerializer.DeserializeAsync<CreateEpisodeRequest>(
            req.Body,
            JsonOptions
        );
        if (body == null)
            return new BadRequestObjectResult(new { error = "Request body is required." });

        int nextNumber = game.Episodes.Count > 0 ? game.Episodes.Max(e => e.Number) + 1 : 1;

        var episode = new Episode
        {
            Number = nextNumber,
            Deadline = body.Deadline,
            EliminatedContestantId = body.EliminatedContestantId,
        };

        // Mark contestant as eliminated if provided
        if (!string.IsNullOrEmpty(body.EliminatedContestantId))
        {
            var contestant = game.Contestants.FirstOrDefault(c =>
                c.Id == body.EliminatedContestantId
            );
            if (contestant != null)
                contestant.EliminatedInEpisode = nextNumber;
        }

        game.Episodes.Add(episode);
        await _cosmos.UpsertAsync(game, game.PartitionKey, "games");

        return new OkObjectResult(episode);
    }

    [Function("UpdateEpisode")]
    public async Task<IActionResult> UpdateEpisode(
        [HttpTrigger(
            AuthorizationLevel.Anonymous,
            "put",
            Route = "games/{gameId}/episodes/{episodeNumber:int}"
        )]
            HttpRequest req,
        string gameId,
        int episodeNumber
    )
    {
        var user = AuthHelper.GetUserInfo(req);
        if (user == null)
            return new UnauthorizedResult();

        var game = await _cosmos.GetAsync<Game>(gameId, gameId, "games");
        if (game == null)
            return new NotFoundResult();

        if (game.AdminUserId != user.UserId)
            return new UnauthorizedResult();

        var episode = game.Episodes.FirstOrDefault(e => e.Number == episodeNumber);
        if (episode == null)
            return new NotFoundObjectResult(new { error = "Episode not found." });

        var body = await JsonSerializer.DeserializeAsync<UpdateEpisodeRequest>(
            req.Body,
            JsonOptions
        );
        if (body == null)
            return new BadRequestObjectResult(new { error = "Request body is required." });

        if (body.Deadline.HasValue)
            episode.Deadline = body.Deadline.Value;

        if (body.EliminatedContestantId != null)
        {
            // Clear previous elimination for this episode
            var prevEliminated = game.Contestants.FirstOrDefault(c =>
                c.EliminatedInEpisode == episodeNumber
            );
            if (prevEliminated != null)
                prevEliminated.EliminatedInEpisode = null;

            episode.EliminatedContestantId = body.EliminatedContestantId;

            if (!string.IsNullOrEmpty(body.EliminatedContestantId))
            {
                var contestant = game.Contestants.FirstOrDefault(c =>
                    c.Id == body.EliminatedContestantId
                );
                if (contestant != null)
                    contestant.EliminatedInEpisode = episodeNumber;
            }
        }

        await _cosmos.UpsertAsync(game, game.PartitionKey, "games");

        return new OkObjectResult(episode);
    }

    [Function("RevealMole")]
    public async Task<IActionResult> RevealMole(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "games/{gameId}/reveal-mole")]
            HttpRequest req,
        string gameId
    )
    {
        var user = AuthHelper.GetUserInfo(req);
        if (user == null)
            return new UnauthorizedResult();

        var game = await _cosmos.GetAsync<Game>(gameId, gameId, "games");
        if (game == null)
            return new NotFoundResult();

        if (game.AdminUserId != user.UserId)
            return new UnauthorizedResult();

        var body = await JsonSerializer.DeserializeAsync<RevealMoleRequest>(req.Body, JsonOptions);
        if (body == null || string.IsNullOrWhiteSpace(body.MoleContestantId))
            return new BadRequestObjectResult(new { error = "MoleContestantId is required." });

        var contestant = game.Contestants.FirstOrDefault(c => c.Id == body.MoleContestantId);
        if (contestant == null)
            return new BadRequestObjectResult(new { error = "Contestant not found." });

        game.MoleContestantId = body.MoleContestantId;
        await _cosmos.UpsertAsync(game, game.PartitionKey, "games");

        return new OkObjectResult(new { message = "Mole revealed.", game.MoleContestantId });
    }

    private sealed class CreateEpisodeRequest
    {
        public DateTimeOffset Deadline { get; set; }
        public string? EliminatedContestantId { get; set; }
    }

    private sealed class UpdateEpisodeRequest
    {
        public DateTimeOffset? Deadline { get; set; }
        public string? EliminatedContestantId { get; set; }
    }

    private sealed class RevealMoleRequest
    {
        public string? MoleContestantId { get; set; }
    }
}
