using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class FixContestantHighResPhotoUrls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Replace any remaining play.tv highResPhotoUrl values with local paths for Season 14 contestants.
            // This covers games created before the local images were available.
            var contestants = new[]
            {
                ("Abigail", "/contestants/abigail-hires.webp"),
                ("Dries", "/contestants/dries-hires.webp"),
                ("Isabel", "/contestants/isabel-hires.webp"),
                ("Julie", "/contestants/julie-hires.webp"),
                ("Karla", "/contestants/karla-hires.webp"),
                ("Kristof", "/contestants/kristof-hires.webp"),
                ("Maïté", "/contestants/maite-hires.webp"),
                ("Maxim", "/contestants/maxim-hires.webp"),
                ("Vincent", "/contestants/vincent-hires.webp"),
                ("Wout", "/contestants/wout-hires.webp"),
                ("Yana", "/contestants/yana-hires.webp"),
                ("Yannis", "/contestants/yannis-hires.webp"),
            };

            foreach (var (name, localUrl) in contestants)
            {
                migrationBuilder.Sql(
                    $"""
                    UPDATE "Games"
                    SET "Contestants" = (
                        SELECT json_group_array(
                            CASE
                                WHEN json_extract(c.value, '$.Name') = '{name}'
                                    AND json_extract(c.value, '$.HighResPhotoUrl') NOT LIKE '/contestants/%'
                                    THEN json_set(c.value, '$.HighResPhotoUrl', '{localUrl}')
                                ELSE c.value
                            END
                        )
                        FROM json_each("Games"."Contestants") c
                    )
                    WHERE json_array_length("Contestants") > 0
                    """
                );
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No rollback — we don't store the old play.tv URLs anywhere.
        }
    }
}
