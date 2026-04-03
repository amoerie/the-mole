import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
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
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  static instance: MockEventSource | null = null
  url: string
  readyState: number = MockEventSource.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    MockEventSource.instance = this
  }

  close() {
    this.readyState = MockEventSource.CLOSED
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

function makeEntry(message = 'msg', level = 'Information') {
  return { level, category: 'Test', message, timestamp: new Date().toISOString() }
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
    vi.stubGlobal('EventSource', MockEventSource)
  })

  afterEach(() => {
    MockEventSource.instance?.close()
    vi.unstubAllGlobals()
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

  it('shows page heading', () => {
    renderPage()
    expect(screen.getByText('Live Logs')).toBeInTheDocument()
  })

  // ── Connection ─────────────────────────────────────────────────────────────

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

  it('shows "error" status when EventSource is permanently closed', async () => {
    renderPage()
    act(() => {
      const es = MockEventSource.instance!
      es.readyState = MockEventSource.CLOSED
      es.onerror?.()
    })
    await waitFor(() => expect(screen.getByTestId('log-status')).toHaveTextContent('Fout'))
  })

  it('shows "connecting" status when EventSource errors but is still reconnecting', async () => {
    renderPage()
    act(() => {
      MockEventSource.instance?.onopen?.()
    })
    await waitFor(() => screen.getByTestId('log-status'))
    act(() => {
      const es = MockEventSource.instance!
      es.readyState = MockEventSource.CONNECTING // reconnecting, not closed
      es.onerror?.()
    })
    await waitFor(() => expect(screen.getByTestId('log-status')).toHaveTextContent('Verbinden...'))
  })

  it('closes the EventSource on unmount', () => {
    const { unmount } = renderPage()
    const instance = MockEventSource.instance!
    unmount()
    expect(instance.closed).toBe(true)
  })

  // ── Log entries ────────────────────────────────────────────────────────────

  it('shows empty state message before any log entries arrive', () => {
    renderPage()
    expect(screen.getByText(/wachten op log entries/i)).toBeInTheDocument()
  })

  it('renders a log entry when an SSE message arrives', async () => {
    renderPage()
    act(() => {
      MockEventSource.instance?.dispatchMessage(makeEntry('Game created'))
    })
    await waitFor(() => expect(screen.getAllByTestId('log-entry').length).toBeGreaterThan(0))
    expect(screen.getByText('Game created')).toBeInTheDocument()
  })

  it('applies red class to Error level entries', async () => {
    renderPage()
    act(() => {
      MockEventSource.instance?.dispatchMessage(makeEntry('Something broke', 'Error'))
    })
    await waitFor(() => screen.getByText('Something broke'))
    expect(screen.getByText('Something broke').className).toContain('text-red-400')
  })

  it('applies amber class to Warning level entries', async () => {
    renderPage()
    act(() => {
      MockEventSource.instance?.dispatchMessage(makeEntry('Watch out', 'Warning'))
    })
    await waitFor(() => screen.getByText('Watch out'))
    expect(screen.getByText('Watch out').className).toContain('text-amber-400')
  })

  it('shows entry count in the footer', async () => {
    renderPage()
    act(() => {
      MockEventSource.instance?.dispatchMessage(makeEntry('msg1'))
    })
    await waitFor(() => screen.getByText(/1 \/ 500 entries/i))
  })

  // ── Auto-scroll checkbox ───────────────────────────────────────────────────

  it('renders the auto-scroll checkbox checked by default', () => {
    renderPage()
    const checkbox = screen.getByTestId('auto-scroll-checkbox') as HTMLInputElement
    expect(checkbox).toBeInTheDocument()
    expect(checkbox.checked).toBe(true)
  })

  it('shows "Volg laatste log" label next to the checkbox', () => {
    renderPage()
    expect(screen.getByText('Volg laatste log')).toBeInTheDocument()
  })

  it('unchecking the checkbox disables auto-scroll', () => {
    renderPage()
    const checkbox = screen.getByTestId('auto-scroll-checkbox') as HTMLInputElement
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)
  })

  it('checking the checkbox re-enables auto-scroll', () => {
    renderPage()
    const checkbox = screen.getByTestId('auto-scroll-checkbox') as HTMLInputElement
    fireEvent.click(checkbox) // uncheck
    fireEvent.click(checkbox) // re-check
    expect(checkbox.checked).toBe(true)
  })

  it('scrolling away from the bottom unchecks the auto-scroll checkbox', async () => {
    renderPage()
    const feed = screen.getByTestId('log-feed')

    // Simulate scroll position NOT near the bottom
    Object.defineProperty(feed, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(feed, 'scrollTop', { value: 0, configurable: true })
    Object.defineProperty(feed, 'clientHeight', { value: 200, configurable: true })

    fireEvent.scroll(feed)

    await waitFor(() => {
      const checkbox = screen.getByTestId('auto-scroll-checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(false)
    })
  })

  it('scrolling near the bottom does NOT disable auto-scroll', async () => {
    renderPage()
    const feed = screen.getByTestId('log-feed')

    // Simulate scroll position very close to the bottom (within 40px threshold)
    Object.defineProperty(feed, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(feed, 'scrollTop', { value: 795, configurable: true })
    Object.defineProperty(feed, 'clientHeight', { value: 200, configurable: true })

    fireEvent.scroll(feed)

    // Checkbox should remain checked
    const checkbox = screen.getByTestId('auto-scroll-checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })
})
