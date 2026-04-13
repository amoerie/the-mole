import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Game, MolboekjeNote } from '../types'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { AlertCircle, ArrowLeft } from 'lucide-react'

export default function ContestantDetailPage() {
  const { gameId, contestantId } = useParams<{ gameId: string; contestantId: string }>()

  const [game, setGame] = useState<Game | null>(null)
  const [notebookNotes, setNotebookNotes] = useState<MolboekjeNote[]>([])
  const [loading, setLoading] = useState(!!gameId)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!gameId) return
    Promise.all([api.getGame(gameId), api.getNotebook(gameId).catch(() => null)])
      .then(([g, notebook]) => {
        setGame(g)
        setNotebookNotes(notebook?.notes ?? [])
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Fout bij laden'))
      .finally(() => setLoading(false))
  }, [gameId])

  if (loading) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8 flex flex-col gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>Spel niet gevonden</AlertDescription>
        </Alert>
      </div>
    )
  }

  const contestant = game.contestants.find((c) => c.id === contestantId)

  function highlightName(text: string, firstName: string) {
    const regex = new RegExp(`(${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 rounded-sm px-0.5">
          {part}
        </mark>
      ) : (
        part
      ),
    )
  }

  if (!contestant) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>Kandidaat niet gevonden</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <main className="container mx-auto max-w-lg px-4 py-8 flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/game/${gameId}`}>
            <ArrowLeft className="size-4" />
            Terug
          </Link>
        </Button>
      </div>

      {contestant.highResPhotoUrl && (
        <img
          src={contestant.highResPhotoUrl}
          alt={contestant.name}
          className="w-full rounded-xl object-cover aspect-video"
        />
      )}

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{contestant.name}</h1>
        <p className="text-sm text-muted-foreground">{contestant.age} jaar</p>
      </div>

      {contestant.bio && <p className="text-sm leading-relaxed">{contestant.bio}</p>}

      {(() => {
        const firstName = contestant.name.split(/\s+/)[0].toLowerCase()
        const matches = notebookNotes.filter((n) => n.content.toLowerCase().includes(firstName))
        if (matches.length === 0) return null
        return (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">In jouw molboekje</h2>
            {matches.map((note) => (
              <div
                key={note.episodeNumber}
                className="rounded-lg border border-border bg-muted/40 p-3 text-sm flex flex-col gap-1"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  Aflevering {note.episodeNumber}
                </span>
                <p className="leading-relaxed line-clamp-4">
                  {highlightName(note.content.slice(0, 300), firstName)}
                  {note.content.length > 300 && '…'}
                </p>
                <Link
                  to={`/game/${gameId}/molboekje`}
                  className="text-xs text-primary hover:underline self-start"
                >
                  Bekijk notitie →
                </Link>
              </div>
            ))}
          </div>
        )
      })()}
    </main>
  )
}
