import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  async function handleReset() {
    if (!password || !confirmPassword) {
      setError('Vul beide wachtwoordvelden in.')
      return
    }
    if (password !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen.')
      return
    }
    if (!token) {
      setError('Ongeldige herstellink.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = await api.resetPassword(token, password)
      setUser(user)
      navigate('/')
    } catch {
      setError('De herstellink is ongeldig of verlopen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">🕵️ Mollenjagers</h1>
          <p className="mt-2 text-sm text-muted-foreground">Nieuw wachtwoord instellen</p>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Nieuw wachtwoord</CardTitle>
            <CardDescription>Kies een nieuw wachtwoord voor je account.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Nieuw wachtwoord</Label>
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
                onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                placeholder="••••••••"
              />
            </div>
            <Button onClick={handleReset} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Bezig...
                </>
              ) : (
                'Wachtwoord opslaan'
              )}
            </Button>
          </CardContent>
          <CardFooter>
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
              ← Terug naar inloggen
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
