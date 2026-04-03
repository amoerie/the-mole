import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminQueryPage from '../pages/AdminQueryPage'

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

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockNavigate = vi.fn()
const mockFetch = vi.fn()

import { useAuth } from '../hooks/useAuth'

const adminUser = { userId: 'a1', displayName: 'Admin', roles: ['authenticated', 'admin'] }
const regularUser = { userId: 'u1', displayName: 'User', roles: ['authenticated'] }

/** Default fetch mock: first call = table list, subsequent = query results */
function mockTablesAndQuery(tables: string[], queryResult = { columns: ['id'], rows: [['1']] }) {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ columns: ['name'], rows: tables.map((t) => [t]) }),
    })
    .mockResolvedValue({
      ok: true,
      json: async () => queryResult,
    })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminQueryPage />
    </MemoryRouter>,
  )
}

describe('AdminQueryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      loading: false,
      error: null,
      setUser: vi.fn(),
    })
    global.fetch = mockFetch
    // Default: empty table list, silent
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['name'], rows: [] }) })
  })

  // ── Auth guard ─────────────────────────────────────────────────────────────

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

  // ── Page structure ─────────────────────────────────────────────────────────

  it('shows page heading and SQL editor', () => {
    renderPage()
    expect(screen.getByText('SQL Query Runner')).toBeInTheDocument()
    expect(screen.getByTestId('sql-editor')).toBeInTheDocument()
  })

  it('shows the default query in the editor', () => {
    renderPage()
    const editor = screen.getByTestId('sql-editor') as HTMLTextAreaElement
    expect(editor.value).toContain('SELECT')
  })

  // ── Table browser ──────────────────────────────────────────────────────────

  it('shows the table browser panel', () => {
    renderPage()
    expect(screen.getByTestId('table-browser')).toBeInTheDocument()
  })

  it('shows skeleton while tables are loading', () => {
    // Never resolves — keeps loading state
    mockFetch.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders table names after loading', async () => {
    mockTablesAndQuery(['AppUsers', 'Games', 'Players'])
    renderPage()
    await waitFor(() => expect(screen.getAllByTestId('table-item').length).toBe(3))
    expect(screen.getByText('AppUsers')).toBeInTheDocument()
    expect(screen.getByText('Games')).toBeInTheDocument()
    expect(screen.getByText('Players')).toBeInTheDocument()
  })

  it('shows empty message when no tables found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ columns: ['name'], rows: [] }),
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('No tables found')).toBeInTheDocument())
  })

  it('double-clicking a table prefills the editor with SELECT query', async () => {
    mockTablesAndQuery(['AppUsers'])
    renderPage()
    const item = await screen.findByTestId('table-item')
    fireEvent.doubleClick(item)
    const editor = screen.getByTestId('sql-editor') as HTMLTextAreaElement
    expect(editor.value).toBe('SELECT * FROM AppUsers LIMIT 1000')
  })

  it('still shows other tables after prefilling', async () => {
    mockTablesAndQuery(['AppUsers', 'Games'])
    renderPage()
    await screen.findAllByTestId('table-item')
    fireEvent.doubleClick(screen.getAllByTestId('table-item')[1])
    const editor = screen.getByTestId('sql-editor') as HTMLTextAreaElement
    expect(editor.value).toBe('SELECT * FROM Games LIMIT 1000')
    // Both table items are still visible
    expect(screen.getAllByTestId('table-item').length).toBe(2)
  })

  // ── Query execution ────────────────────────────────────────────────────────

  it('executes query and shows results table', async () => {
    mockTablesAndQuery([], { columns: ['id', 'email'], rows: [['usr-1', 'alice@example.com']] })
    renderPage()
    await waitFor(() => expect(screen.queryByText('No tables found')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /uitvoeren/i }))
    await waitFor(() => expect(screen.getByTestId('query-results')).toBeInTheDocument())
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('1 row returned')).toBeInTheDocument()
  })

  it('shows "N rows returned" for multiple rows', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ columns: ['name'], rows: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ columns: ['id'], rows: [['a'], ['b'], ['c']] }),
      })
    renderPage()
    await waitFor(() => screen.getByText('No tables found'))
    fireEvent.click(screen.getByRole('button', { name: /uitvoeren/i }))
    await waitFor(() => screen.getByTestId('query-results'))
    expect(screen.getByText('3 rows returned')).toBeInTheDocument()
  })

  it('shows empty state when query returns zero rows', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ columns: ['name'], rows: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ columns: ['id'], rows: [] }) })
    renderPage()
    await waitFor(() => screen.getByText('No tables found'))
    fireEvent.click(screen.getByRole('button', { name: /uitvoeren/i }))
    await waitFor(() => screen.getByTestId('query-results'))
    expect(screen.getByText(/geen rijen gevonden/i)).toBeInTheDocument()
  })

  it('renders null cells as italic "null"', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ columns: ['name'], rows: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ columns: ['val'], rows: [[null]] }) })
    renderPage()
    await waitFor(() => screen.getByText('No tables found'))
    fireEvent.click(screen.getByRole('button', { name: /uitvoeren/i }))
    await waitFor(() => screen.getByTestId('query-results'))
    expect(screen.getByText('null').tagName).toBe('EM')
  })

  it('shows error banner when query fails with server error', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ columns: ['name'], rows: [] }) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Only SELECT queries are allowed.' }),
      })
    renderPage()
    await waitFor(() => screen.getByText('No tables found'))
    fireEvent.click(screen.getByRole('button', { name: /uitvoeren/i }))
    await waitFor(() => expect(screen.getByTestId('query-error')).toBeInTheDocument())
    expect(screen.getByText('Only SELECT queries are allowed.')).toBeInTheDocument()
  })

  it('shows error banner on network failure', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ columns: ['name'], rows: [] }) })
      .mockRejectedValueOnce(new Error('Network error'))
    renderPage()
    await waitFor(() => screen.getByText('No tables found'))
    fireEvent.click(screen.getByRole('button', { name: /uitvoeren/i }))
    await waitFor(() => expect(screen.getByTestId('query-error')).toBeInTheDocument())
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })
})
