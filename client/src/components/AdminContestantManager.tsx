import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import type { Game } from '../types'

const SEASON_14_CONTESTANTS = [
  {
    name: 'Abigail',
    age: 33,
    photoUrl: '/contestants/abigail.png',
    highResPhotoUrl: '/contestants/abigail-hires.webp',
    bio: 'Abigail heeft wortels in Ghana en woonde een jaar in Shanghai. Nu leeft ze in Limburg met haar man en twee kinderen. Als teamleider in een kinderopvang houdt ze van chaos én van orde.',
  },
  {
    name: 'Dries',
    age: 30,
    photoUrl: '/contestants/dries.png',
    highResPhotoUrl: '/contestants/dries-hires.webp',
    bio: 'Dries werkt als IT-manager en staat bekend als een legendarische snurker — hij nam zelfs oordopjes mee voor zijn medekandidaten. Woont samen met zijn vriendin ten zuiden van zijn geboortedorp.',
  },
  {
    name: 'Isabel',
    age: 51,
    photoUrl: '/contestants/isabel.png',
    highResPhotoUrl: '/contestants/isabel-hires.webp',
    bio: 'Isabel beheert twee bankkantoren in de Antwerpse regio en deelt haar thuis met 3 kinderen en 5 katten. Ze bestelt liever sushi dan dat ze zelf kookt.',
  },
  {
    name: 'Karla',
    age: 52,
    photoUrl: '/contestants/karla.png',
    highResPhotoUrl: '/contestants/karla-hires.webp',
    bio: 'Karla is de meest ervaren kandidaat van het seizoen. Ze woont samen met haar man, dochter, drie stiefkinderen én 17 schildpadden. Ze omschrijft zichzelf als een oude bomma — behalve als ze in de Tesla van haar man zit.',
  },
  {
    name: 'Maïté',
    age: 26,
    photoUrl: '/contestants/maite.png',
    highResPhotoUrl: '/contestants/maite-hires.webp',
    bio: 'Maïté werd geboren in Zuid-India en groeide op in een Belgisch adoptiegezin in Deinze. Ze helpt nieuwkomers integreren in de maatschappij, runt een cateringbedrijf, poseert voor kunststudenten én speelt drums.',
  },
  {
    name: 'Vincent',
    age: 51,
    photoUrl: '/contestants/vincent.png',
    highResPhotoUrl: '/contestants/vincent-hires.webp',
    bio: 'Vincent werkte ooit voor een tv-productiemaatschappij en runt nu zijn eigen softwarebedrijf. Hij geniet van sauna, kaasfondue en zangles, en geeft grif toe dat hij geen enkel sport kan.',
  },
  {
    name: 'Wout',
    age: 33,
    photoUrl: '/contestants/wout.png',
    highResPhotoUrl: '/contestants/wout-hires.webp',
    bio: 'Wout is 197 cm groot en werkt in het Vrijbroekpark in Mechelen. Naast zijn dagtaak als tuinman en administratief medewerker is hij ook videograaf en dj onder de naam C-MAN.',
  },
  {
    name: 'Maxim',
    age: 26,
    photoUrl: '/contestants/maxim.png',
    highResPhotoUrl: '/contestants/maxim-hires.webp',
    bio: 'Maxim is een bakkerszoon uit West-Vlaanderen met een ongezonde obsessie voor éclairs. Hij bekeek Game of Thrones al zes keer van begin tot einde.',
  },
  {
    name: 'Julie',
    age: 26,
    photoUrl: '/contestants/julie.png',
    highResPhotoUrl: '/contestants/julie-hires.webp',
    bio: "Julie is een luidruchtige Antwerpse met een uitgesproken accent. Ze steunt zowel Beerschot als Antwerp en staat in haar familie bekend als 'Boulette'.",
  },
  {
    name: 'Kristof',
    age: 40,
    photoUrl: '/contestants/kristof.png',
    highResPhotoUrl: '/contestants/kristof-hires.webp',
    bio: 'Kristof is een jonge veertigjarige die grijze haren systematisch uittrekt — al geeft hij toe dat hij ze niet meer kan bijhouden. Als cafébaas in Antwerpen kent hij het klappen van de zweep.',
  },
  {
    name: 'Yana',
    age: 33,
    photoUrl: '/contestants/yana.png',
    highResPhotoUrl: '/contestants/yana-hires.webp',
    bio: 'Yana is getrouwd met Laurenz en moeder van twee dochters. Als tiener haalde ze een brevet als juniorvallschermspringer. Ze werkt in IT als digitaal adviseur.',
  },
  {
    name: 'Yannis',
    age: 36,
    photoUrl: '/contestants/yannis.png',
    highResPhotoUrl: '/contestants/yannis-hires.webp',
    bio: 'Yannis verdeelt en installeert kunstgrasvelden voor sportvelden in heel Vlaanderen. Hij heeft een passie voor zingen en stond als jongere op de planken in het muziektheater.',
  },
]

interface Props {
  game: Game
  onAddContestant: (name: string, age: number, photoUrl: string) => Promise<void>
  onLoadSeason14: (contestants: typeof SEASON_14_CONTESTANTS) => Promise<void>
}

export default function AdminContestantManager({ game, onAddContestant, onLoadSeason14 }: Props) {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [photo, setPhoto] = useState('')

  async function handleAdd() {
    if (!name.trim()) return
    await onAddContestant(name.trim(), parseInt(age) || 0, photo.trim())
    setName('')
    setAge('')
    setPhoto('')
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Kandidaten beheren</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-0">
        {game.contestants.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Je spel heeft nog geen kandidaten. Voeg ze één voor één toe, of laad het huidige
              seizoen.
            </p>
            <Button
              variant="outline"
              onClick={() => onLoadSeason14(SEASON_14_CONTESTANTS)}
              className="w-fit"
            >
              🇧🇪 Seizoen 14 laden (2026)
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Kandidaat toevoegen</p>
          <div className="flex flex-wrap gap-2">
            <Input
              type="text"
              placeholder="Naam"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 min-w-24"
            />
            <Input
              type="number"
              placeholder="Leeftijd"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-24"
            />
            <Input
              type="text"
              placeholder="Foto URL (optioneel)"
              value={photo}
              onChange={(e) => setPhoto(e.target.value)}
              className="flex-1 min-w-32"
            />
            <Button onClick={handleAdd}>Toevoegen</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
