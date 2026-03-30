import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import MessageBoardPage from '../pages/MessageBoardPage'
import type { Game, GameMessage, MessagesPage } from '../types'

vi.mock('../api/client', () => ({
  api: {
    getGame: vi.fn(),
    getMessages: vi.fn(),
    postMessage: vi.fn(),
  },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'user-1', displayName: 'Alice', roles: ['authenticated'] } }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useParams: () => ({ gameId: 'game-1' }) }
})

import { api } from '../api/client'

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

const mockGame: Game = {
  id: 'game-1',
  name: 'Testspel',
  inviteCode: 'ABC123',
  adminUserId: 'admin-1',
  contestants: [],
  episodes: [],
}

const mockMsg: GameMessage = {
  id: 'msg-1',
  gameId: 'game-1',
  userId: 'user-2',
  displayName: 'Bob',
  content: 'Hallo!',
  postedAt: new Date().toISOString(),
}

const mockOwnMsg: GameMessage = {
  id: 'msg-2',
  gameId: 'game-1',
  userId: 'user-1',
  displayName: 'Alice',
  content: 'Ik ook!',
  postedAt: new Date().toISOString(),
}

function emptyPage(): MessagesPage {
  return { items: [], hasMore: false }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MessageBoardPage />
    </MemoryRouter>,
  )
}

describe('MessageBoardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    vi.mocked(api.getGame).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.getMessages).mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows error when getGame fails', async () => {
    vi.mocked(api.getGame).mockRejectedValue(new Error('Netwerkfout'))
    vi.mocked(api.getMessages).mockResolvedValue(emptyPage())
    renderPage()
    expect(await screen.findByText('Netwerkfout')).toBeInTheDocument()
  })

  it('shows generic error on non-Error rejection', async () => {
    vi.mocked(api.getGame).mockRejectedValue('oops')
    vi.mocked(api.getMessages).mockResolvedValue(emptyPage())
    renderPage()
    expect(await screen.findByText('Fout bij laden')).toBeInTheDocument()
  })

  it('shows not-found alert when game is null', async () => {
    vi.mocked(api.getGame).mockResolvedValue(null as unknown as Game)
    vi.mocked(api.getMessages).mockResolvedValue(emptyPage())
    renderPage()
    expect(await screen.findByText('Spel niet gevonden')).toBeInTheDocument()
  })

  it('shows empty state when no messages', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getMessages).mockResolvedValue(emptyPage())
    renderPage()
    expect(await screen.findByText('Nog geen berichten. Wees de eerste!')).toBeInTheDocument()
  })

  it('renders message content and author name for other users', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getMessages).mockResolvedValue({ items: [mockMsg], hasMore: false })
    renderPage()
    expect(await screen.findByText('Hallo!')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('does not show author name for own messages', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getMessages).mockResolvedValue({ items: [mockOwnMsg], hasMore: false })
    renderPage()
    await screen.findByText('Ik ook!')
    // The message content is visible but the display name label is not shown for own messages
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })

  it('shows "load more" button when hasMore is true', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getMessages).mockResolvedValue({ items: [mockMsg], hasMore: true })
    renderPage()
    expect(await screen.findByText('Laad oudere berichten')).toBeInTheDocument()
  })

  it('does not show "load more" when hasMore is false', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getMessages).mockResolvedValue({ items: [mockMsg], hasMore: false })
    renderPage()
    await screen.findByText('Hallo!')
    expect(screen.queryByText('Laad oudere berichten')).not.toBeInTheDocument()
  })

  it('loads more messages when "load more" is clicked', async () => {
    const newMsg: GameMessage = { ...mockMsg, id: 'msg-3', content: 'Nieuw bericht' }
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getMessages)
      .mockResolvedValueOnce({ items: [mockMsg], hasMore: true })
      .mockResolvedValueOnce({ items: [newMsg], hasMore: false })
    renderPage()
    await screen.findByText('Laad oudere berichten')
    await userEvent.click(screen.getByText('Laad oudere berichten'))
    await waitFor(() => expect(screen.getByText('Nieuw bericht')).toBeInTheDocument())
    expect(screen.queryByText('Laad oudere berichten')).not.toBeInTheDocument()
  })

  it('submits a new message and appends it to the list', async () => {
    const sentMsg: GameMessage = { ...mockOwnMsg, id: 'msg-new', content: 'Test verzonden' }
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getMessages).mockResolvedValue(emptyPage())
    vi.mocked(api.postMessage).mockResolvedValue(sentMsg)
    renderPage()
    await screen.findByText('Nog geen berichten. Wees de eerste!')
    const textarea = screen.getByRole('textbox', { name: /bericht/i })
    await userEvent.type(textarea, 'Test verzonden')
    await userEvent.click(screen.getByRole('button', { name: /verzenden/i }))
    await waitFor(() => expect(api.postMessage).toHaveBeenCalledWith('game-1', 'Test verzonden'))
    expect(await screen.findByText('Test verzonden')).toBeInTheDocument()
  })

  it('shows submit error when postMessage fails', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getMessages).mockResolvedValue(emptyPage())
    vi.mocked(api.postMessage).mockRejectedValue(new Error('Verzenden mislukt'))
    renderPage()
    await screen.findByText('Nog geen berichten. Wees de eerste!')
    const textarea = screen.getByRole('textbox', { name: /bericht/i })
    await userEvent.type(textarea, 'Oops')
    await userEvent.click(screen.getByRole('button', { name: /verzenden/i }))
    expect(await screen.findByText('Verzenden mislukt')).toBeInTheDocument()
  })

  it('shows character counter', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getMessages).mockResolvedValue(emptyPage())
    renderPage()
    await screen.findByText('Nog geen berichten. Wees de eerste!')
    expect(screen.getByText('0/500')).toBeInTheDocument()
  })
})
