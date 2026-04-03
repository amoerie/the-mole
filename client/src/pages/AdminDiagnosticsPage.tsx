import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { AlertCircle, ChevronLeft, Play, Terminal } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueryResult {
  columns: string[]
  rows: (string | null)[][]
}

type LogLevel = 'Critical' | 'Error' | 'Warning' | 'Information' | 'Debug' | 'Trace'

interface LogEntry {
  level: LogLevel
  category: string
  message: string
  timestamp: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_LOG_ENTRIES = 500

const LOG_LEVEL_CLASSES: Record<string, string> = {
  Critical: 'text-red-400 font-bold',
  Error: 'text-red-400',
  Warning: 'text-amber-400',
  Information: 'text-slate-200',
  Debug: 'text-slate-500',
  Trace: 'text-slate-600',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function QueryPanel() {
  const [queryText, setQueryText] = useState('SELECT * FROM AppUsers LIMIT 20')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [queryError, setQueryError] = useState('')
  const [running, setRunning] = useState(false)

  const executeQuery = useCallback(async () => {
    if (!queryText.trim() || running) return
    setRunning(true)
    setQueryError('')
    setResult(null)
    try {
      const res = await fetch('/api/admin/diagnostics/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: queryText }),
        credentials: 'include',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        setQueryError((body as { error?: string }).error ?? res.statusText)
        return
      }
      const data = (await res.json()) as QueryResult
      setResult(data)
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setRunning(false)
    }
  }, [queryText, running])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        void executeQuery()
      }
    },
    [executeQuery],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">SQL Query Runner</h2>
        <span className="text-xs text-muted-foreground">Ctrl+Enter to run</span>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <CodeMirror
          value={queryText}
          height="160px"
          theme="dark"
          extensions={[sql()]}
          onChange={setQueryText}
          basicSetup={{ lineNumbers: true, foldGutter: false }}
          data-testid="sql-editor"
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={executeQuery} disabled={running} className="flex items-center gap-2">
          <Play className="size-3.5" />
          {running ? 'Uitvoeren...' : 'Uitvoeren'}
        </Button>
      </div>

      {queryError && (
        <Alert variant="destructive" data-testid="query-error">
          <AlertCircle className="size-4" />
          <AlertDescription>{queryError}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div data-testid="query-results">
          {result.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen rijen gevonden. (0 rows returned)</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {result.columns.map((col) => (
                        <th key={col} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, ri) => (
                      <tr key={ri} className="border-t border-border hover:bg-muted/20">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-1.5 align-top whitespace-nowrap">
                            {cell === null ? <em className="text-muted-foreground">null</em> : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {result.rows.length} {result.rows.length === 1 ? 'row' : 'rows'} returned
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}

type ConnectionStatus = 'connecting' | 'connected' | 'error'

function LogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const containerRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)

  // Track whether the user has scrolled away from the bottom.
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }, [])

  // Auto-scroll to bottom only when the user hasn't manually scrolled up.
  useEffect(() => {
    if (atBottomRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [entries])

  useEffect(() => {
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
  }, [])

  const statusVariant =
    status === 'connected' ? 'default' : status === 'connecting' ? 'secondary' : 'destructive'
  const statusLabel =
    status === 'connected' ? 'Verbonden' : status === 'connecting' ? 'Verbinden...' : 'Fout'

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Terminal className="size-4" />
          Live Logs
        </h2>
        <Badge variant={statusVariant} data-testid="log-status">
          {statusLabel}
        </Badge>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        data-testid="log-feed"
        className="h-96 overflow-y-auto rounded-md border border-border bg-black p-3 font-mono text-xs"
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
      <p className="text-xs text-muted-foreground">
        {entries.length} / {MAX_LOG_ENTRIES} entries in geheugen
      </p>
    </section>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminDiagnosticsPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && (!user || !user.roles.includes('admin'))) {
      navigate('/')
    }
  }, [loading, user, navigate])

  if (loading) return null
  if (!user || !user.roles.includes('admin')) return null

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8 flex flex-col gap-10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Terug
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Diagnostics</h1>
      </div>

      <QueryPanel />

      <div className="border-t border-border" />

      <LogPanel />
    </main>
  )
}
