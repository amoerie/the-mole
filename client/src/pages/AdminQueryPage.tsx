import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'
import { AlertCircle, ChevronLeft, Play } from 'lucide-react'

interface QueryResult {
  columns: string[]
  rows: (string | null)[][]
}

export default function AdminQueryPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [queryText, setQueryText] = useState('SELECT * FROM AppUsers LIMIT 20')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [queryError, setQueryError] = useState('')
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!loading && (!user || !user.roles.includes('admin'))) {
      navigate('/')
    }
  }, [loading, user, navigate])

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

  if (loading) return null
  if (!user || !user.roles.includes('admin')) return null

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
        <h1 className="text-2xl font-bold tracking-tight">SQL Query Runner</h1>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <CodeMirror
          value={queryText}
          height="200px"
          theme="dark"
          extensions={[sql()]}
          onChange={setQueryText}
          basicSetup={{ lineNumbers: true, foldGutter: false }}
          data-testid="sql-editor"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={executeQuery} disabled={running} className="flex items-center gap-2">
          <Play className="size-3.5" />
          {running ? 'Uitvoeren...' : 'Uitvoeren'}
        </Button>
        <span className="text-xs text-muted-foreground">Ctrl+Enter to run</span>
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
    </main>
  )
}
