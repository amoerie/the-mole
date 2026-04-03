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
            migrationBuilder.Sql(
                """
                UPDATE "Games"
                SET "Contestants" = (
                    SELECT json_group_array(
                        CASE json_extract(c.value, '$.Name')
                            WHEN 'Abigail' THEN json_set(c.value,
                                '$.HighResPhotoUrl', 'https://images.play.tv/styles/e571973e3f87726813c649d14b960d4bd8fafb9e5b6fa4f53d8b064e3df4a4f1/meta/demols14500x500abigail-tcb0dt.png',
                                '$.Bio', 'Abigail heeft wortels in Ghana en woonde een jaar in Shanghai. Nu leeft ze in Limburg met haar man en twee kinderen. Als teamleider in een kinderopvang houdt ze van chaos én van orde.')
                            WHEN 'Dries' THEN json_set(c.value,
                                '$.HighResPhotoUrl', 'https://images.play.tv/styles/e571973e3f87726813c649d14b960d4bd8fafb9e5b6fa4f53d8b064e3df4a4f1/meta/demols14500x500dries-tcb0qr.png',
                                '$.Bio', 'Dries werkt als IT-manager en staat bekend als een legendarische snurker — hij nam zelfs oordopjes mee voor zijn medekandidaten. Woont samen met zijn vriendin ten zuiden van zijn geboortedorp.')
                            WHEN 'Isabel' THEN json_set(c.value,
                                '$.HighResPhotoUrl', 'https://images.play.tv/styles/e571973e3f87726813c649d14b960d4bd8fafb9e5b6fa4f53d8b064e3df4a4f1/meta/demols14500x500isabel-tcb11c.png',
                                '$.Bio', 'Isabel beheert twee bankkantoren in de Antwerpse regio en deelt haar thuis met 3 kinderen en 5 katten. Ze bestelt liever sushi dan dat ze zelf kookt.')
                            WHEN 'Julie' THEN json_set(c.value,
                                '$.HighResPhotoUrl', 'https://images.play.tv/styles/e571973e3f87726813c649d14b960d4bd8fafb9e5b6fa4f53d8b064e3df4a4f1/meta/demols14500x500julie-tcb14l.png',
                                '$.Bio', 'Julie is een luidruchtige Antwerpse met een uitgesproken accent. Ze steunt zowel Beerschot als Antwerp en staat in haar familie bekend als ''Boulette''.')
                            WHEN 'Karla' THEN json_set(c.value,
                                '$.HighResPhotoUrl', 'https://images.play.tv/styles/e571973e3f87726813c649d14b960d4bd8fafb9e5b6fa4f53d8b064e3df4a4f1/meta/demols14500x500karla-tcb19o.png',
                                '$.Bio', 'Karla is de meest ervaren kandidaat van het seizoen. Ze woont samen met haar man, dochter, drie stiefkinderen én 17 schildpadden. Ze omschrijft zichzelf als een oude bomma — behalve als ze in de Tesla van haar man zit.')
                            WHEN 'Kristof' THEN json_set(c.value,
                                '$.HighResPhotoUrl', 'https://images.play.tv/styles/e571973e3f87726813c649d14b960d4bd8fafb9e5b6fa4f53d8b064e3df4a4f1/meta/demols14500x500kristof-tcb1ct.png',
                                '$.Bio', 'Kristof is een jonge veertigjarige die grijze haren systematisch uittrekt — al geeft hij toe dat hij ze niet meer kan bijhouden. Als cafébaas in Antwerpen kent hij het klappen van de zweep.')
                            WHEN 'Maïté' THEN json_set(c.value,
                                '$.HighResPhotoUrl', '/contestants/maite.png',
                                '$.Bio', 'Maïté werd geboren in Zuid-India en groeide op in een Belgisch adoptiegezin in Deinze. Ze helpt nieuwkomers integreren in de maatschappij, runt een cateringbedrijf, poseert voor kunststudenten én speelt drums.')
                            WHEN 'Maxim' THEN json_set(c.value,
                                '$.HighResPhotoUrl', 'https://images.play.tv/styles/e571973e3f87726813c649d14b960d4bd8fafb9e5b6fa4f53d8b064e3df4a4f1/meta/demols14500x500maxim-tcb1k7.png',
                                '$.Bio', 'Maxim is een bakkerszoon uit West-Vlaanderen met een ongezonde obsessie voor éclairs. Hij bekeek Game of Thrones al zes keer van begin tot einde.')
                            WHEN 'Vincent' THEN json_set(c.value,
                                '$.HighResPhotoUrl', 'https://images.play.tv/styles/e571973e3f87726813c649d14b960d4bd8fafb9e5b6fa4f53d8b064e3df4a4f1/meta/demols14500x500vincent-tcb1mj.png',
                                '$.Bio', 'Vincent werkte ooit voor een tv-productiemaatschappij en runt nu zijn eigen softwarebedrijf. Hij geniet van sauna, kaasfondue en zangles, en geeft grif toe dat hij geen enkel sport kan.')
                            WHEN 'Wout' THEN json_set(c.value,
                                '$.HighResPhotoUrl', 'https://images.play.tv/styles/e571973e3f87726813c649d14b960d4bd8fafb9e5b6fa4f53d8b064e3df4a4f1/meta/demols14500x500wout-tcb1pm.png',
                                '$.Bio', 'Wout is 197 cm groot en werkt in het Vrijbroekpark in Mechelen. Naast zijn dagtaak als tuinman en administratief medewerker is hij ook videograaf en dj onder de naam C-MAN.')
                            WHEN 'Yana' THEN json_set(c.value,
                                '$.HighResPhotoUrl', 'https://images.play.tv/styles/e571973e3f87726813c649d14b960d4bd8fafb9e5b6fa4f53d8b064e3df4a4f1/meta/demols14500x500yana-tco1fq.png',
                                '$.Bio', 'Yana is getrouwd met Laurenz en moeder van twee dochters. Als tiener haalde ze een brevet als juniorvallschermspringer. Ze werkt in IT als digitaal adviseur.')
                            WHEN 'Yannis' THEN json_set(c.value,
                                '$.HighResPhotoUrl', 'https://images.play.tv/styles/e571973e3f87726813c649d14b960d4bd8fafb9e5b6fa4f53d8b064e3df4a4f1/meta/demols14500x500yannis-tco1ng.png',
                                '$.Bio', 'Yannis verdeelt en installeert kunstgrasvelden voor sportvelden in heel Vlaanderen. Hij heeft een passie voor zingen en stond als jongere op de planken in het muziektheater.')
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
