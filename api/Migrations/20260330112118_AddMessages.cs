using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMessages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Messages",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    GameId = table.Column<string>(type: "TEXT", nullable: false),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    DisplayName = table.Column<string>(type: "TEXT", nullable: false),
                    Content = table.Column<string>(type: "TEXT", nullable: false),
                    PostedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Messages", x => x.Id);
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_Messages_GameId",
                table: "Messages",
                column: "GameId"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "Messages");
        }
    }
}
