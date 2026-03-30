import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'
import type { GameMessage } from '../types'
import { useAuth } from '../hooks/useAuth'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Alert, AlertDescription } from './ui/alert'
import { Badge } from './ui/badge'
import { AlertCircle, MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react'

const MAX_MESSAGE_LENGTH = 500

function formatTime(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleString('nl-BE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Props {
  gameId: string
}

export default function MessageBoard({ gameId }: Props) {
  const { user } = useAuth()

  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [messages, setMessages] = useState<GameMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Fetch unread count on mount; auto-expand if there are unread messages
  useEffect(() => {
    api
      .getUnreadMessageCount(gameId)
      .then((count) => {
        setUnreadCount(count)
        if (count > 0) setOpen(true)
      })
      .catch(() => {})
  }, [gameId])

  // Load messages and mark read when opened
  useEffect(() => {
    if (!open) return
    if (!loaded) {
      api
        .getMessages(gameId, 0)
        .then((page) => {
          setMessages([...page.items].reverse())
          setHasMore(page.hasMore)
          setLoaded(true)
        })
        .catch(() => {})
    }
    api
      .markMessagesRead(gameId)
      .then(() => setUnreadCount(0))
      .catch(() => {})
  }, [open, loaded, gameId])

  // Scroll to bottom within the messages container when new messages arrive
  useEffect(() => {
    if (open) {
      const el = messagesContainerRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [messages, open])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const page = await api.getMessages(gameId, messages.length)
      setMessages((prev) => [...[...page.items].reverse(), ...prev])
      setHasMore(page.hasMore)
    } catch {
      // silently ignore — user can retry
    } finally {
      setLoadingMore(false)
    }
  }

  async function submitMessage() {
    if (!content.trim()) return
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitMessage()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitMessage()
    }
  }

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none pb-6"
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-5" />
            <CardTitle>Berichten</CardTitle>
            {unreadCount > 0 && (
              <Badge
                variant="default"
                className="text-xs px-1.5 py-0"
                aria-label={`${unreadCount} ongelezen`}
              >
                {unreadCount}
              </Badge>
            )}
          </div>
          {open ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {open && (
        <CardContent className="flex flex-col gap-3 pt-0">
          <div
            ref={messagesContainerRef}
            className="flex flex-col gap-3 min-h-32 max-h-72 overflow-y-auto pr-1"
          >
            {hasMore && (
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Laden...' : 'Laad oudere berichten'}
                </Button>
              </div>
            )}

            {loaded && messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center my-auto">
                Nog geen berichten. Wees de eerste!
              </p>
            )}

            {messages.map((msg) => {
              const isOwn = msg.userId === user?.userId
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm break-words ${
                      isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                    }`}
                  >
                    {!isOwn && <p className="text-xs font-semibold mb-0.5">{msg.displayName}</p>}
                    <p>{msg.content}</p>
                  </div>
                  <p className="text-xs text-muted-foreground px-1">{formatTime(msg.postedAt)}</p>
                </div>
              )
            })}
          </div>

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
                onKeyDown={handleKeyDown}
                placeholder="Schrijf een bericht..."
                maxLength={MAX_MESSAGE_LENGTH}
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
            <p className="text-xs text-muted-foreground text-right">
              {content.length}/{MAX_MESSAGE_LENGTH}
            </p>
          </form>
        </CardContent>
      )}
    </Card>
  )
}
