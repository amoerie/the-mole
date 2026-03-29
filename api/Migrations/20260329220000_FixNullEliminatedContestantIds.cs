using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class FixNullEliminatedContestantIds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Fix any episodes where EliminatedContestantIds is JSON null — replace with empty array.
            migrationBuilder.Sql(
                """
                UPDATE "Games"
                SET "Episodes" = (
                    SELECT json_group_array(
                        CASE
                            WHEN json_extract(ep.value, '$.EliminatedContestantIds') IS NULL
                                THEN json_set(ep.value, '$.EliminatedContestantIds', json_array())
                            ELSE ep.value
                        END
                    )
                    FROM json_each("Games"."Episodes") ep
                )
                WHERE json_array_length("Episodes") > 0
                """
            );

            // Also make the column nullable in the model snapshot (no SQL needed for SQLite JSON columns).
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) { }
    }
}
