import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
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

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const { inviteCode, gameId, gameName, adminBypass } = (location.state ?? {}) as {
    inviteCode?: string
    gameId?: string
    gameName?: string
    adminBypass?: boolean
  }

  useEffect(() => {
    if (!inviteCode && !adminBypass) {
      navigate('/join', { replace: true })
    }
  }, [inviteCode, adminBypass, navigate])

  async function handleRegister() {
    if (!email.trim() || !displayName.trim() || !password) {
      setError('E-mailadres, naam en wachtwoord zijn verplicht.')
      return
    }
    if (password !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = await api.register(email.trim(), displayName.trim(), password, inviteCode)
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
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">🕵️ De Mol</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Maak een account aan om mee te spelen
          </p>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Registreren</CardTitle>
            <CardDescription>Maak een nieuw account aan met een wachtwoord.</CardDescription>
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
              <Label htmlFor="displayName">Naam</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Zichtbaar voor andere spelers"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Wachtwoord</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Wachtwoord bevestigen</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                placeholder="••••••••"
              />
            </div>
            <Button onClick={handleRegister} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
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
    </div>
  )
}
