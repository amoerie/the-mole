import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api/client'
import type { Game, PlayerRanking, Ranking } from '../types'
import ContestantCard from '../components/ContestantCard'
import EpisodeCard from '../components/EpisodeCard'
import MessageBoard from '../components/MessageBoard'
import AdminContestantManager from '../components/AdminContestantManager'
import AdminEpisodeManager from '../components/AdminEpisodeManager'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { Separator } from '../components/ui/separator'
import { AlertCircle, Trophy } from 'lucide-react'

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { user } = useAuth()

  const [game, setGame] = useState<Game | null>(null)
  const [myRankings, setMyRankings] = useState<Ranking[]>([])
  const [episodeRankings, setEpisodeRankings] = useState<PlayerRanking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadGame = useCallback(async () => {
    if (!gameId) return
    try {
      const [gameData, rankings] = await Promise.all([
        api.getGame(gameId),
        api.getMyRankings(gameId).catch(() => [] as Ranking[]),
      ])
      setGame(gameData)
      setMyRankings(rankings)

      const lastEp =
        gameData.episodes.length > 0 ? gameData.episodes[gameData.episodes.length - 1] : null
      if (lastEp && new Date(lastEp.deadline) < new Date()) {
        const allRankings = await api.getEpisodeRankings(gameId, lastEp.number).catch(() => [])
        setEpisodeRankings(allRankings)
      } else {
        setEpisodeRankings([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij laden')
    } finally {
      setLoading(false)
    }
  }, [gameId])

  useEffect(() => {
    loadGame()
  }, [loadGame])

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
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

  const isAdmin = user?.roles.includes('admin') ?? false
  const currentEpisode = game.episodes.length > 0 ? game.episodes[game.episodes.length - 1] : null
  const eliminatedIds = new Set(game.episodes.flatMap((e) => e.eliminatedContestantIds))
  const activeContestants = currentEpisode
    ? game.contestants.filter(
        (c) =>
          !game.episodes.some(
            (e) => e.number <= currentEpisode.number && e.eliminatedContestantIds.includes(c.id),
          ),
      )
    : game.contestants

  async function handleSubmitRanking(orderedIds: string[]) {
    if (!currentEpisode || !gameId) return
    await api.submitRanking(gameId, currentEpisode.number, orderedIds)
    await loadGame()
  }

  async function handleCreateEpisode(deadlineIso: string, eliminatedIds: string[]) {
    if (!gameId) return
    setError('')
    try {
      await api.createEpisode(
        gameId,
        deadlineIso,
        eliminatedIds.length > 0 ? eliminatedIds : undefined,
      )
      await loadGame()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij aanmaken aflevering')
    }
  }

  async function handleDeleteEpisode(episodeNumber: number) {
    if (!gameId) return
    setError('')
    try {
      await api.deleteEpisode(gameId, episodeNumber)
      await loadGame()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij verwijderen aflevering')
    }
  }

  async function handleRevealMole(moleId: string) {
    if (!gameId) return
    setError('')
    try {
      await api.revealMole(gameId, moleId)
      await loadGame()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij onthullen')
    }
  }

  async function handleAddContestant(name: string, age: number, photoUrl: string) {
    if (!gameId) return
    setError('')
    try {
      await api.addContestants(gameId, [{ name, age, photoUrl }])
      await loadGame()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij toevoegen kandidaat')
    }
  }

  async function handleLoadSeason14(
    contestants: { name: string; age: number; photoUrl: string }[],
  ) {
    if (!gameId) return
    setError('')
    try {
      await api.addContestants(gameId, contestants)
      await loadGame()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij laden seizoen 14')
    }
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight">{game.name}</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Uitnodigingscode:</span>
            <Badge variant="outline" className="font-mono text-xs">
              {game.inviteCode}
            </Badge>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/game/${game.id}/leaderboard`}>
            <Trophy className="size-4" />
            Klassement
          </Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {game.moleContestantId && (
        <Alert>
          <AlertDescription>
            🕵️ De Mol is onthuld:{' '}
            <strong>{game.contestants.find((c) => c.id === game.moleContestantId)?.name}</strong>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Kandidaten</CardTitle>
          <CardDescription>
            {game.contestants.length} kandidaten · {eliminatedIds.size} afgevallen
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {game.contestants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen kandidaten toegevoegd.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {game.contestants.map((c) => (
                <ContestantCard key={c.id} contestant={c} eliminated={eliminatedIds.has(c.id)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {user && <MessageBoard gameId={game.id} />}

      {currentEpisode && !game.moleContestantId && (
        <EpisodeCard
          episode={currentEpisode}
          activeContestants={activeContestants}
          allContestants={game.contestants}
          myRankings={myRankings}
          episodeRankings={episodeRankings}
          onSubmit={handleSubmitRanking}
        />
      )}

      {!currentEpisode && !game.moleContestantId && (
        <p className="text-sm text-muted-foreground">Nog geen aflevering gestart.</p>
      )}

      {isAdmin && (
        <>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Beheer
            </span>
            <Separator className="flex-1" />
          </div>

          <AdminContestantManager
            game={game}
            onAddContestant={handleAddContestant}
            onLoadSeason14={handleLoadSeason14}
          />

          <AdminEpisodeManager
            episodes={game.episodes}
            contestants={game.contestants}
            activeContestants={activeContestants}
            moleContestantId={game.moleContestantId}
            onCreateEpisode={handleCreateEpisode}
            onDeleteEpisode={handleDeleteEpisode}
            onRevealMole={handleRevealMole}
          />
        </>
      )}
    </main>
  )
}
