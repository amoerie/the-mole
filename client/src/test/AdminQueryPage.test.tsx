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
  })

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
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true, error: null, setUser: vi.fn() })
    const { container } = renderPage()
    expect(container.firstChild).toBeNull()
  })

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

  it('executes query and shows results table', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ columns: ['id', 'email'], rows: [['usr-1', 'alice@example.com']] }),
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /uitvoeren/i }))
    await waitFor(() => expect(screen.getByTestId('query-results')).toBeInTheDocument())
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('1 row returned')).toBeInTheDocument()
  })

  it('shows "N rows returned" for multiple rows', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ columns: ['id'], rows: [['a'], ['b'], ['c']] }),
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
      json: async () => ({ columns: ['val'], rows: [[null]] }),
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
})
