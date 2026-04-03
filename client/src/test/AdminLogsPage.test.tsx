import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminLogsPage from '../pages/AdminLogsPage'

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockNavigate = vi.fn()

import { useAuth } from '../hooks/useAuth'

const adminUser = { userId: 'a1', displayName: 'Admin', roles: ['authenticated', 'admin'] }
const regularUser = { userId: 'u1', displayName: 'User', roles: ['authenticated'] }

class MockEventSource {
  static instance: MockEventSource | null = null
  url: string
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    MockEventSource.instance = this
  }

  close() {
    this.closed = true
  }

  dispatchMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminLogsPage />
    </MemoryRouter>,
  )
}

describe('AdminLogsPage', () => {
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
  })

  afterEach(() => {
    MockEventSource.instance?.close()
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

  it('shows page heading', () => {
    renderPage()
    expect(screen.getByText('Live Logs')).toBeInTheDocument()
  })

  it('opens an EventSource to the log stream endpoint on mount', () => {
    renderPage()
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
    expect(screen.getByText('Something broke').className).toContain('text-red-400')
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
