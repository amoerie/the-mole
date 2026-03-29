import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'

export default function MagicLinkPage() {
  const [searchParams] = useSearchParams()
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const [error, setError] = useState(token ? '' : 'Ongeldige herstellink.')

  useEffect(() => {
    if (!token) return

    api
      .verifyPasskey(token)
      .then((user) => {
        setUser(user)
        navigate('/login?recovered=true')
      })
      .catch(() => {
        setError('De herstellink is ongeldig of verlopen. Vraag een nieuwe aan.')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">🕵️ De Mol</h1>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Toegang herstellen</CardTitle>
            <CardDescription>Bezig met verificatie van je herstellink.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            {error ? (
              <>
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button asChild>
                  <a href="/recover">Nieuwe herstelmail aanvragen</a>
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>Bezig met inloggen...</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
