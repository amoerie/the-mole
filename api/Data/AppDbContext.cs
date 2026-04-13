using System.Text.Json;
using Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    public DbSet<EmailLog> EmailLogs => Set<EmailLog>();
    public DbSet<Game> Games => Set<Game>();
    public DbSet<Player> Players => Set<Player>();
    public DbSet<Ranking> Rankings => Set<Ranking>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<MessageRead> MessageReads => Set<MessageRead>();
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();
    public DbSet<NotebookNote> NotebookNotes => Set<NotebookNote>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppSetting>(entity =>
        {
            entity.HasKey(s => s.Key);
        });

        modelBuilder.Entity<EmailLog>(entity =>
        {
            entity.Property(e => e.Type).HasConversion<string>();
        });

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasIndex(u => u.Email).IsUnique();
        });
        modelBuilder.Entity<Game>(entity =>
        {
            entity.OwnsMany(g => g.Contestants, b => b.ToJson());
            entity.OwnsMany(g => g.Episodes, b => b.ToJson());
            entity.HasIndex(g => g.InviteCode).IsUnique();
        });

        modelBuilder.Entity<Player>(entity =>
        {
            entity.HasIndex(p => new { p.GameId, p.UserId }).IsUnique();
        });

        modelBuilder.Entity<Message>(entity =>
        {
            entity.HasIndex(m => m.GameId);
        });

        modelBuilder.Entity<MessageRead>(entity =>
        {
            entity.HasKey(mr => new { mr.UserId, mr.GameId });
        });

        modelBuilder.Entity<Ranking>(entity =>
        {
            entity
                .HasIndex(r => new
                {
                    r.GameId,
                    r.EpisodeNumber,
                    r.UserId,
                })
                .IsUnique();
            entity.PrimitiveCollection(r => r.ContestantIds);
        });

        modelBuilder.Entity<DataProtectionKey>(entity =>
        {
            entity.HasIndex(k => k.FriendlyName).IsUnique();
        });

        modelBuilder.Entity<NotebookNote>(entity =>
        {
            entity
                .HasIndex(n => new
                {
                    n.UserId,
                    n.GameId,
                    n.EpisodeNumber,
                })
                .IsUnique();
            entity.HasIndex(n => new { n.GameId, n.UserId });
            entity
                .Property((NotebookNote n) => n.SuspicionLevels)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v =>
                        JsonSerializer.Deserialize<Dictionary<string, int>>(
                            v,
                            (JsonSerializerOptions?)null
                        ) ?? new Dictionary<string, int>(),
                    new ValueComparer<Dictionary<string, int>>(
                        (a, b) =>
                            a != null
                            && b != null
                            && a.Count == b.Count
                            && a.All(kv => b.ContainsKey(kv.Key) && b[kv.Key] == kv.Value),
                        c =>
                            c.Aggregate(
                                0,
                                (acc, kv) =>
                                    HashCode.Combine(
                                        acc,
                                        kv.Key.GetHashCode(),
                                        kv.Value.GetHashCode()
                                    )
                            ),
                        c => new Dictionary<string, int>(c)
                    )
                );
        });
    }
}
