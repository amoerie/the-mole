import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminEmailsPage from '../pages/AdminEmailsPage'

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockNavigate = vi.fn()

import { useAuth } from '../hooks/useAuth'
import { api } from '../api/client'
import { EmailType } from '../api/client'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      listEmailLogs: vi.fn(),
      getEmailLog: vi.fn(),
      retryEmailLog: vi.fn(),
      sendReminderEmail: vi.fn(),
      listUsers: vi.fn(),
    },
  }
})

const adminUser = { userId: 'a1', displayName: 'Admin', roles: ['authenticated', 'admin'] }
const regularUser = { userId: 'u1', displayName: 'User', roles: ['authenticated'] }

const fakeSummary = {
  id: 'log-1',
  sentAt: '2026-04-13T10:00:00Z',
  toEmail: 'alice@test.com',
  toName: 'Alice',
  subject: 'Test Subject',
  type: EmailType.RankingReminder,
  success: true,
  errorMessage: null,
}

const failedSummary = {
  ...fakeSummary,
  id: 'log-2',
  success: false,
  errorMessage: 'API error',
}

const emptyPage = { total: 0, page: 1, pageSize: 50, items: [] }
const onePage = { total: 1, page: 1, pageSize: 50, items: [fakeSummary] }
const failedPage = { total: 1, page: 1, pageSize: 50, items: [failedSummary] }

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminEmailsPage />
    </MemoryRouter>,
  )
}

describe('AdminEmailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      loading: false,
      error: null,
      setUser: vi.fn(),
    })
    vi.mocked(api.listEmailLogs).mockResolvedValue(emptyPage as never)
    vi.mocked(api.listUsers).mockResolvedValue([])
    vi.mocked(api.getEmailLog).mockResolvedValue({
      ...fakeSummary,
      htmlBody: '<p>Hello</p>',
      textBody: 'Hello',
    } as never)
    vi.mocked(api.retryEmailLog).mockResolvedValue(undefined as never)
    vi.mocked(api.sendReminderEmail).mockResolvedValue({ sentTo: 'alice@test.com' } as never)
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

  it('shows page heading', async () => {
    renderPage()
    expect(screen.getByText('E-mail dashboard')).toBeInTheDocument()
  })

  it('shows test send section', async () => {
    renderPage()
    expect(screen.getByTestId('send-reminder-btn')).toBeInTheDocument()
  })

  // ── Email log table ────────────────────────────────────────────────────────

  it('loads and displays email rows', async () => {
    vi.mocked(api.listEmailLogs).mockResolvedValue(onePage as never)
    renderPage()
    await waitFor(() => expect(screen.getByTestId('email-row')).toBeInTheDocument())
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
    expect(screen.getByText('Test Subject')).toBeInTheDocument()
  })

  it('shows empty state when there are no logs', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/geen e-mails gevonden/i)).toBeInTheDocument())
  })

  it('shows success badge for successful emails', async () => {
    vi.mocked(api.listEmailLogs).mockResolvedValue(onePage as never)
    renderPage()
    await waitFor(() => screen.getByTestId('status-success'))
    expect(screen.getByTestId('status-success')).toHaveTextContent('Verstuurd')
  })

  it('shows failed badge for failed emails', async () => {
    vi.mocked(api.listEmailLogs).mockResolvedValue(failedPage as never)
    renderPage()
    await waitFor(() => screen.getByTestId('status-failed'))
    expect(screen.getByTestId('status-failed')).toHaveTextContent('Mislukt')
  })

  it('shows retry button only for failed emails', async () => {
    vi.mocked(api.listEmailLogs).mockResolvedValue(failedPage as never)
    renderPage()
    await waitFor(() => screen.getByTestId('retry-btn'))
    expect(screen.getByTestId('retry-btn')).toBeInTheDocument()
  })

  it('does not show retry button for successful emails', async () => {
    vi.mocked(api.listEmailLogs).mockResolvedValue(onePage as never)
    renderPage()
    await waitFor(() => screen.getByTestId('email-row'))
    expect(screen.queryByTestId('retry-btn')).toBeNull()
  })

  it('shows error alert when log loading fails', async () => {
    vi.mocked(api.listEmailLogs).mockRejectedValue(new Error('network error'))
    renderPage()
    await waitFor(() => screen.getByTestId('logs-error'))
  })

  // ── Row expansion / HTML preview ───────────────────────────────────────────

  it('expands row on click and shows iframe preview', async () => {
    vi.mocked(api.listEmailLogs).mockResolvedValue(onePage as never)
    renderPage()
    const row = await screen.findByTestId('email-row')
    fireEvent.click(row)
    await waitFor(() => screen.getByTestId('html-preview'))
    expect(api.getEmailLog).toHaveBeenCalledWith('log-1')
  })

  it('collapses row on second click', async () => {
    vi.mocked(api.listEmailLogs).mockResolvedValue(onePage as never)
    renderPage()
    const row = await screen.findByTestId('email-row')
    fireEvent.click(row)
    await waitFor(() => screen.getByTestId('html-preview'))
    fireEvent.click(row)
    await waitFor(() => expect(screen.queryByTestId('html-preview')).toBeNull())
  })

  it('does not re-fetch HTML if already cached', async () => {
    vi.mocked(api.listEmailLogs).mockResolvedValue(onePage as never)
    renderPage()
    const row = await screen.findByTestId('email-row')
    fireEvent.click(row)
    await waitFor(() => screen.getByTestId('html-preview'))
    fireEvent.click(row) // collapse
    fireEvent.click(row) // expand again
    await waitFor(() => screen.getByTestId('html-preview'))
    expect(api.getEmailLog).toHaveBeenCalledTimes(1)
  })

  // ── Retry ──────────────────────────────────────────────────────────────────

  it('calls retryEmailLog when retry button is clicked', async () => {
    vi.mocked(api.listEmailLogs).mockResolvedValue(failedPage as never)
    renderPage()
    const btn = await screen.findByTestId('retry-btn')
    fireEvent.click(btn)
    await waitFor(() => expect(api.retryEmailLog).toHaveBeenCalledWith('log-2'))
  })

  it('reloads logs after successful retry', async () => {
    vi.mocked(api.listEmailLogs).mockResolvedValue(failedPage as never)
    renderPage()
    const btn = await screen.findByTestId('retry-btn')
    fireEvent.click(btn)
    await waitFor(() => expect(api.listEmailLogs).toHaveBeenCalledTimes(2))
  })

  // ── Manual test send ───────────────────────────────────────────────────────

  it('populates user dropdown from listUsers', async () => {
    vi.mocked(api.listUsers).mockResolvedValue([
      { id: 'u1', email: 'bob@test.com', displayName: 'Bob', roles: [] },
    ] as never)
    renderPage()
    await waitFor(() => expect(screen.getByTestId('user-select')).toBeInTheDocument())
    expect(screen.getByText('Bob (bob@test.com)')).toBeInTheDocument()
  })

  it('send button is disabled when no user is selected', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('send-reminder-btn')).toBeDisabled())
  })

  it('sends reminder when user is selected and button is clicked', async () => {
    vi.mocked(api.listUsers).mockResolvedValue([
      { id: 'u1', email: 'bob@test.com', displayName: 'Bob', roles: [] },
    ] as never)
    renderPage()
    const select = await screen.findByTestId('user-select')
    fireEvent.change(select, { target: { value: 'u1' } })
    fireEvent.click(screen.getByTestId('send-reminder-btn'))
    await waitFor(() => expect(api.sendReminderEmail).toHaveBeenCalledWith('u1'))
  })

  it('shows success message after sending', async () => {
    vi.mocked(api.listUsers).mockResolvedValue([
      { id: 'u1', email: 'bob@test.com', displayName: 'Bob', roles: [] },
    ] as never)
    renderPage()
    const select = await screen.findByTestId('user-select')
    fireEvent.change(select, { target: { value: 'u1' } })
    fireEvent.click(screen.getByTestId('send-reminder-btn'))
    await waitFor(() => screen.getByTestId('send-success'))
    expect(screen.getByTestId('send-success')).toHaveTextContent('alice@test.com')
  })

  it('shows error alert when send fails', async () => {
    vi.mocked(api.listUsers).mockResolvedValue([
      { id: 'u1', email: 'bob@test.com', displayName: 'Bob', roles: [] },
    ] as never)
    vi.mocked(api.sendReminderEmail).mockRejectedValue(new Error('No open games'))
    renderPage()
    const select = await screen.findByTestId('user-select')
    fireEvent.change(select, { target: { value: 'u1' } })
    fireEvent.click(screen.getByTestId('send-reminder-btn'))
    await waitFor(() => screen.getByTestId('send-error'))
  })

  // ── Pagination ─────────────────────────────────────────────────────────────

  it('does not show pagination for single page', async () => {
    vi.mocked(api.listEmailLogs).mockResolvedValue(onePage as never)
    renderPage()
    await waitFor(() => screen.getByTestId('email-row'))
    expect(screen.queryByTestId('prev-page')).toBeNull()
    expect(screen.queryByTestId('next-page')).toBeNull()
  })

  it('shows pagination controls for multiple pages', async () => {
    vi.mocked(api.listEmailLogs).mockResolvedValue({
      total: 120,
      page: 1,
      pageSize: 50,
      items: [fakeSummary],
    } as never)
    renderPage()
    await waitFor(() => screen.getByTestId('prev-page'))
    expect(screen.getByTestId('next-page')).toBeInTheDocument()
  })

  it('prev page button is disabled on first page', async () => {
    vi.mocked(api.listEmailLogs).mockResolvedValue({
      total: 120,
      page: 1,
      pageSize: 50,
      items: [fakeSummary],
    } as never)
    renderPage()
    await waitFor(() => screen.getByTestId('prev-page'))
    expect(screen.getByTestId('prev-page')).toBeDisabled()
  })

  it('loads next page when next button is clicked', async () => {
    vi.mocked(api.listEmailLogs).mockResolvedValue({
      total: 120,
      page: 1,
      pageSize: 50,
      items: [fakeSummary],
    } as never)
    renderPage()
    await waitFor(() => screen.getByTestId('next-page'))
    fireEvent.click(screen.getByTestId('next-page'))
    await waitFor(() => expect(api.listEmailLogs).toHaveBeenCalledWith(2, 50))
  })
})
