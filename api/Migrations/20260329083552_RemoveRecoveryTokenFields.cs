using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveRecoveryTokenFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "RecoveryToken", table: "AppUsers");

            migrationBuilder.DropColumn(name: "RecoveryTokenExpiry", table: "AppUsers");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RecoveryToken",
                table: "AppUsers",
                type: "TEXT",
                nullable: true
            );

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "RecoveryTokenExpiry",
                table: "AppUsers",
                type: "TEXT",
                nullable: true
            );
        }
    }
}
