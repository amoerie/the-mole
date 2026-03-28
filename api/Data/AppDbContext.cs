using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Game> Games => Set<Game>();
    public DbSet<Player> Players => Set<Player>();
    public DbSet<Ranking> Rankings => Set<Ranking>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
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
    }
}
