import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api/client'
import type { Game } from '../types'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'

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
      <div data-testid="loading-skeleton" className="mx-auto max-w-2xl p-4 flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!user) return null

  const isAdmin = user.roles.includes('admin')

  return (
    <div className="mx-auto max-w-2xl p-4 flex flex-col gap-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Nieuw spel aanmaken</CardTitle>
          </CardHeader>
          <CardContent>
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
        <CardHeader>
          <CardTitle>Deelnemen aan spel</CardTitle>
        </CardHeader>
        <CardContent>
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

      {games.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mijn spellen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {games.map((game) => (
                <Button
                  key={game.id}
                  variant="outline"
                  className="justify-between h-auto py-3"
                  onClick={() => navigate(`/game/${game.id}`)}
                >
                  <span>{game.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {game.contestants.length} deelnemers · {game.episodes.length} afleveringen
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
