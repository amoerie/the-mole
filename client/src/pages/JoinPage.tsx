import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2, KeyRound, AlertCircle } from 'lucide-react'

export default function JoinPage() {
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [game, setGame] = useState<{ id?: string; name?: string } | null>(null)
  const navigate = useNavigate()

  async function handleSubmit() {
    if (!inviteCode.trim()) return
    setLoading(true)
    setError('')
    setGame(null)
    try {
      const data = await api.getGameByInvite(inviteCode.trim())
      setGame(data)
    } catch {
      setError('Ongeldige uitnodigingscode.')
    } finally {
      setLoading(false)
    }
  }

  const state = { inviteCode, gameId: game?.id, gameName: game?.name }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">🕵️ De Mol</h1>
          <p className="mt-2 text-sm text-muted-foreground">Rangschik verdachten per aflevering</p>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <KeyRound className="size-5 text-muted-foreground" />
              <CardTitle>Deelnemen</CardTitle>
            </div>
            <CardDescription>
              Voer je uitnodigingscode in om deel te nemen aan een spel.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {game ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Uitgenodigd voor</p>
                  <p className="font-semibold">{game.name}</p>
                </div>
                <Button onClick={() => navigate('/register', { state })}>Registreren</Button>
                <Button variant="outline" onClick={() => navigate('/login', { state })}>
                  Ik heb al een account
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">Uitnodigingscode</Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="bv. MOL2026"
                  />
                </div>
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Bezig...
                    </>
                  ) : (
                    'Verder'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Al een account?{' '}
          <Link to="/login" className="underline hover:text-foreground">
            Inloggen
          </Link>
        </p>
      </div>
    </div>
  )
}
