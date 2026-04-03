import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { Game, GamePlayer, PlayerRanking } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Alert, AlertDescription } from './ui/alert'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import { AlertCircle, ChevronDown, ChevronUp, Copy, Check, KeyRound, Users } from 'lucide-react'

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

  const isGameAdmin = user?.userId === game.adminUserId

  const [open, setOpen] = useState(false)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [episodeData, setEpisodeData] = useState<EpisodeRankingData[]>([])

  // Per-player reset link state: userId → { loading, url, error, copied }
  const [resetLinkState, setResetLinkState] = useState<
    Record<string, { loading: boolean; url: string | null; error: string; copied: boolean }>
  >({})

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

  async function generateResetLink(userId: string) {
    setResetLinkState((prev) => ({
      ...prev,
      [userId]: { loading: true, url: null, error: '', copied: false },
    }))
    try {
      const url = await api.generatePasswordResetLink(game.id, userId)
      setResetLinkState((prev) => ({
        ...prev,
        [userId]: { loading: false, url, error: '', copied: false },
      }))
    } catch (err) {
      setResetLinkState((prev) => ({
        ...prev,
        [userId]: {
          loading: false,
          url: null,
          error: err instanceof Error ? err.message : 'Fout bij aanmaken link',
          copied: false,
        },
      }))
    }
  }

  async function copyResetLink(userId: string, url: string) {
    await navigator.clipboard.writeText(url)
    setResetLinkState((prev) => ({ ...prev, [userId]: { ...prev[userId], copied: true } }))
    setTimeout(() => {
      setResetLinkState((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], copied: false },
      }))
    }, 2000)
  }

  async function togglePlayer(userId: string) {
    if (expandedPlayer === userId) {
      setExpandedPlayer(null)
      // Clear reset link state when collapsing
      setResetLinkState((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
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
                        {isGameAdmin && !isCurrentUser && (
                          <div className="flex flex-col gap-2">
                            {!resetLinkState[player.userId]?.url ? (
                              <div className="flex flex-col gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => generateResetLink(player.userId)}
                                  disabled={resetLinkState[player.userId]?.loading}
                                  className="w-fit"
                                >
                                  <KeyRound className="size-3.5 mr-1.5" />
                                  {resetLinkState[player.userId]?.loading
                                    ? 'Aanmaken...'
                                    : 'Reset wachtwoord'}
                                </Button>
                                {resetLinkState[player.userId]?.error && (
                                  <p className="text-xs text-destructive">
                                    {resetLinkState[player.userId].error}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <p className="text-xs text-muted-foreground">
                                  Stuur deze link naar {player.displayName}:
                                </p>
                                <div className="flex gap-2">
                                  <input
                                    readOnly
                                    value={resetLinkState[player.userId].url!}
                                    className="flex-1 min-w-0 rounded-md border bg-muted px-2 py-1 text-xs font-mono"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      copyResetLink(
                                        player.userId,
                                        resetLinkState[player.userId].url!,
                                      )
                                    }
                                    className="shrink-0"
                                  >
                                    {resetLinkState[player.userId].copied ? (
                                      <>
                                        <Check className="size-3.5 mr-1.5" />
                                        Gekopieerd!
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="size-3.5 mr-1.5" />
                                        Kopieer
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
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
