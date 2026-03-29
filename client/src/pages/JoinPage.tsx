import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2 } from 'lucide-react'

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
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welkom bij De Mol 🕵️</CardTitle>
          <CardDescription>
            Voer je uitnodigingscode in om deel te nemen aan een spel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {game ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Je bent uitgenodigd voor: <strong className="text-foreground">{game.name}</strong>
              </p>
              <Button onClick={() => navigate('/register', { state })}>Registreren</Button>
              <Button variant="outline" onClick={() => navigate('/login', { state })}>
                Ik heb al een account
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="inviteCode">Uitnodigingscode</Label>
                <Input
                  id="inviteCode"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="Voer code in"
                />
              </div>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
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
    </div>
  )
}
