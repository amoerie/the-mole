import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Game } from '../types'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { AlertCircle, ArrowLeft } from 'lucide-react'

export default function ContestantDetailPage() {
  const { gameId, contestantId } = useParams<{ gameId: string; contestantId: string }>()

  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!gameId) {
      setLoading(false)
      return
    }
    api
      .getGame(gameId)
      .then(setGame)
      .catch((err) => setError(err instanceof Error ? err.message : 'Fout bij laden'))
      .finally(() => setLoading(false))
  }, [gameId])

  if (loading) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8 flex flex-col gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-80 w-full rounded-xl" />
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

  const photoSrc = contestant.highResPhotoUrl || contestant.photoUrl

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

      <img
        src={photoSrc}
        alt={contestant.name}
        className="w-full rounded-xl object-cover aspect-square"
        onError={(e) => {
          const img = e.currentTarget
          if (!contestant.photoUrl || img.dataset.fallbackAttempted === 'true') {
            return
          }
          img.dataset.fallbackAttempted = 'true'
          img.src = contestant.photoUrl
        }}
      />

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{contestant.name}</h1>
        <p className="text-sm text-muted-foreground">{contestant.age} jaar</p>
      </div>

      {contestant.bio && <p className="text-sm leading-relaxed">{contestant.bio}</p>}
    </main>
  )
}
