using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNotebook : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NotebookColor",
                table: "Players",
                type: "TEXT",
                nullable: true
            );

            migrationBuilder.CreateTable(
                name: "NotebookNotes",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    GameId = table.Column<string>(type: "TEXT", nullable: false),
                    EpisodeNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    Content = table.Column<string>(type: "TEXT", nullable: false),
                    SuspicionLevels = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotebookNotes", x => x.Id);
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_NotebookNotes_GameId_UserId",
                table: "NotebookNotes",
                columns: new[] { "GameId", "UserId" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_NotebookNotes_UserId_GameId_EpisodeNumber",
                table: "NotebookNotes",
                columns: new[] { "UserId", "GameId", "EpisodeNumber" },
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "NotebookNotes");

            migrationBuilder.DropColumn(name: "NotebookColor", table: "Players");
        }
    }
}
