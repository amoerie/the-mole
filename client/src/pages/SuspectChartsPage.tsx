import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '../api/client'
import type { EpisodeStat, Game } from '../types'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { AlertCircle, ArrowLeft } from 'lucide-react'

/** Interpolate from green (least suspect) to red (most suspect) based on rank position. */
function rankColor(rank: number, total: number): string {
  if (total <= 1) return '#ef4444'
  const ratio = (rank - 1) / (total - 1)
  const r = Math.round(ratio * 239 + (1 - ratio) * 34)
  const g = Math.round(ratio * 68 + (1 - ratio) * 197)
  return `rgb(${r},${g},80)`
}

export default function SuspectChartsPage() {
  const { gameId } = useParams<{ gameId: string }>()

  const [game, setGame] = useState<Game | null>(null)
  const [stats, setStats] = useState<EpisodeStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!gameId) return
    Promise.all([api.getGame(gameId), api.getSuspectStats(gameId)])
      .then(([gameData, statsData]) => {
        setGame(gameData)
        setStats(statsData)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Fout bij laden'))
      .finally(() => setLoading(false))
  }, [gameId])

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8 flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>Spel niet gevonden</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/game/${game.id}`}>
            <ArrowLeft className="size-4" />
            Terug
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Verdachtheid per aflevering</h1>
        <p className="text-sm text-muted-foreground">{game.name}</p>
      </div>

      {stats.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nog geen afleveringen met een verstreken deadline.
          </p>
        </div>
      ) : (
        stats.map((episode) => (
          <Card key={episode.episodeNumber}>
            <CardHeader>
              <CardTitle className="text-base">Aflevering {episode.episodeNumber}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={episode.stats} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    domain={[0, episode.stats.length + 0.5]}
                    reversed
                    tickCount={episode.stats.length + 1}
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Gem. rang', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value) => [
                      typeof value === 'number' ? value.toFixed(1) : value,
                      'Gem. rang',
                    ]}
                  />
                  <Bar dataKey="avgRank" radius={[4, 4, 0, 0]}>
                    {episode.stats.map((entry, index) => (
                      <Cell
                        key={entry.contestantId}
                        fill={rankColor(episode.stats.length - index, episode.stats.length)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-1 text-xs text-muted-foreground text-center">
                Lagere rang = verdachter
              </p>
            </CardContent>
          </Card>
        ))
      )}
    </main>
  )
}
