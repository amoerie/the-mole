import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog'
import type { Contestant, Episode } from '../types'

function nextSundayDateStr(): string {
  const now = new Date()
  const daysUntilSunday = now.getDay() === 0 ? 7 : 7 - now.getDay()
  const d = new Date(now)
  d.setDate(d.getDate() + daysUntilSunday)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  episodes: Episode[]
  contestants: Contestant[]
  activeContestants: Contestant[]
  moleContestantId?: string
  onCreateEpisode: (deadline: string, eliminatedIds: string[]) => Promise<void>
  onDeleteEpisode: (episodeNumber: number) => Promise<void>
  onRevealMole: (moleId: string) => Promise<void>
}

export default function AdminEpisodeManager({
  episodes,
  contestants,
  activeContestants,
  moleContestantId,
  onCreateEpisode,
  onDeleteEpisode,
  onRevealMole,
}: Props) {
  const [deadline, setDeadline] = useState(nextSundayDateStr)
  const [eliminatedIds, setEliminatedIds] = useState<string[]>([])
  const [moleId, setMoleId] = useState('')

  function toggleEliminated(id: string) {
    setEliminatedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleCreate() {
    if (!deadline) return
    // Treat selected date as local time at 20:00, convert to UTC ISO string
    const deadlineIso = new Date(deadline + 'T20:00:00').toISOString()
    await onCreateEpisode(deadlineIso, eliminatedIds)
    setDeadline(nextSundayDateStr())
    setEliminatedIds([])
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Afleveringen beheren</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-0">
        {episodes.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Bestaande afleveringen</p>
            {episodes.map((ep) => (
              <div
                key={ep.number}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>
                  Aflevering {ep.number} — deadline {new Date(ep.deadline).toLocaleString('nl-BE')}
                  {ep.eliminatedContestantIds.length > 0 && (
                    <span className="text-muted-foreground">
                      {' '}
                      ·{' '}
                      {ep.eliminatedContestantIds
                        .map((id) => contestants.find((c) => c.id === id)?.name ?? id)
                        .join(', ')}{' '}
                      afgevallen
                    </span>
                  )}
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Verwijderen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Aflevering {ep.number} verwijderen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Dit verwijdert ook alle ingediende rangschikkingen van deze aflevering. Deze
                        actie kan niet ongedaan worden gemaakt.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => onDeleteEpisode(ep.number)}
                      >
                        Verwijderen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Nieuwe aflevering</p>
          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="flex-1 min-w-40"
            />
            <Button onClick={handleCreate}>Aflevering toevoegen</Button>
          </div>
          {activeContestants.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Afgevallen kandidaten (optioneel)</p>
              <div className="flex flex-wrap gap-3">
                {activeContestants.map((c) => (
                  <label key={c.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eliminatedIds.includes(c.id)}
                      onChange={() => toggleEliminated(c.id)}
                      className="accent-primary"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {!moleContestantId && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">De Mol onthullen</p>
            <div className="flex gap-2">
              <select
                value={moleId}
                onChange={(e) => setMoleId(e.target.value)}
                className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecteer de Mol</option>
                {contestants.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button variant="destructive" onClick={() => moleId && onRevealMole(moleId)}>
                Onthullen
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
