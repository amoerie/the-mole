using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class MultipleEliminationsPerEpisode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Migrate JSON: EliminatedContestantId (string?) → EliminatedContestantIds (string[])
            migrationBuilder.Sql(
                """
                UPDATE "Games"
                SET "Episodes" = (
                    SELECT json_group_array(
                        CASE
                            WHEN json_extract(ep.value, '$.EliminatedContestantId') IS NOT NULL
                                THEN json_set(
                                    json_remove(ep.value, '$.EliminatedContestantId'),
                                    '$.EliminatedContestantIds',
                                    json_array(json_extract(ep.value, '$.EliminatedContestantId'))
                                )
                            ELSE json_set(ep.value, '$.EliminatedContestantIds', json_array())
                        END
                    )
                    FROM json_each("Games"."Episodes") ep
                )
                WHERE json_array_length("Episodes") > 0
                """
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert JSON: EliminatedContestantIds (string[]) → EliminatedContestantId (string?)
            migrationBuilder.Sql(
                """
                UPDATE "Games"
                SET "Episodes" = (
                    SELECT json_group_array(
                        json_set(
                            json_remove(ep.value, '$.EliminatedContestantIds'),
                            '$.EliminatedContestantId',
                            CASE
                                WHEN json_array_length(json_extract(ep.value, '$.EliminatedContestantIds')) > 0
                                    THEN json_extract(ep.value, '$.EliminatedContestantIds[0]')
                                ELSE NULL
                            END
                        )
                    )
                    FROM json_each("Games"."Episodes") ep
                )
                WHERE json_array_length("Episodes") > 0
                """
            );
        }
    }
}
