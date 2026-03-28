using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Games",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    AdminUserId = table.Column<string>(type: "TEXT", nullable: false),
                    MoleContestantId = table.Column<string>(type: "TEXT", nullable: true),
                    InviteCode = table.Column<string>(type: "TEXT", nullable: false),
                    Contestants = table.Column<string>(type: "TEXT", nullable: true),
                    Episodes = table.Column<string>(type: "TEXT", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Games", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "Players",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    GameId = table.Column<string>(type: "TEXT", nullable: false),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    DisplayName = table.Column<string>(type: "TEXT", nullable: false),
                    JoinedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Players", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "Rankings",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    GameId = table.Column<string>(type: "TEXT", nullable: false),
                    EpisodeNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    ContestantIds = table.Column<string>(type: "TEXT", nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rankings", x => x.Id);
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_Games_InviteCode",
                table: "Games",
                column: "InviteCode",
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_Players_GameId_UserId",
                table: "Players",
                columns: new[] { "GameId", "UserId" },
                unique: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_Rankings_GameId_EpisodeNumber_UserId",
                table: "Rankings",
                columns: new[] { "GameId", "EpisodeNumber", "UserId" },
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "Games");

            migrationBuilder.DropTable(name: "Players");

            migrationBuilder.DropTable(name: "Rankings");
        }
    }
}
