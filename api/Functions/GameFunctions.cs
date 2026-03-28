using System.Text.Json;
using Api.Auth;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace Api.Functions;

public class GameFunctions
{
    private readonly CosmosDbService _cosmos;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public GameFunctions(CosmosDbService cosmos)
    {
        _cosmos = cosmos;
    }

    [Function("CreateGame")]
    public async Task<IActionResult> CreateGame(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "games")] HttpRequest req
    )
    {
        var user = AuthHelper.GetUserInfo(req);
        if (user == null)
            return new UnauthorizedResult();

        var body = await JsonSerializer.DeserializeAsync<CreateGameRequest>(req.Body, JsonOptions);
        if (body == null || string.IsNullOrWhiteSpace(body.Name))
            return new BadRequestObjectResult(new { error = "Name is required." });

        var game = new Game
        {
            Name = body.Name,
            AdminUserId = user.UserId,
            Contestants = body.Contestants ?? new(),
        };

        await _cosmos.UpsertAsync(game, game.PartitionKey, "games");

        // Auto-add admin as player
        var player = new Player
        {
            GameId = game.Id,
            UserId = user.UserId,
            DisplayName = user.DisplayName,
        };
        await _cosmos.UpsertAsync(player, player.PartitionKey, "players");

        return new OkObjectResult(game);
    }

    [Function("GetGame")]
    public async Task<IActionResult> GetGame(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "games/{gameId}")]
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

        // Verify user is admin or player
        if (game.AdminUserId != user.UserId)
        {
            var players = await _cosmos.GetAllAsync<Player>(gameId, "players");
            if (!players.Any(p => p.UserId == user.UserId))
                return new UnauthorizedResult();
        }

        return new OkObjectResult(game);
    }

    [Function("JoinGame")]
    public async Task<IActionResult> JoinGame(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "games/{gameId}/join")]
            HttpRequest req,
        string gameId
    )
    {
        var user = AuthHelper.GetUserInfo(req);
        if (user == null)
            return new UnauthorizedResult();

        var body = await JsonSerializer.DeserializeAsync<JoinGameRequest>(req.Body, JsonOptions);
        if (body == null || string.IsNullOrWhiteSpace(body.InviteCode))
            return new BadRequestObjectResult(new { error = "Invite code is required." });

        var game = await _cosmos.GetAsync<Game>(gameId, gameId, "games");
        if (game == null)
            return new NotFoundResult();

        if (!string.Equals(game.InviteCode, body.InviteCode, StringComparison.OrdinalIgnoreCase))
            return new BadRequestObjectResult(new { error = "Invalid invite code." });

        // Check if already joined
        var existingPlayers = await _cosmos.GetAllAsync<Player>(gameId, "players");
        if (existingPlayers.Any(p => p.UserId == user.UserId))
            return new OkObjectResult(new { message = "Already joined." });

        var player = new Player
        {
            GameId = gameId,
            UserId = user.UserId,
            DisplayName = user.DisplayName,
        };
        await _cosmos.UpsertAsync(player, player.PartitionKey, "players");

        return new OkObjectResult(new { message = "Joined successfully." });
    }

    [Function("GetGameByInviteCode")]
    public async Task<IActionResult> GetGameByInviteCode(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "games/by-invite/{inviteCode}")]
            HttpRequest req,
        string inviteCode
    )
    {
        var games = await _cosmos.QueryAsync<Game>(
            "SELECT * FROM c WHERE c.inviteCode = @code",
            "games",
            new Dictionary<string, object> { ["@code"] = inviteCode }
        );

        var game = games.FirstOrDefault();
        if (game == null)
            return new NotFoundResult();

        // Return limited info (don't expose admin details to unauthenticated users)
        return new OkObjectResult(
            new
            {
                game.Id,
                game.Name,
                ContestantCount = game.Contestants.Count,
                EpisodeCount = game.Episodes.Count,
            }
        );
    }

    [Function("GetMyGames")]
    public async Task<IActionResult> GetMyGames(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "my-games")] HttpRequest req
    )
    {
        var user = AuthHelper.GetUserInfo(req);
        if (user == null)
            return new UnauthorizedResult();

        // Find games where user is a player
        var allPlayers = await _cosmos.QueryAsync<Player>(
            "SELECT * FROM c WHERE c.userId = @userId",
            "players",
            new Dictionary<string, object> { ["@userId"] = user.UserId }
        );

        var games = new List<Game>();
        foreach (var player in allPlayers)
        {
            var game = await _cosmos.GetAsync<Game>(player.GameId, player.GameId, "games");
            if (game != null)
                games.Add(game);
        }

        return new OkObjectResult(games);
    }

    [Function("AddContestants")]
    public async Task<IActionResult> AddContestants(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "games/{gameId}/contestants")]
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

        var body = await JsonSerializer.DeserializeAsync<AddContestantsRequest>(
            req.Body,
            JsonOptions
        );
        if (body?.Contestants == null || body.Contestants.Count == 0)
            return new BadRequestObjectResult(
                new { error = "At least one contestant is required." }
            );

        foreach (var c in body.Contestants)
        {
            if (string.IsNullOrWhiteSpace(c.Name))
                return new BadRequestObjectResult(new { error = "Contestant name is required." });

            if (string.IsNullOrWhiteSpace(c.Id))
                c.Id = Guid.NewGuid().ToString();
        }

        game.Contestants.AddRange(body.Contestants);
        await _cosmos.UpsertAsync(game, game.PartitionKey, "games");

        return new OkObjectResult(game);
    }

    private sealed class CreateGameRequest
    {
        public string? Name { get; set; }
        public List<Contestant>? Contestants { get; set; }
    }

    private sealed class JoinGameRequest
    {
        public string? InviteCode { get; set; }
    }

    private sealed class AddContestantsRequest
    {
        public List<Contestant>? Contestants { get; set; }
    }
}
