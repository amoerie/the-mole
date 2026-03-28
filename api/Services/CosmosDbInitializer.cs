using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Api.Services;

public partial class CosmosDbInitializer(
    CosmosDbService cosmosDbService,
    ILogger<CosmosDbInitializer> logger
) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await cosmosDbService.EnsureDatabaseAndContainersAsync();
        }
        catch (Exception ex)
        {
            // Log but do not throw — a startup failure here would crash the function host
            // and cause Azure SWA's deployment health check to fail.
            // Cosmos DB containers will be created on first actual use if missing.
            LogStartupWarning(logger, ex);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    [LoggerMessage(Level = LogLevel.Warning, Message = "Could not ensure Cosmos DB containers on startup. Will retry on first use.")]
    private static partial void LogStartupWarning(ILogger logger, Exception ex);
}
