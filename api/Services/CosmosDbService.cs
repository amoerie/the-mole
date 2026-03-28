using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Cosmos.Linq;

namespace Api.Services;

public class CosmosDbService
{
    private readonly CosmosClient _client;
    private readonly string _databaseName;

    private static readonly string[] ContainerNames = ["games", "players", "rankings"];

    public CosmosDbService(CosmosClient client)
    {
        _client = client;
        _databaseName = Environment.GetEnvironmentVariable("DatabaseName") ?? "TheMole";
    }

    public async Task EnsureDatabaseAndContainersAsync()
    {
        var dbResponse = await _client.CreateDatabaseIfNotExistsAsync(_databaseName);
        var database = dbResponse.Database;

        foreach (var containerName in ContainerNames)
        {
            await database.CreateContainerIfNotExistsAsync(
                new ContainerProperties(containerName, "/partitionKey")
            );
        }
    }

    public async Task<T?> GetAsync<T>(string id, string partitionKey, string containerName)
    {
        var container = GetContainer(containerName);
        try
        {
            var response = await container.ReadItemAsync<T>(id, new PartitionKey(partitionKey));
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return default;
        }
    }

    public async Task<List<T>> GetAllAsync<T>(string partitionKey, string containerName)
    {
        var container = GetContainer(containerName);
        var query = container.GetItemQueryIterator<T>(
            new QueryDefinition("SELECT * FROM c"),
            requestOptions: new QueryRequestOptions
            {
                PartitionKey = new PartitionKey(partitionKey),
            }
        );

        var results = new List<T>();
        while (query.HasMoreResults)
        {
            var response = await query.ReadNextAsync();
            results.AddRange(response);
        }
        return results;
    }

    public async Task<List<T>> QueryAsync<T>(
        string sql,
        string containerName,
        Dictionary<string, object>? parameters = null
    )
    {
        var queryDefinition = new QueryDefinition(sql);
        if (parameters != null)
        {
            foreach (var (key, value) in parameters)
            {
                queryDefinition = queryDefinition.WithParameter(key, value);
            }
        }

        var container = GetContainer(containerName);
        var query = container.GetItemQueryIterator<T>(queryDefinition);

        var results = new List<T>();
        while (query.HasMoreResults)
        {
            var response = await query.ReadNextAsync();
            results.AddRange(response);
        }
        return results;
    }

    public async Task<T> UpsertAsync<T>(T item, string partitionKey, string containerName)
    {
        var container = GetContainer(containerName);
        var response = await container.UpsertItemAsync(item, new PartitionKey(partitionKey));
        return response.Resource;
    }

    public async Task DeleteAsync(string id, string partitionKey, string containerName)
    {
        var container = GetContainer(containerName);
        await container.DeleteItemAsync<object>(id, new PartitionKey(partitionKey));
    }

    private Container GetContainer(string containerName) =>
        _client.GetContainer(_databaseName, containerName);
}
