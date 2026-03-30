import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { Game, GamePlayer, PlayerRanking } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Alert, AlertDescription } from './ui/alert'
import { Badge } from './ui/badge'
import { Skeleton } from './ui/skeleton'
import { AlertCircle, ChevronDown, ChevronUp, Users } from 'lucide-react'

interface EpisodeRankingData {
  episodeNumber: number
  rankings: PlayerRanking[]
  loading: boolean
  error: string
}

interface Props {
  game: Game
}

export default function GroupMembers({ game }: Props) {
  const { user } = useAuth()

  const [open, setOpen] = useState(false)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [episodeData, setEpisodeData] = useState<EpisodeRankingData[]>([])

  useEffect(() => {
    if (!open || loaded) return
    api
      .getGamePlayers(game.id)
      .then((data) => {
        setPlayers(data)
        setLoaded(true)
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Fout bij laden'))
  }, [open, loaded, game.id])

  async function togglePlayer(userId: string) {
    if (expandedPlayer === userId) {
      setExpandedPlayer(null)
      return
    }

    setExpandedPlayer(userId)

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
          const rankings = await api.getEpisodeRankings(game.id, e.number)
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

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none pb-6"
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-5" />
            <CardTitle>Groep</CardTitle>
          </div>
          {open ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {open && (
        <CardContent className="pt-0">
          {loadError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {!loaded && !loadError && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {loaded && players.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
              <p className="text-sm text-muted-foreground">Nog geen spelers.</p>
            </div>
          )}

          {loaded && players.length > 0 && (
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
                        {game.episodes.filter((e) => new Date(e.deadline) < new Date()).length ===
                        0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nog geen afleveringen met een verstreken deadline.
                          </p>
                        ) : episodeData.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Laden...</p>
                        ) : (
                          episodeData.map((ep) => {
                            const playerRanking = ep.rankings.find(
                              (r) => r.userId === player.userId,
                            )

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
        </CardContent>
      )}
    </Card>
  )
}
