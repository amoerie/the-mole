import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { passwordlessClient } from '../lib/passwordless'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const { inviteCode, gameId, gameName } = (location.state ?? {}) as {
    inviteCode?: string
    gameId?: string
    gameName?: string
  }

  async function handleRegister() {
    if (!email.trim() || !displayName.trim()) {
      setError('E-mailadres en naam zijn verplicht.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { token } = await api.registerPasskey(email.trim(), displayName.trim())
      const registerResult = await passwordlessClient.register(token, email.trim())
      if (registerResult.error) {
        throw new Error(registerResult.error.title)
      }
      const signinResult = await passwordlessClient.signinWithAlias(email.trim())
      if (signinResult.error) {
        navigate('/login', { state: location.state })
        return
      }
      const user = await api.verifyPasskey(signinResult.token)
      setUser(user)
      if (gameId && inviteCode) {
        await api.joinGame(gameId, inviteCode)
        navigate(`/game/${gameId}`)
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registratie mislukt.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Registreren</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {gameName && (
            <Alert>
              <AlertDescription>
                Je wordt uitgenodigd voor: <strong>{gameName}</strong>
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mailadres</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName">Naam (zoals zichtbaar voor andere spelers)</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
            />
          </div>
          <Button onClick={handleRegister} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Bezig...
              </>
            ) : (
              'Account aanmaken'
            )}
          </Button>
        </CardContent>
        <CardFooter>
          <Link
            to="/login"
            state={location.state}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Terug naar inloggen
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
