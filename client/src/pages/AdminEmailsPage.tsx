import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api, EmailType } from '../api/client'
import type { EmailLogSummaryResponse, AdminUser } from '../api/client'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'
import { AlertCircle, ChevronLeft, ChevronRight, Mail, RefreshCw, Send } from 'lucide-react'

const EMAIL_TYPE_LABELS: Record<string, string> = {
  [EmailType.PasswordReset]: 'Wachtwoord reset',
  [EmailType.RankingReminder]: 'Rangschikking herinnering',
}

function formatSentAt(iso: string) {
  return new Date(iso).toLocaleString('nl-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminEmailsPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  // — Email log list —
  const [logs, setLogs] = useState<EmailLogSummaryResponse[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')

  // — Expanded row / HTML preview —
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [htmlPreview, setHtmlPreview] = useState<Record<string, string>>({})

  // — Retry state —
  const [retrying, setRetrying] = useState<Record<string, boolean>>({})
  const [retrySuccess, setRetrySuccess] = useState<Record<string, boolean>>({})

  // — Manual send section —
  const [users, setUsers] = useState<AdminUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<
    { ok: true; sentTo: string } | { ok: false; error: string } | null
  >(null)

  useEffect(() => {
    if (!loading && (!user || !user.roles.includes('admin'))) {
      navigate('/')
    }
  }, [loading, user, navigate])

  const loadLogs = useCallback(async (p: number) => {
    setLogsLoading(true)
    setLogsError('')
    try {
      const res = await api.listEmailLogs(p, pageSize)
      setLogs(res.items)
      setTotal(Number(res.total))
      setPage(Number(res.page))
    } catch {
      setLogsError('Kon e-maillogboek niet laden.')
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user?.roles.includes('admin')) return
    void loadLogs(1)
    api
      .listUsers()
      .then(setUsers)
      .catch(() => {})
  }, [user, loadLogs])

  const toggleRow = useCallback(
    async (id: string) => {
      if (expandedId === id) {
        setExpandedId(null)
        return
      }
      setExpandedId(id)
      if (htmlPreview[id]) return
      try {
        const detail = await api.getEmailLog(id)
        setHtmlPreview((prev) => ({ ...prev, [id]: detail.htmlBody }))
      } catch {
        setHtmlPreview((prev) => ({ ...prev, [id]: '<p>Kon HTML-inhoud niet laden.</p>' }))
      }
    },
    [expandedId, htmlPreview],
  )

  const handleRetry = useCallback(
    async (id: string) => {
      setRetrying((prev) => ({ ...prev, [id]: true }))
      try {
        await api.retryEmailLog(id)
        setRetrySuccess((prev) => ({ ...prev, [id]: true }))
        void loadLogs(page)
      } catch {
        // keep button enabled so user can try again
      } finally {
        setRetrying((prev) => ({ ...prev, [id]: false }))
      }
    },
    [loadLogs, page],
  )

  const handleSendReminder = useCallback(async () => {
    if (!selectedUserId || sending) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await api.sendReminderEmail(selectedUserId)
      setSendResult({ ok: true, sentTo: res.sentTo })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onbekende fout'
      setSendResult({ ok: false, error: message })
    } finally {
      setSending(false)
    }
  }, [selectedUserId, sending])

  if (loading) return null
  if (!user || !user.roles.includes('admin')) return null

  const totalPages = Math.ceil(total / pageSize)

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8 flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Terug
        </button>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Mail className="size-5" />
          E-mail dashboard
        </h1>
      </div>

      {/* ── Manual test send ─────────────────────────────────────────── */}
      <section className="rounded-lg border border-border p-4 flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Test e-mail versturen
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedUserId}
            onChange={(e) => {
              setSelectedUserId(e.target.value)
              setSendResult(null)
            }}
            className="flex-1 min-w-48 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            data-testid="user-select"
          >
            <option value="">— Kies een speler —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName} ({u.email})
              </option>
            ))}
          </select>
          <Button
            onClick={handleSendReminder}
            disabled={!selectedUserId || sending}
            className="flex items-center gap-2"
            data-testid="send-reminder-btn"
          >
            <Send className="size-3.5" />
            {sending ? 'Versturen...' : 'Verstuur herinnering'}
          </Button>
        </div>
        {sendResult && sendResult.ok && (
          <p className="text-sm text-green-500" data-testid="send-success">
            E-mail verstuurd naar {sendResult.sentTo}.
          </p>
        )}
        {sendResult && !sendResult.ok && (
          <Alert variant="destructive" data-testid="send-error">
            <AlertCircle className="size-4" />
            <AlertDescription>{sendResult.error}</AlertDescription>
          </Alert>
        )}
      </section>

      {/* ── Email log table ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Verzonden e-mails ({total})
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadLogs(page)}
            disabled={logsLoading}
            data-testid="refresh-btn"
          >
            <RefreshCw className={`size-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {logsError && (
          <Alert variant="destructive" data-testid="logs-error">
            <AlertCircle className="size-4" />
            <AlertDescription>{logsError}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Tijdstip</th>
                <th className="px-3 py-2 text-left font-medium">Ontvanger</th>
                <th className="px-3 py-2 text-left font-medium">Onderwerp</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {logsLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground text-sm">
                    Laden...
                  </td>
                </tr>
              )}
              {!logsLoading && logs.length === 0 && !logsError && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground text-sm">
                    Geen e-mails gevonden.
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <>
                  <tr
                    key={log.id}
                    onClick={() => toggleRow(log.id)}
                    className="border-t border-border hover:bg-muted/20 cursor-pointer"
                    data-testid="email-row"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground text-xs">
                      {formatSentAt(log.sentAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{log.toName}</div>
                      <div className="text-xs text-muted-foreground">{log.toEmail}</div>
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate">{log.subject}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Badge variant="secondary" className="text-xs">
                        {EMAIL_TYPE_LABELS[log.type] ?? log.type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {log.success ? (
                        <Badge
                          variant="default"
                          className="text-xs bg-green-600 hover:bg-green-600"
                          data-testid="status-success"
                        >
                          Verstuurd
                        </Badge>
                      ) : (
                        <Badge
                          variant="destructive"
                          className="text-xs"
                          data-testid="status-failed"
                        >
                          Mislukt
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      {!log.success && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={retrying[log.id]}
                          onClick={() => handleRetry(log.id)}
                          data-testid="retry-btn"
                        >
                          {retrySuccess[log.id]
                            ? 'Verstuurd!'
                            : retrying[log.id]
                              ? 'Bezig...'
                              : 'Opnieuw'}
                        </Button>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr key={`${log.id}-preview`} className="border-t border-border bg-muted/10">
                      <td colSpan={6} className="px-3 py-3">
                        {log.errorMessage && (
                          <p className="mb-2 text-xs text-red-400">Fout: {log.errorMessage}</p>
                        )}
                        <iframe
                          srcDoc={htmlPreview[log.id] ?? 'Laden...'}
                          title={`Preview: ${log.subject}`}
                          className="w-full rounded border border-border bg-white"
                          style={{ height: '400px' }}
                          sandbox="allow-same-origin"
                          data-testid="html-preview"
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Pagina {page} van {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1 || logsLoading}
                onClick={() => loadLogs(page - 1)}
                data-testid="prev-page"
              >
                <ChevronLeft className="size-4" />
                Vorige
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages || logsLoading}
                onClick={() => loadLogs(page + 1)}
                data-testid="next-page"
              >
                Volgende
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
