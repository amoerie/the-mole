import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Badge } from '../components/ui/badge'
import { ChevronLeft, Terminal } from 'lucide-react'

type LogLevel = 'Critical' | 'Error' | 'Warning' | 'Information' | 'Debug' | 'Trace'

interface LogEntry {
  level: LogLevel
  category: string
  message: string
  timestamp: string
}

const MAX_LOG_ENTRIES = 500

const LOG_LEVEL_CLASSES: Record<string, string> = {
  Critical: 'text-red-400 font-bold',
  Error: 'text-red-400',
  Warning: 'text-amber-400',
  Information: 'text-slate-200',
  Debug: 'text-slate-500',
  Trace: 'text-slate-600',
}

type ConnectionStatus = 'connecting' | 'connected' | 'error'

export default function AdminLogsPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [entries, setEntries] = useState<LogEntry[]>([])
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [autoScroll, setAutoScroll] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && (!user || !user.roles.includes('admin'))) {
      navigate('/')
    }
  }, [loading, user, navigate])

  // Scroll to bottom whenever new entries arrive, but only if autoScroll is on.
  // A programmatic scroll to the bottom leaves scrollHeight - scrollTop - clientHeight ≈ 0,
  // so the scroll handler (which only turns auto-scroll OFF when NOT near bottom) is a no-op.
  useEffect(() => {
    if (!autoScroll || !containerRef.current) return
    containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [entries, autoScroll])

  // When the user manually scrolls away from the bottom, turn off auto-scroll.
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (!nearBottom) setAutoScroll(false)
  }, [])

  // Re-enable auto-scroll: flip the switch and immediately jump to bottom.
  const enableAutoScroll = useCallback(() => {
    setAutoScroll(true)
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    if (!user || !user.roles.includes('admin')) return

    const es = new EventSource('/api/admin/diagnostics/logs/stream', { withCredentials: true })

    es.onopen = () => setStatus('connected')

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const entry = JSON.parse(event.data) as LogEntry
        setEntries((prev) => {
          const next = [...prev, entry]
          return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next
        })
      } catch {
        // malformed SSE payload — skip
      }
    }

    es.onerror = () => setStatus('error')

    return () => {
      es.close()
    }
  }, [user])

  if (loading) return null
  if (!user || !user.roles.includes('admin')) return null

  const statusVariant =
    status === 'connected' ? 'default' : status === 'connecting' ? 'secondary' : 'destructive'
  const statusLabel =
    status === 'connected' ? 'Verbonden' : status === 'connecting' ? 'Verbinden...' : 'Fout'

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Terug
        </button>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Terminal className="size-5" />
          Live Logs
        </h1>
        <Badge variant={statusVariant} data-testid="log-status">
          {statusLabel}
        </Badge>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        data-testid="log-feed"
        className="h-[calc(100vh-12rem)] overflow-y-auto rounded-md border border-border bg-black p-3 font-mono text-xs"
      >
        {entries.length === 0 ? (
          <p className="text-muted-foreground italic">Wachten op log entries...</p>
        ) : (
          entries.map((entry, i) => {
            const levelClass = LOG_LEVEL_CLASSES[entry.level] ?? 'text-slate-300'
            const time = new Date(entry.timestamp).toLocaleTimeString('nl-BE', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
            return (
              <div key={i} className="flex gap-2 leading-relaxed" data-testid="log-entry">
                <span className="shrink-0 text-slate-600">{time}</span>
                <span className={`shrink-0 w-20 ${levelClass}`}>{entry.level}</span>
                <span className="shrink-0 truncate max-w-48 text-slate-500">{entry.category}</span>
                <span className={levelClass}>{entry.message}</span>
              </div>
            )
          })
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {entries.length} / {MAX_LOG_ENTRIES} entries in geheugen
        </p>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => (e.target.checked ? enableAutoScroll() : setAutoScroll(false))}
            className="size-3.5 accent-primary"
            data-testid="auto-scroll-checkbox"
          />
          <span className="text-xs text-muted-foreground">Volg laatste log</span>
        </label>
      </div>
    </main>
  )
}
