import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2 } from 'lucide-react'

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
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Herstel toegang</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {success ? (
            <Alert>
              <AlertDescription>
                Als dit e-mailadres bekend is bij ons, ontvang je een e-mail met een herstellink.
                Controleer ook je spam.
              </AlertDescription>
            </Alert>
          ) : (
            <>
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
                  onKeyDown={(e) => e.key === 'Enter' && handleRecover()}
                />
              </div>
              <Button onClick={handleRecover} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
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
  )
}
