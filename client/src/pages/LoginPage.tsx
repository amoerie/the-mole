import { useState } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { passwordlessClient } from '../lib/passwordless'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'

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
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">🕵️ De Mol</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Log in om je rangschikking in te dienen
          </p>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Inloggen</CardTitle>
            <CardDescription>Gebruik je passkey om in te loggen.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            {recovered && (
              <Alert>
                <AlertDescription>
                  Je bent hersteld. Log in met je e-mailadres en maak daarna een nieuwe passkey aan.
                </AlertDescription>
              </Alert>
            )}
            {gameName && (
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Uitgenodigd voor</p>
                <p className="font-semibold">{gameName}</p>
              </div>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="jou@email.be"
              />
            </div>
            <Button onClick={handleLogin} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Bezig...
                </>
              ) : (
                'Inloggen met passkey'
              )}
            </Button>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2">
            {location.state?.inviteCode && (
              <Link
                to="/register"
                state={location.state}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Nieuw account aanmaken →
              </Link>
            )}
            <Link to="/recover" className="text-sm text-muted-foreground hover:text-foreground">
              Kan niet inloggen?
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
