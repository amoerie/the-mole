using Microsoft.Extensions.Hosting;

namespace Api.Services;

public class CosmosDbInitializer : IHostedService
{
    private readonly CosmosDbService _cosmosDbService;

    public CosmosDbInitializer(CosmosDbService cosmosDbService)
    {
        _cosmosDbService = cosmosDbService;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await _cosmosDbService.EnsureDatabaseAndContainersAsync();
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
