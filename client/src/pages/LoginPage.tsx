import { useState } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
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
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const { inviteCode, gameId, gameName } = (location.state ?? {}) as {
    inviteCode?: string
    gameId?: string
    gameName?: string
  }

  // ?redirect=/some/path — only same-origin paths are accepted
  const redirectParam = searchParams.get('redirect')
  const safeRedirect =
    redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
      ? redirectParam
      : null

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Voer je e-mailadres en wachtwoord in.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = await api.login(email.trim(), password)
      setUser(user)
      if (gameId && inviteCode) {
        await api.joinGame(gameId, inviteCode)
        navigate(`/game/${gameId}`)
      } else if (safeRedirect) {
        navigate(safeRedirect)
      } else {
        navigate('/')
      }
    } catch {
      setError('E-mailadres of wachtwoord is onjuist.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">🕵️ Mollenjagers</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Log in om je rangschikking in te dienen
          </p>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Inloggen</CardTitle>
            <CardDescription>Gebruik je e-mailadres en wachtwoord om in te loggen.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
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
                placeholder="jou@email.be"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Wachtwoord</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
              />
            </div>
            <Button onClick={handleLogin} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Bezig...
                </>
              ) : (
                'Inloggen'
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
            <Link
              to="/forgot-password"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Wachtwoord vergeten?
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
