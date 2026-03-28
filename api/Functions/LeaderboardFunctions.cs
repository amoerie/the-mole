using Api.Auth;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace Api.Functions;

public class LeaderboardFunctions(CosmosDbService cosmos)
{
    [Function("GetLeaderboard")]
    public async Task<IActionResult> GetLeaderboard(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "games/{gameId}/leaderboard")]
            HttpRequest req,
        string gameId
    )
    {
        var user = AuthHelper.GetUserInfo(req);
        if (user == null)
            return new UnauthorizedResult();

        var game = await cosmos.GetAsync<Game>(gameId, gameId, "games");
        if (game == null)
            return new NotFoundResult();

        if (string.IsNullOrEmpty(game.MoleContestantId))
            return new BadRequestObjectResult(
                new { error = "The mole has not been revealed yet." }
            );

        var players = await cosmos.GetAllAsync<Player>(gameId, "players");
        var rankings = await cosmos.GetAllAsync<Ranking>(gameId, "rankings");

        var leaderboard = ScoringService.CalculateLeaderboard(game, players, rankings);

        return new OkObjectResult(leaderboard);
    }

    [Function("GetWhatIfLeaderboard")]
    public async Task<IActionResult> GetWhatIfLeaderboard(
        [HttpTrigger(
            AuthorizationLevel.Anonymous,
            "get",
            Route = "games/{gameId}/leaderboard/what-if/{contestantId}"
        )]
            HttpRequest req,
        string gameId,
        string contestantId
    )
    {
        var user = AuthHelper.GetUserInfo(req);
        if (user == null)
            return new UnauthorizedResult();

        var game = await cosmos.GetAsync<Game>(gameId, gameId, "games");
        if (game == null)
            return new NotFoundResult();

        var contestant = game.Contestants.FirstOrDefault(c => c.Id == contestantId);
        if (contestant == null)
            return new BadRequestObjectResult(new { error = "Contestant not found." });

        var players = await cosmos.GetAllAsync<Player>(gameId, "players");
        var rankings = await cosmos.GetAllAsync<Ranking>(gameId, "rankings");

        var leaderboard = ScoringService.CalculateWhatIfLeaderboard(
            game,
            players,
            rankings,
            contestantId
        );

        return new OkObjectResult(leaderboard);
    }
}
