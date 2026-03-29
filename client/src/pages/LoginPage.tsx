import { useState } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { passwordlessClient } from '../lib/passwordless'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const recovered = searchParams.get('recovered') === 'true'
  const { inviteCode, gameId, gameName } = (location.state ?? {}) as {
    inviteCode?: string
    gameId?: string
    gameName?: string
  }

  async function handleLogin() {
    if (!email.trim()) {
      setError('Voer je e-mailadres in.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await passwordlessClient.signinWithAlias(email.trim())
      if (result.error) {
        setError(result.error.title ?? 'Inloggen mislukt.')
        return
      }
      const user = await api.verifyPasskey(result.token)
      setUser(user)
      if (gameId && inviteCode) {
        await api.joinGame(gameId, inviteCode)
        navigate(`/game/${gameId}`)
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggen mislukt.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Inloggen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {recovered && (
            <Alert>
              <AlertDescription>
                Je bent hersteld. Log in met je e-mailadres en maak daarna een nieuwe passkey aan.
              </AlertDescription>
            </Alert>
          )}
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
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <Button onClick={handleLogin} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Bezig...
              </>
            ) : (
              'Inloggen met passkey'
            )}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2">
          <Link
            to="/register"
            state={location.state}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Nieuw account aanmaken →
          </Link>
          <Link to="/recover" className="text-sm text-muted-foreground hover:text-foreground">
            Kan niet inloggen?
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
