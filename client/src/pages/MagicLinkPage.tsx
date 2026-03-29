import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2 } from 'lucide-react'

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
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Toegang herstellen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <>
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button asChild>
                <a href="/recover">Nieuwe herstelmail aanvragen</a>
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="animate-spin" />
              <span>Bezig met inloggen...</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
