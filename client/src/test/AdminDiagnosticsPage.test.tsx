import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminDiagnosticsPage from '../pages/AdminDiagnosticsPage'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
    'data-testid': testid,
  }: {
    value: string
    onChange: (v: string) => void
    'data-testid'?: string
  }) => (
    <textarea
      data-testid={testid ?? 'sql-editor'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

vi.mock('@codemirror/lang-sql', () => ({ sql: () => [] }))

vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockNavigate = vi.fn()

import { useAuth } from '../hooks/useAuth'

const adminUser = {
  userId: 'admin-1',
  displayName: 'Admin',
  roles: ['authenticated', 'admin'],
}

const regularUser = {
  userId: 'user-1',
  displayName: 'User',
  roles: ['authenticated'],
}

// ─── EventSource mock ────────────────────────────────────────────────────────

type EventSourceListener = (event: MessageEvent) => void

class MockEventSource {
  static instance: MockEventSource | null = null
  url: string
  onopen: (() => void) | null = null
  onmessage: EventSourceListener | null = null
  onerror: (() => void) | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    MockEventSource.instance = this
  }

  close() {
    this.closed = true
  }

  // Test helper: simulate receiving a message
  dispatchMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }
}

// ─── fetch mock ──────────────────────────────────────────────────────────────

const mockFetch = vi.fn()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminDiagnosticsPage />
    </MemoryRouter>,
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AdminDiagnosticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockEventSource.instance = null
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      loading: false,
      error: null,
      setUser: vi.fn(),
    })
    global.EventSource = MockEventSource as unknown as typeof EventSource
    global.fetch = mockFetch
  })

  afterEach(() => {
    MockEventSource.instance?.close()
  })

  // ── Auth guard ────────────────────────────────────────────────────────────

  it('redirects to / when user is not admin', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: regularUser,
      loading: false,
      error: null,
      setUser: vi.fn(),
    })
    renderPage()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('redirects to / when user is null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      error: null,
      setUser: vi.fn(),
    })
    renderPage()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('renders nothing while loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: true,
      error: null,
      setUser: vi.fn(),
    })
    const { container } = renderPage()
    expect(container.firstChild).toBeNull()
  })

  // ── Page structure ────────────────────────────────────────────────────────

  it('shows page heading and both panels for admin', () => {
    renderPage()
    expect(screen.getByText('Diagnostics')).toBeInTheDocument()
    expect(screen.getByText('SQL Query Runner')).toBeInTheDocument()
    expect(screen.getByText('Live Logs')).toBeInTheDocument()
  })

  // ── SQL panel ─────────────────────────────────────────────────────────────

  it('shows the default query in the editor', () => {
    renderPage()
    const editor = screen.getByTestId('sql-editor') as HTMLTextAreaElement
    expect(editor.value).toContain('SELECT')
  })

  it('executes query on button click and shows results table', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        columns: ['id', 'email'],
        rows: [['usr-1', 'alice@example.com']],
      }),
    })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /uitvoeren/i }))

    await waitFor(() => expect(screen.getByTestId('query-results')).toBeInTheDocument())

    expect(screen.getByText('id')).toBeInTheDocument()
    expect(screen.getByText('email')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('1 row returned')).toBeInTheDocument()
  })

  it('shows "N rows returned" for multiple rows', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        columns: ['id'],
        rows: [['a'], ['b'], ['c']],
      }),
    })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /uitvoeren/i }))
    await waitFor(() => screen.getByTestId('query-results'))

    expect(screen.getByText('3 rows returned')).toBeInTheDocument()
  })

  it('shows empty state when query returns zero rows', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ columns: ['id'], rows: [] }),
    })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /uitvoeren/i }))
    await waitFor(() => screen.getByTestId('query-results'))

    expect(screen.getByText(/geen rijen gevonden/i)).toBeInTheDocument()
  })

  it('renders null cells as italic "null"', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        columns: ['val'],
        rows: [[null]],
      }),
    })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /uitvoeren/i }))
    await waitFor(() => screen.getByTestId('query-results'))

    expect(screen.getByText('null').tagName).toBe('EM')
  })

  it('shows error banner when query fails with server error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Only SELECT queries are allowed.' }),
    })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /uitvoeren/i }))

    await waitFor(() => expect(screen.getByTestId('query-error')).toBeInTheDocument())
    expect(screen.getByText('Only SELECT queries are allowed.')).toBeInTheDocument()
  })

  it('shows error banner on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /uitvoeren/i }))

    await waitFor(() => expect(screen.getByTestId('query-error')).toBeInTheDocument())
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  // ── Log panel ─────────────────────────────────────────────────────────────

  it('opens an EventSource to the log stream endpoint on mount', () => {
    renderPage()
    expect(MockEventSource.instance).not.toBeNull()
    expect(MockEventSource.instance?.url).toBe('/api/admin/diagnostics/logs/stream')
  })

  it('shows "connecting" status initially', () => {
    renderPage()
    expect(screen.getByTestId('log-status')).toHaveTextContent('Verbinden...')
  })

  it('shows "connected" status after EventSource opens', async () => {
    renderPage()
    act(() => {
      MockEventSource.instance?.onopen?.()
    })
    await waitFor(() => expect(screen.getByTestId('log-status')).toHaveTextContent('Verbonden'))
  })

  it('shows "error" status when EventSource errors', async () => {
    renderPage()
    act(() => {
      MockEventSource.instance?.onerror?.()
    })
    await waitFor(() => expect(screen.getByTestId('log-status')).toHaveTextContent('Fout'))
  })

  it('shows empty state message before any log entries arrive', () => {
    renderPage()
    expect(screen.getByText(/wachten op log entries/i)).toBeInTheDocument()
  })

  it('renders a log entry when an SSE message arrives', async () => {
    renderPage()
    act(() => {
      MockEventSource.instance?.dispatchMessage({
        level: 'Information',
        category: 'Api.Routes.GameRoutes',
        message: 'Game created',
        timestamp: new Date().toISOString(),
      })
    })
    await waitFor(() => expect(screen.getAllByTestId('log-entry').length).toBeGreaterThan(0))
    expect(screen.getByText('Game created')).toBeInTheDocument()
  })

  it('applies red class to Error level entries', async () => {
    renderPage()
    act(() => {
      MockEventSource.instance?.dispatchMessage({
        level: 'Error',
        category: 'Test',
        message: 'Something broke',
        timestamp: new Date().toISOString(),
      })
    })
    await waitFor(() => screen.getByText('Something broke'))
    const msgEl = screen.getByText('Something broke')
    expect(msgEl.className).toContain('text-red-400')
  })

  it('applies amber class to Warning level entries', async () => {
    renderPage()
    act(() => {
      MockEventSource.instance?.dispatchMessage({
        level: 'Warning',
        category: 'Test',
        message: 'Watch out',
        timestamp: new Date().toISOString(),
      })
    })
    await waitFor(() => screen.getByText('Watch out'))
    expect(screen.getByText('Watch out').className).toContain('text-amber-400')
  })

  it('shows entry count in the footer', async () => {
    renderPage()
    act(() => {
      MockEventSource.instance?.dispatchMessage({
        level: 'Information',
        category: 'Test',
        message: 'msg1',
        timestamp: new Date().toISOString(),
      })
    })
    await waitFor(() => screen.getByText(/1 \/ 500 entries/i))
  })

  it('closes the EventSource on unmount', () => {
    const { unmount } = renderPage()
    const instance = MockEventSource.instance!
    unmount()
    expect(instance.closed).toBe(true)
  })
})
