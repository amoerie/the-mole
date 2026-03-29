import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api/client'
import type { Game, Ranking } from '../types'
import ContestantCard from '../components/ContestantCard'
import RankingBoard from '../components/RankingBoard'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { Separator } from '../components/ui/separator'
import { AlertCircle, CheckCircle2, Trophy } from 'lucide-react'

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { user } = useAuth()

  const [game, setGame] = useState<Game | null>(null)
  const [myRankings, setMyRankings] = useState<Ranking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Admin controls state
  const [newDeadline, setNewDeadline] = useState('')
  const [eliminatedId, setEliminatedId] = useState('')
  const [moleId, setMoleId] = useState('')
  const [newContestantName, setNewContestantName] = useState('')
  const [newContestantAge, setNewContestantAge] = useState('')
  const [newContestantPhoto, setNewContestantPhoto] = useState('')

  const loadGame = useCallback(async () => {
    if (!gameId) return
    try {
      const [gameData, rankings] = await Promise.all([
        api.getGame(gameId),
        api.getMyRankings(gameId).catch(() => [] as Ranking[]),
      ])
      setGame(gameData)
      setMyRankings(rankings)
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
  const isDeadlinePassed = currentEpisode ? new Date(currentEpisode.deadline) < new Date() : true
  const hasSubmittedCurrent = currentEpisode
    ? myRankings.some((r) => r.episodeNumber === currentEpisode.number)
    : false
  const existingRanking = currentEpisode
    ? myRankings.find((r) => r.episodeNumber === currentEpisode.number)
    : undefined

  const eliminatedIds = new Set(
    game.episodes.filter((e) => e.eliminatedContestantId).map((e) => e.eliminatedContestantId!),
  )
  const activeContestants = game.contestants.filter((c) => !eliminatedIds.has(c.id))

  async function handleSubmitRanking(orderedIds: string[]) {
    if (!currentEpisode || !gameId) return
    setSubmitting(true)
    try {
      await api.submitRanking(gameId, currentEpisode.number, orderedIds)
      setSubmitted(true)
      await loadGame()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij indienen')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateEpisode() {
    if (!gameId || !newDeadline) return
    try {
      await api.createEpisode(gameId, newDeadline, eliminatedId || undefined)
      await loadGame()
      setNewDeadline('')
      setEliminatedId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij aanmaken aflevering')
    }
  }

  async function handleRevealMole() {
    if (!gameId || !moleId) return
    try {
      await api.revealMole(gameId, moleId)
      await loadGame()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij onthullen')
    }
  }

  async function handleAddContestant() {
    if (!gameId || !newContestantName.trim()) return
    try {
      const updated = await api.addContestants(gameId, [
        {
          name: newContestantName.trim(),
          age: parseInt(newContestantAge) || 0,
          photoUrl: newContestantPhoto.trim(),
        },
      ])
      setGame(updated)
      setNewContestantName('')
      setNewContestantAge('')
      setNewContestantPhoto('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij toevoegen kandidaat')
    }
  }

  const season14Contestants = [
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
  ]

  async function handleLoadSeason14() {
    if (!gameId) return
    try {
      const updated = await api.addContestants(gameId, season14Contestants)
      setGame(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij laden seizoen 14')
    }
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8 flex flex-col gap-6">
      {/* Header */}
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

      {/* Contestants */}
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

      {/* Current episode ranking */}
      {currentEpisode && !game.moleContestantId && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>Aflevering {currentEpisode.number}</CardTitle>
              <Badge variant={isDeadlinePassed ? 'destructive' : 'secondary'} className="text-xs">
                {isDeadlinePassed ? 'Deadline verstreken' : 'Open'}
              </Badge>
            </div>
            <CardDescription>
              Deadline: {new Date(currentEpisode.deadline).toLocaleString('nl-BE')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {hasSubmittedCurrent || submitted ? (
              <div className="flex items-center gap-2 text-sm text-green-500">
                <CheckCircle2 className="size-4" />
                <span>Je rangschikking is ingediend voor deze aflevering.</span>
              </div>
            ) : (
              <RankingBoard
                contestants={activeContestants}
                initialOrder={existingRanking?.contestantIds}
                onSubmit={handleSubmitRanking}
                disabled={isDeadlinePassed || submitting}
              />
            )}
          </CardContent>
        </Card>
      )}

      {!currentEpisode && !game.moleContestantId && (
        <p className="text-sm text-muted-foreground">Nog geen aflevering gestart.</p>
      )}

      {/* Admin section */}
      {isAdmin && (
        <>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Beheer
            </span>
            <Separator className="flex-1" />
          </div>

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
                  <Button variant="outline" onClick={handleLoadSeason14} className="w-fit">
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
                    value={newContestantName}
                    onChange={(e) => setNewContestantName(e.target.value)}
                    className="flex-1 min-w-24"
                  />
                  <Input
                    type="number"
                    placeholder="Leeftijd"
                    value={newContestantAge}
                    onChange={(e) => setNewContestantAge(e.target.value)}
                    className="w-24"
                  />
                  <Input
                    type="text"
                    placeholder="Foto URL (optioneel)"
                    value={newContestantPhoto}
                    onChange={(e) => setNewContestantPhoto(e.target.value)}
                    className="flex-1 min-w-32"
                  />
                  <Button onClick={handleAddContestant}>Toevoegen</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Afleveringen beheren</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 pt-0">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Nieuwe aflevering</p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="datetime-local"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="flex-1 min-w-40"
                  />
                  <select
                    value={eliminatedId}
                    onChange={(e) => setEliminatedId(e.target.value)}
                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Geen eliminatie</option>
                    {activeContestants.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Button onClick={handleCreateEpisode}>Aflevering toevoegen</Button>
                </div>
              </div>

              {!game.moleContestantId && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">De Mol onthullen</p>
                  <div className="flex gap-2">
                    <select
                      value={moleId}
                      onChange={(e) => setMoleId(e.target.value)}
                      className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Selecteer de Mol</option>
                      {game.contestants.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <Button variant="destructive" onClick={handleRevealMole}>
                      Onthullen
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}
