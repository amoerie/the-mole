using System.Xml.Linq;
using Api.Data;
using Api.DataProtection;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Api.Tests;

public sealed class DataProtectionKeyRepositoryTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly IServiceProvider _serviceProvider;

    public DataProtectionKeyRepositoryTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(options => options.UseSqlite(_connection));
        _serviceProvider = services.BuildServiceProvider();

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.EnsureCreated();
    }

    private EfDataProtectionKeyRepository CreateRepository() =>
        new(_serviceProvider.GetRequiredService<IServiceScopeFactory>());

    private static XElement MakeKey(string id) =>
        XElement.Parse(
            $"""
            <key id="{id}" version="1">
              <creationDate>2026-01-01T00:00:00Z</creationDate>
              <activationDate>2026-01-01T00:00:00Z</activationDate>
              <expirationDate>2027-01-01T00:00:00Z</expirationDate>
              <descriptor deserializerType="test">
                <encryption algorithm="AES_256_CBC" />
                <validation algorithm="HMACSHA256" />
              </descriptor>
            </key>
            """
        );

    [Fact]
    public void GetAllElements_WhenNoKeysStored_ReturnsEmptyCollection()
    {
        var repo = CreateRepository();

        var result = repo.GetAllElements();

        Assert.Empty(result);
    }

    [Fact]
    public void StoreElement_NewFriendlyName_PersistsKey()
    {
        var repo = CreateRepository();
        var element = MakeKey("key-1");

        repo.StoreElement(element, "key-20260101-000000");

        var result = repo.GetAllElements();
        Assert.Single(result);
        Assert.Equal("key-1", result.Single().Attribute("id")!.Value);
    }

    [Fact]
    public void StoreElement_SameFriendlyName_UpdatesExistingKey()
    {
        var repo = CreateRepository();
        repo.StoreElement(MakeKey("key-original"), "key-20260101-000000");

        repo.StoreElement(MakeKey("key-updated"), "key-20260101-000000");

        var result = repo.GetAllElements();
        Assert.Single(result);
        Assert.Equal("key-updated", result.Single().Attribute("id")!.Value);
    }

    [Fact]
    public void StoreElement_DifferentFriendlyNames_StoresMultipleKeys()
    {
        var repo = CreateRepository();

        repo.StoreElement(MakeKey("key-1"), "key-20260101-000000");
        repo.StoreElement(MakeKey("key-2"), "key-20260102-000000");

        var result = repo.GetAllElements();
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public void GetAllElements_ReturnsStructurallyIdenticalXml()
    {
        var repo = CreateRepository();
        var original = MakeKey("abc-123");
        repo.StoreElement(original, "key-20260101-000000");

        var result = repo.GetAllElements();

        var retrieved = Assert.Single(result);
        // Verify element name, all attributes, all descendant elements and their attributes
        Assert.Equal(original.Name, retrieved.Name);
        Assert.Equal(
            original.Attributes().Select(a => (a.Name, a.Value)),
            retrieved.Attributes().Select(a => (a.Name, a.Value))
        );
        Assert.Equal(
            original
                .Descendants()
                .Select(d =>
                    (d.Name, Attrs: d.Attributes().Select(a => (a.Name, a.Value)).ToList())
                ),
            retrieved
                .Descendants()
                .Select(d =>
                    (d.Name, Attrs: d.Attributes().Select(a => (a.Name, a.Value)).ToList())
                )
        );
    }

    public void Dispose()
    {
        (_serviceProvider as IDisposable)?.Dispose();
        _connection.Dispose();
    }
}
