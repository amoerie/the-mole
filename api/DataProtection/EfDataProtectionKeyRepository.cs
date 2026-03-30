using System.Xml.Linq;
using Api.Data;
using Api.Models;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Api.DataProtection;

public class EfDataProtectionKeyRepository(IServiceScopeFactory scopeFactory) : IXmlRepository
{
    public IReadOnlyCollection<XElement> GetAllElements()
    {
        // IXmlRepository only exposes sync methods — called very rarely on startup
        // See https://github.com/dotnet/aspnetcore/issues/3548
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return db
            .DataProtectionKeys.AsNoTracking()
            .Select(k => k.XmlData)
            .AsEnumerable()
            .Select(XElement.Parse)
            .ToList();
    }

    public void StoreElement(XElement element, string friendlyName)
    {
        // IXmlRepository only exposes sync methods — called very rarely on key rotation
        // See https://github.com/dotnet/aspnetcore/issues/3548
        ArgumentNullException.ThrowIfNull(friendlyName);

        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var existing = db.DataProtectionKeys.FirstOrDefault(k => k.FriendlyName == friendlyName);
        if (existing != null)
        {
            existing.XmlData = element.ToString();
        }
        else
        {
            db.DataProtectionKeys.Add(
                new DataProtectionKey { FriendlyName = friendlyName, XmlData = element.ToString() }
            );
        }

        db.SaveChanges();
    }
}
