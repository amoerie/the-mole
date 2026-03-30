import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit() {
    if (!email.trim()) {
      setError('Voer je e-mailadres in.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.forgotPassword(email.trim())
      setSubmitted(true)
    } catch {
      setError('Er is iets misgegaan. Probeer het later opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="flex w-full max-w-md flex-col gap-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">🕵️ De Mol</h1>
          </div>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Mail verstuurd</CardTitle>
              <CardDescription>
                Als dit e-mailadres bekend is, ontvang je een herstelmail met een link om je
                wachtwoord te herstellen.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
                ← Terug naar inloggen
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">🕵️ De Mol</h1>
          <p className="mt-2 text-sm text-muted-foreground">Wachtwoord herstellen</p>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Wachtwoord vergeten</CardTitle>
            <CardDescription>
              Vul je e-mailadres in. Als het bekend is, sturen we een herstelmail.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
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
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="jou@email.be"
              />
            </div>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Bezig...
                </>
              ) : (
                'Herstelmail versturen'
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
