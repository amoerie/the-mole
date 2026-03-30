import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Game, GamePlayer, PlayerRanking } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { Badge } from '../components/ui/badge'
import { AlertCircle, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'

interface EpisodeRankingData {
  episodeNumber: number
  rankings: PlayerRanking[]
  loading: boolean
  error: string
}

export default function GroupPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { user } = useAuth()

  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [episodeData, setEpisodeData] = useState<EpisodeRankingData[]>([])

  useEffect(() => {
    if (!gameId) return
    Promise.all([api.getGame(gameId), api.getGamePlayers(gameId)])
      .then(([gameData, playerData]) => {
        setGame(gameData)
        setPlayers(playerData)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Fout bij laden'))
      .finally(() => setLoading(false))
  }, [gameId])

  async function togglePlayer(userId: string) {
    if (expandedPlayer === userId) {
      setExpandedPlayer(null)
      return
    }

    setExpandedPlayer(userId)

    if (!game || !gameId) return

    const now = new Date()
    const pastEpisodes = game.episodes.filter((e) => new Date(e.deadline) < now)

    if (pastEpisodes.length === 0) {
      setEpisodeData([])
      return
    }

    setEpisodeData(
      pastEpisodes.map((e) => ({
        episodeNumber: e.number,
        rankings: [],
        loading: true,
        error: '',
      })),
    )

    const results = await Promise.all(
      pastEpisodes.map(async (e) => {
        try {
          const rankings = await api.getEpisodeRankings(gameId, e.number)
          return { episodeNumber: e.number, rankings, loading: false, error: '' }
        } catch (err) {
          return {
            episodeNumber: e.number,
            rankings: [],
            loading: false,
            error: err instanceof Error ? err.message : 'Fout bij laden',
          }
        }
      }),
    )

    setEpisodeData(results)
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>Spel niet gevonden</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/game/${game.id}`}>
            <ArrowLeft className="size-4" />
            Terug
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Groep</h1>
        <p className="text-sm text-muted-foreground">{game.name}</p>
      </div>

      {players.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
          <p className="text-sm text-muted-foreground">Nog geen spelers.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {players.map((player) => {
            const isExpanded = expandedPlayer === player.userId
            const isCurrentUser = user?.userId === player.userId

            return (
              <Card key={player.id}>
                <button
                  className="w-full text-left"
                  onClick={() => togglePlayer(player.userId)}
                  aria-expanded={isExpanded}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{player.displayName}</span>
                      {isCurrentUser && (
                        <Badge variant="secondary" className="text-xs">
                          Jij
                        </Badge>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </CardContent>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 pb-4 flex flex-col gap-3 pt-3">
                    {game.episodes.filter((e) => new Date(e.deadline) < new Date()).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nog geen afleveringen met een verstreken deadline.
                      </p>
                    ) : episodeData.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Laden...</p>
                    ) : (
                      episodeData.map((ep) => {
                        const playerRanking = ep.rankings.find((r) => r.userId === player.userId)

                        return (
                          <div key={ep.episodeNumber}>
                            <p className="text-sm font-medium mb-1">
                              Aflevering {ep.episodeNumber}
                            </p>
                            {ep.loading ? (
                              <Skeleton className="h-4 w-full" />
                            ) : ep.error ? (
                              <p className="text-xs text-destructive">{ep.error}</p>
                            ) : !playerRanking ? (
                              <p className="text-xs text-muted-foreground">
                                Geen rangschikking ingediend.
                              </p>
                            ) : (
                              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-0.5">
                                {playerRanking.contestantIds.map((id) => {
                                  const contestant = game.contestants.find((c) => c.id === id)
                                  return <li key={id}>{contestant?.name ?? id}</li>
                                })}
                              </ol>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}
