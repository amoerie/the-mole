import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Game, GameMessage } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { AlertCircle, ArrowLeft, Send } from 'lucide-react'

const PAGE_SIZE = 20

function formatTime(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleString('nl-BE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function MessageBoardPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { user } = useAuth()

  const [game, setGame] = useState<Game | null>(null)
  const [messages, setMessages] = useState<GameMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gameId) return
    Promise.all([api.getGame(gameId), api.getMessages(gameId, 0)])
      .then(([gameData, page]) => {
        setGame(gameData)
        setMessages(page.items)
        setHasMore(page.hasMore)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Fout bij laden'))
      .finally(() => setLoading(false))
  }, [gameId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMore() {
    if (!gameId) return
    setLoadingMore(true)
    try {
      const page = await api.getMessages(gameId, messages.length)
      setMessages((prev) => [...prev, ...page.items])
      setHasMore(page.hasMore)
    } catch {
      // silently ignore — user can retry
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!gameId || !content.trim()) return
    setSubmitError('')
    setSubmitting(true)
    try {
      const newMessage = await api.postMessage(gameId, content.trim())
      setMessages((prev) => [...prev, newMessage])
      setContent('')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Fout bij verzenden')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>Spel niet gevonden</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/game/${game.id}`}>
            <ArrowLeft className="size-4" />
            Terug
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Berichten</h1>
        <p className="text-sm text-muted-foreground">{game.name}</p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col gap-3 min-h-48 max-h-[28rem] overflow-y-auto">
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Laden...' : `Laad oudere berichten`}
              </Button>
            </div>
          )}

          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center my-auto">
              Nog geen berichten. Wees de eerste!
            </p>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.userId === user?.userId
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                    }`}
                  >
                    {!isOwn && <p className="text-xs font-semibold mb-0.5">{msg.displayName}</p>}
                    <p>{msg.content}</p>
                  </div>
                  <p className="text-xs text-muted-foreground px-1">{formatTime(msg.postedAt)}</p>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {submitError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Schrijf een bericht..."
            maxLength={PAGE_SIZE * 25}
            rows={2}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Bericht"
          />
          <Button
            type="submit"
            disabled={submitting || !content.trim()}
            size="icon"
            aria-label="Verzenden"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-right">{content.length}/500</p>
      </form>
    </main>
  )
}
