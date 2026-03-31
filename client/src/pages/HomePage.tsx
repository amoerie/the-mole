import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api/client'
import type { Game } from '../types'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { Separator } from '../components/ui/separator'
import { AlertCircle, ChevronRight, Gamepad2, Trash2, Users } from 'lucide-react'
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
} from '../components/ui/alert-dialog'

export default function HomePage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const { inviteCode: routeInviteCode } = useParams<{ inviteCode?: string }>()

  const [games, setGames] = useState<Game[]>([])
  const [gameName, setGameName] = useState('')
  const [inviteCode, setInviteCode] = useState(routeInviteCode ?? '')
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  const handleJoinByInvite = useCallback(
    async (code: string) => {
      if (!code.trim() || joining) return
      setJoining(true)
      setError('')
      try {
        const game = await api.getGameByInvite(code)
        await api.joinGame(game.id, code)
        saveGameId(game.id)
        navigate(`/game/${game.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ongeldige uitnodigingscode')
      } finally {
        setJoining(false)
      }
    },
    [joining, navigate],
  )

  useEffect(() => {
    if (routeInviteCode && user) {
      handleJoinByInvite(routeInviteCode)
    }
  }, [routeInviteCode, user, handleJoinByInvite])

  useEffect(() => {
    if (!user) return
    api
      .getMyGames()
      .then(setGames)
      .catch(() => {
        // Fallback to localStorage if API not available
        const savedGameIds = JSON.parse(localStorage.getItem('myGameIds') ?? '[]') as string[]
        Promise.all(savedGameIds.map((id) => api.getGame(id).catch(() => null))).then((results) =>
          setGames(results.filter((g): g is Game => g !== null)),
        )
      })
  }, [user])

  useEffect(() => {
    if (!loading && !user) {
      navigate('/join')
    }
  }, [loading, user, navigate])

  async function handleDeleteGame(gameId: string) {
    setError('')
    try {
      await api.deleteGame(gameId)
      setGames((prev) => prev.filter((g) => g.id !== gameId))
      const ids = JSON.parse(localStorage.getItem('myGameIds') ?? '[]') as string[]
      localStorage.setItem('myGameIds', JSON.stringify(ids.filter((id) => id !== gameId)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij verwijderen')
    }
  }

  async function handleCreateGame() {
    if (!gameName.trim()) return
    setError('')
    try {
      const game = await api.createGame(gameName, [])
      saveGameId(game.id)
      navigate(`/game/${game.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij aanmaken')
    }
  }

  function saveGameId(gameId: string) {
    const ids = JSON.parse(localStorage.getItem('myGameIds') ?? '[]') as string[]
    if (!ids.includes(gameId)) {
      ids.push(gameId)
      localStorage.setItem('myGameIds', JSON.stringify(ids))
    }
  }

  if (loading) {
    return (
      <div
        data-testid="loading-skeleton"
        className="container mx-auto max-w-2xl px-4 py-8 flex flex-col gap-4"
      >
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!user) return null

  const isAdmin = user.roles.includes('admin')

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8 flex flex-col gap-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isAdmin && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Nieuw spel aanmaken</CardTitle>
            <CardDescription>Maak een spel aan en nodig spelers uit met een code.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Spelnaam"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateGame()}
              />
              <Button onClick={handleCreateGame}>Aanmaken</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Deelnemen aan spel</CardTitle>
          <CardDescription>Heb je een uitnodigingscode? Vul die hier in.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Uitnodigingscode"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinByInvite(inviteCode)}
            />
            <Button onClick={() => handleJoinByInvite(inviteCode)} disabled={joining}>
              {joining ? 'Bezig...' : 'Deelnemen'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Mijn spellen</h2>
          <Separator className="flex-1" />
        </div>

        {games.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <Gamepad2 className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Je neemt nog niet deel aan een spel.</p>
            <p className="text-xs text-muted-foreground">
              Gebruik een uitnodigingscode om deel te nemen.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {games.map((game) => (
              <div key={game.id} className="flex items-center gap-2">
                <button
                  className="flex flex-1 items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => navigate(`/game/${game.id}`)}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{game.name}</span>
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {game.contestants.length} kandidaten
                      </span>
                      <span>{game.episodes.length} afleveringen</span>
                    </span>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
                {user && game.adminUserId === user.userId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Spel verwijderen"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Spel verwijderen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Dit verwijdert <strong>{game.name}</strong> inclusief alle spelers en
                          ranglijsten. Dit kan niet ongedaan worden gemaakt.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleDeleteGame(game.id)}
                        >
                          Verwijderen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
