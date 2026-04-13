import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { Separator } from '../components/ui/separator'
import { Skeleton } from '../components/ui/skeleton'
import { Badge } from '../components/ui/badge'
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft, Gamepad2 } from 'lucide-react'
import { useQuery } from '../hooks/useQuery'
import type { Game } from '../types'

interface Preferences {
  reminderEmailsEnabled: boolean
}

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameSuccess, setNameSuccess] = useState(false)

  const [prefsLoading, setPrefsLoading] = useState(false)
  const [prefsSaveError, setPrefsSaveError] = useState('')
  const {
    data: preferences,
    loading: prefsInitLoading,
    error: prefsLoadError,
  } = useQuery<Preferences>(user ? () => api.getPreferences() : null)
  const [reminderEnabled, setReminderEnabled] = useState<boolean | null>(null)

  const {
    data: games,
    loading: gamesLoading,
    error: gamesError,
  } = useQuery<Game[]>(() => api.getMyGames())

  if (!user) {
    navigate('/login')
    return null
  }

  // Keep local toggle state in sync with the fetched preferences
  const currentReminderEnabled = reminderEnabled ?? preferences?.reminderEmailsEnabled ?? true

  async function handleToggleReminder(enabled: boolean) {
    setReminderEnabled(enabled)
    setPrefsSaveError('')
    setPrefsLoading(true)
    try {
      const updated = await api.updatePreferences(enabled)
      setReminderEnabled(updated.reminderEmailsEnabled)
    } catch {
      setReminderEnabled(!enabled) // rollback
      setPrefsSaveError('Opslaan mislukt. Probeer het opnieuw.')
    } finally {
      setPrefsLoading(false)
    }
  }

  async function handleSaveName() {
    if (!displayName.trim()) {
      setNameError('Naam is verplicht.')
      return
    }
    setNameLoading(true)
    setNameError('')
    setNameSuccess(false)
    try {
      const updated = await api.updateProfile(displayName.trim())
      setUser(updated)
      setDisplayName(updated.displayName)
      setNameSuccess(true)
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Opslaan mislukt.')
    } finally {
      setNameLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="size-4" />
            Terug
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Mijn profiel</h1>
      </div>

      <div className="flex flex-col gap-6">
        {/* Display name */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Weergavenaam</CardTitle>
            <CardDescription>
              Zichtbaar voor andere spelers in rangschikkingen en scoreborden.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            {nameError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{nameError}</AlertDescription>
              </Alert>
            )}
            {nameSuccess && (
              <Alert>
                <CheckCircle2 className="size-4" />
                <AlertDescription>Naam opgeslagen.</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="displayName">Naam</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  setNameSuccess(false)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                placeholder="Jouw naam"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSaveName} disabled={nameLoading}>
              {nameLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Bezig...
                </>
              ) : (
                'Opslaan'
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Email preferences */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>E-mailmeldingen</CardTitle>
            <CardDescription>
              Ontvang elke zondagochtend een overzicht van je huidige rangschikking, zodat je deze
              nog kunt aanpassen vóór de deadline.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {prefsSaveError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="size-4" />
                <AlertDescription>{prefsSaveError}</AlertDescription>
              </Alert>
            )}
            {prefsLoadError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  Kon voorkeuren niet laden. Probeer de pagina te vernieuwen.
                </AlertDescription>
              </Alert>
            ) : prefsInitLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={currentReminderEnabled}
                  disabled={prefsLoading}
                  onChange={(e) => handleToggleReminder(e.target.checked)}
                  className="size-4 accent-primary"
                />
                <span className="text-sm">Zondagse herinneringsmail inschakelen</span>
                {prefsLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </label>
            )}
          </CardContent>
        </Card>

        {/* Games */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Mijn spellen</CardTitle>
            <CardDescription>De spellen waaraan je deelneemt.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {gamesLoading && (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}
            {gamesError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>Kon spellen niet laden.</AlertDescription>
              </Alert>
            )}
            {!gamesLoading && !gamesError && games?.length === 0 && (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Gamepad2 className="size-4" />
                Je doet nog niet mee aan een spel.
              </div>
            )}
            {!gamesLoading && games && games.length > 0 && (
              <div className="flex flex-col gap-2">
                {games.map((game, i) => (
                  <>
                    {i > 0 && <Separator key={`sep-${game.id}`} />}
                    <Link
                      key={game.id}
                      to={`/game/${game.id}`}
                      className="flex items-center justify-between rounded-md px-1 py-2 hover:bg-muted/50"
                    >
                      <span className="font-medium">{game.name}</span>
                      <Badge variant="secondary">{game.contestants.length} kandidaten</Badge>
                    </Link>
                  </>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
