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
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function RecoveryPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleRecover() {
    if (!email.trim()) {
      setError('Voer je e-mailadres in.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.requestRecovery(email.trim())
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is een fout opgetreden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">🕵️ De Mol</h1>
          <p className="mt-2 text-sm text-muted-foreground">Herstel toegang tot je account</p>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Herstel toegang</CardTitle>
            <CardDescription>
              We sturen je een e-mail met een link om opnieuw in te loggen.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            {success ? (
              <Alert>
                <CheckCircle2 className="size-4" />
                <AlertDescription>
                  Als dit e-mailadres bekend is bij ons, ontvang je een e-mail met een herstellink.
                  Controleer ook je spam.
                </AlertDescription>
              </Alert>
            ) : (
              <>
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
                    onKeyDown={(e) => e.key === 'Enter' && handleRecover()}
                    placeholder="jou@email.be"
                  />
                </div>
                <Button onClick={handleRecover} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Bezig...
                    </>
                  ) : (
                    'Herstelmail versturen'
                  )}
                </Button>
              </>
            )}
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
