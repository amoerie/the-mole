import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import type { Game } from '../types'

const SEASON_14_CONTESTANTS = [
  { name: 'Abigail', age: 33, photoUrl: '/contestants/abigail.png' },
  { name: 'Dries', age: 30, photoUrl: '/contestants/dries.png' },
  { name: 'Isabel', age: 51, photoUrl: '/contestants/isabel.png' },
  { name: 'Karla', age: 52, photoUrl: '/contestants/karla.png' },
  { name: 'Maïté', age: 26, photoUrl: '/contestants/maite.png' },
  { name: 'Vincent', age: 51, photoUrl: '/contestants/vincent.png' },
  { name: 'Wout', age: 33, photoUrl: '/contestants/wout.png' },
  { name: 'Maxim', age: 26, photoUrl: '/contestants/maxim.png' },
  { name: 'Julie', age: 26, photoUrl: '/contestants/julie.png' },
  { name: 'Kristof', age: 40, photoUrl: '/contestants/kristof.png' },
  { name: 'Yana', age: 33, photoUrl: '/contestants/yana.png' },
  { name: 'Yannis', age: 36, photoUrl: '/contestants/yannis.png' },
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
