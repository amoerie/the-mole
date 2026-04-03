using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Api.Migrations
{
    /// <inheritdoc />
    public partial class AddContestantDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Backfill Bio and HighResPhotoUrl for Season 14 contestants in existing games.
            // Contestants are stored as a JSON array in the Contestants column.
            // New games created after this migration get the data via SEASON_14_CONTESTANTS.
            // Only fields that are currently NULL are filled; existing values are preserved via COALESCE.
            migrationBuilder.Sql(
                """
                UPDATE "Games"
                SET "Contestants" = (
                    SELECT json_group_array(
                        CASE
                            WHEN json_extract(c.value, '$.Name') = 'Abigail'
                                 AND (json_extract(c.value, '$.Bio') IS NULL OR json_extract(c.value, '$.HighResPhotoUrl') IS NULL) THEN json_set(c.value,
                                '$.HighResPhotoUrl', COALESCE(json_extract(c.value, '$.HighResPhotoUrl'), '/contestants/abigail-hires.webp'),
                                '$.Bio', COALESCE(json_extract(c.value, '$.Bio'), 'Abigail heeft wortels in Ghana en woonde een jaar in Shanghai. Nu leeft ze in Limburg met haar man en twee kinderen. Als teamleider in een kinderopvang houdt ze van chaos én van orde.'))
                            WHEN json_extract(c.value, '$.Name') = 'Dries'
                                 AND (json_extract(c.value, '$.Bio') IS NULL OR json_extract(c.value, '$.HighResPhotoUrl') IS NULL) THEN json_set(c.value,
                                '$.HighResPhotoUrl', COALESCE(json_extract(c.value, '$.HighResPhotoUrl'), '/contestants/dries-hires.webp'),
                                '$.Bio', COALESCE(json_extract(c.value, '$.Bio'), 'Dries werkt als IT-manager en staat bekend als een legendarische snurker — hij nam zelfs oordopjes mee voor zijn medekandidaten. Woont samen met zijn vriendin ten zuiden van zijn geboortedorp.'))
                            WHEN json_extract(c.value, '$.Name') = 'Isabel'
                                 AND (json_extract(c.value, '$.Bio') IS NULL OR json_extract(c.value, '$.HighResPhotoUrl') IS NULL) THEN json_set(c.value,
                                '$.HighResPhotoUrl', COALESCE(json_extract(c.value, '$.HighResPhotoUrl'), '/contestants/isabel-hires.webp'),
                                '$.Bio', COALESCE(json_extract(c.value, '$.Bio'), 'Isabel beheert twee bankkantoren in de Antwerpse regio en deelt haar thuis met 3 kinderen en 5 katten. Ze bestelt liever sushi dan dat ze zelf kookt.'))
                            WHEN json_extract(c.value, '$.Name') = 'Julie'
                                 AND (json_extract(c.value, '$.Bio') IS NULL OR json_extract(c.value, '$.HighResPhotoUrl') IS NULL) THEN json_set(c.value,
                                '$.HighResPhotoUrl', COALESCE(json_extract(c.value, '$.HighResPhotoUrl'), '/contestants/julie-hires.webp'),
                                '$.Bio', COALESCE(json_extract(c.value, '$.Bio'), 'Julie is een luidruchtige Antwerpse met een uitgesproken accent. Ze steunt zowel Beerschot als Antwerp en staat in haar familie bekend als ''Boulette''.'))
                            WHEN json_extract(c.value, '$.Name') = 'Karla'
                                 AND (json_extract(c.value, '$.Bio') IS NULL OR json_extract(c.value, '$.HighResPhotoUrl') IS NULL) THEN json_set(c.value,
                                '$.HighResPhotoUrl', COALESCE(json_extract(c.value, '$.HighResPhotoUrl'), '/contestants/karla-hires.webp'),
                                '$.Bio', COALESCE(json_extract(c.value, '$.Bio'), 'Karla is de meest ervaren kandidaat van het seizoen. Ze woont samen met haar man, dochter, drie stiefkinderen én 17 schildpadden. Ze omschrijft zichzelf als een oude bomma — behalve als ze in de Tesla van haar man zit.'))
                            WHEN json_extract(c.value, '$.Name') = 'Kristof'
                                 AND (json_extract(c.value, '$.Bio') IS NULL OR json_extract(c.value, '$.HighResPhotoUrl') IS NULL) THEN json_set(c.value,
                                '$.HighResPhotoUrl', COALESCE(json_extract(c.value, '$.HighResPhotoUrl'), '/contestants/kristof-hires.webp'),
                                '$.Bio', COALESCE(json_extract(c.value, '$.Bio'), 'Kristof is een jonge veertigjarige die grijze haren systematisch uittrekt — al geeft hij toe dat hij ze niet meer kan bijhouden. Als cafébaas in Antwerpen kent hij het klappen van de zweep.'))
                            WHEN json_extract(c.value, '$.Name') = 'Maïté'
                                 AND (json_extract(c.value, '$.Bio') IS NULL OR json_extract(c.value, '$.HighResPhotoUrl') IS NULL) THEN json_set(c.value,
                                '$.HighResPhotoUrl', COALESCE(json_extract(c.value, '$.HighResPhotoUrl'), '/contestants/maite-hires.webp'),
                                '$.Bio', COALESCE(json_extract(c.value, '$.Bio'), 'Maïté werd geboren in Zuid-India en groeide op in een Belgisch adoptiegezin in Deinze. Ze helpt nieuwkomers integreren in de maatschappij, runt een cateringbedrijf, poseert voor kunststudenten én speelt drums.'))
                            WHEN json_extract(c.value, '$.Name') = 'Maxim'
                                 AND (json_extract(c.value, '$.Bio') IS NULL OR json_extract(c.value, '$.HighResPhotoUrl') IS NULL) THEN json_set(c.value,
                                '$.HighResPhotoUrl', COALESCE(json_extract(c.value, '$.HighResPhotoUrl'), '/contestants/maxim-hires.webp'),
                                '$.Bio', COALESCE(json_extract(c.value, '$.Bio'), 'Maxim is een bakkerszoon uit West-Vlaanderen met een ongezonde obsessie voor éclairs. Hij bekeek Game of Thrones al zes keer van begin tot einde.'))
                            WHEN json_extract(c.value, '$.Name') = 'Vincent'
                                 AND (json_extract(c.value, '$.Bio') IS NULL OR json_extract(c.value, '$.HighResPhotoUrl') IS NULL) THEN json_set(c.value,
                                '$.HighResPhotoUrl', COALESCE(json_extract(c.value, '$.HighResPhotoUrl'), '/contestants/vincent-hires.webp'),
                                '$.Bio', COALESCE(json_extract(c.value, '$.Bio'), 'Vincent werkte ooit voor een tv-productiemaatschappij en runt nu zijn eigen softwarebedrijf. Hij geniet van sauna, kaasfondue en zangles, en geeft grif toe dat hij geen enkel sport kan.'))
                            WHEN json_extract(c.value, '$.Name') = 'Wout'
                                 AND (json_extract(c.value, '$.Bio') IS NULL OR json_extract(c.value, '$.HighResPhotoUrl') IS NULL) THEN json_set(c.value,
                                '$.HighResPhotoUrl', COALESCE(json_extract(c.value, '$.HighResPhotoUrl'), '/contestants/wout-hires.webp'),
                                '$.Bio', COALESCE(json_extract(c.value, '$.Bio'), 'Wout is 197 cm groot en werkt in het Vrijbroekpark in Mechelen. Naast zijn dagtaak als tuinman en administratief medewerker is hij ook videograaf en dj onder de naam C-MAN.'))
                            WHEN json_extract(c.value, '$.Name') = 'Yana'
                                 AND (json_extract(c.value, '$.Bio') IS NULL OR json_extract(c.value, '$.HighResPhotoUrl') IS NULL) THEN json_set(c.value,
                                '$.HighResPhotoUrl', COALESCE(json_extract(c.value, '$.HighResPhotoUrl'), '/contestants/yana-hires.webp'),
                                '$.Bio', COALESCE(json_extract(c.value, '$.Bio'), 'Yana is getrouwd met Laurenz en moeder van twee dochters. Als tiener haalde ze een brevet als juniorvallschermspringer. Ze werkt in IT als digitaal adviseur.'))
                            WHEN json_extract(c.value, '$.Name') = 'Yannis'
                                 AND (json_extract(c.value, '$.Bio') IS NULL OR json_extract(c.value, '$.HighResPhotoUrl') IS NULL) THEN json_set(c.value,
                                '$.HighResPhotoUrl', COALESCE(json_extract(c.value, '$.HighResPhotoUrl'), '/contestants/yannis-hires.webp'),
                                '$.Bio', COALESCE(json_extract(c.value, '$.Bio'), 'Yannis verdeelt en installeert kunstgrasvelden voor sportvelden in heel Vlaanderen. Hij heeft een passie voor zingen en stond als jongere op de planken in het muziektheater.'))
                            ELSE c.value
                        END
                    )
                    FROM json_each("Games"."Contestants") c
                )
                WHERE json_array_length("Contestants") > 0
                """
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE "Games"
                SET "Contestants" = (
                    SELECT json_group_array(
                        json_remove(json_remove(c.value, '$.HighResPhotoUrl'), '$.Bio')
                    )
                    FROM json_each("Games"."Contestants") c
                )
                WHERE json_array_length("Contestants") > 0
                """
            );
        }
    }
}
