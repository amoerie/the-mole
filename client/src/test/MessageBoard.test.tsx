import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import MessageBoard from '../components/MessageBoard'
import type { GameMessage, MessagesPage } from '../types'

vi.mock('../api/client', () => ({
  api: {
    getUnreadMessageCount: vi.fn(),
    getMessages: vi.fn(),
    markMessagesRead: vi.fn(),
    postMessage: vi.fn(),
  },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'user-1', displayName: 'Alice', roles: ['authenticated'] } }),
}))

import { api } from '../api/client'

const mockMsg: GameMessage = {
  id: 'msg-1',
  gameId: 'game-1',
  userId: 'user-2',
  displayName: 'Bob',
  content: 'Hallo!',
  postedAt: new Date().toISOString(),
}

function emptyPage(): MessagesPage {
  return { items: [], hasMore: false }
}

function renderBoard(gameId = 'game-1') {
  return render(
    <MemoryRouter>
      <MessageBoard gameId={gameId} />
    </MemoryRouter>,
  )
}

describe('MessageBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.markMessagesRead).mockResolvedValue(undefined)
    vi.mocked(api.getMessages).mockResolvedValue(emptyPage())
  })

  it('renders collapsed by default when there are no unread messages', async () => {
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(0)
    renderBoard()
    await waitFor(() => expect(api.getUnreadMessageCount).toHaveBeenCalledWith('game-1'))
    expect(screen.queryByRole('textbox', { name: /bericht/i })).not.toBeInTheDocument()
  })

  it('auto-expands when there are unread messages', async () => {
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(3)
    renderBoard()
    expect(await screen.findByRole('textbox', { name: /bericht/i })).toBeInTheDocument()
  })

  it('shows unread badge with count', async () => {
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(5)
    vi.mocked(api.markMessagesRead).mockReturnValue(new Promise(() => {})) // hold so badge stays visible
    renderBoard()
    expect(await screen.findByLabelText('5 ongelezen')).toBeInTheDocument()
  })

  it('hides badge when unread count is zero', async () => {
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(0)
    renderBoard()
    await waitFor(() => expect(api.getUnreadMessageCount).toHaveBeenCalled())
    expect(screen.queryByLabelText(/ongelezen/)).not.toBeInTheDocument()
  })

  it('submits message when Enter is pressed without Shift', async () => {
    const sentMsg: GameMessage = {
      ...mockMsg,
      id: 'enter',
      userId: 'user-1',
      displayName: 'Alice',
      content: 'Enter test',
    }
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(1)
    vi.mocked(api.getMessages).mockResolvedValue(emptyPage())
    vi.mocked(api.postMessage).mockResolvedValue(sentMsg)
    renderBoard()
    await screen.findByText('Nog geen berichten. Wees de eerste!')
    await userEvent.type(screen.getByRole('textbox', { name: /bericht/i }), 'Enter test')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(api.postMessage).toHaveBeenCalledWith('game-1', 'Enter test'))
  })

  it('does not submit when Shift+Enter is pressed', async () => {
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(1)
    vi.mocked(api.getMessages).mockResolvedValue(emptyPage())
    renderBoard()
    await screen.findByText('Nog geen berichten. Wees de eerste!')
    await userEvent.type(screen.getByRole('textbox', { name: /bericht/i }), 'Hello')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    expect(api.postMessage).not.toHaveBeenCalled()
  })

  it('calls markMessagesRead when opened', async () => {
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(0)
    renderBoard()
    await waitFor(() => expect(api.getUnreadMessageCount).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: /berichten/i }))
    await waitFor(() => expect(api.markMessagesRead).toHaveBeenCalledWith('game-1'))
  })

  it('clears badge after opening', async () => {
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(2)
    renderBoard()
    await screen.findByLabelText('2 ongelezen')
    await waitFor(() => expect(api.markMessagesRead).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByLabelText(/ongelezen/)).not.toBeInTheDocument())
  })

  it('can be toggled open and closed', async () => {
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(0)
    renderBoard()
    await waitFor(() => expect(api.getUnreadMessageCount).toHaveBeenCalled())
    const header = screen.getByRole('button', { name: /berichten/i })
    await userEvent.click(header)
    expect(await screen.findByRole('textbox', { name: /bericht/i })).toBeInTheDocument()
    await userEvent.click(header)
    expect(screen.queryByRole('textbox', { name: /bericht/i })).not.toBeInTheDocument()
  })

  it('shows messages when expanded', async () => {
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(1)
    vi.mocked(api.getMessages).mockResolvedValue({ items: [mockMsg], hasMore: false })
    renderBoard()
    expect(await screen.findByText('Hallo!')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows empty state when there are no messages', async () => {
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(1)
    vi.mocked(api.getMessages).mockResolvedValue(emptyPage())
    renderBoard()
    expect(await screen.findByText('Nog geen berichten. Wees de eerste!')).toBeInTheDocument()
  })

  it('submits a new message and appends it', async () => {
    const sentMsg: GameMessage = {
      ...mockMsg,
      id: 'new',
      userId: 'user-1',
      displayName: 'Alice',
      content: 'Test',
    }
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(1)
    vi.mocked(api.getMessages).mockResolvedValue(emptyPage())
    vi.mocked(api.postMessage).mockResolvedValue(sentMsg)
    renderBoard()
    await screen.findByText('Nog geen berichten. Wees de eerste!')
    await userEvent.type(screen.getByRole('textbox', { name: /bericht/i }), 'Test')
    await userEvent.click(screen.getByRole('button', { name: /verzenden/i }))
    await waitFor(() => expect(api.postMessage).toHaveBeenCalledWith('game-1', 'Test'))
    expect(await screen.findByText('Test')).toBeInTheDocument()
  })

  it('shows submit error when postMessage fails', async () => {
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(1)
    vi.mocked(api.getMessages).mockResolvedValue(emptyPage())
    vi.mocked(api.postMessage).mockRejectedValue(new Error('Verzenden mislukt'))
    renderBoard()
    await screen.findByText('Nog geen berichten. Wees de eerste!')
    await userEvent.type(screen.getByRole('textbox', { name: /bericht/i }), 'Oops')
    await userEvent.click(screen.getByRole('button', { name: /verzenden/i }))
    expect(await screen.findByText('Verzenden mislukt')).toBeInTheDocument()
  })

  it('shows load older button when hasMore is true', async () => {
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(1)
    vi.mocked(api.getMessages).mockResolvedValue({ items: [mockMsg], hasMore: true })
    renderBoard()
    expect(await screen.findByText('Laad oudere berichten')).toBeInTheDocument()
  })

  it('loads older messages when button is clicked and prepends them', async () => {
    const olderMsg: GameMessage = { ...mockMsg, id: 'old', content: 'Oud bericht' }
    vi.mocked(api.getUnreadMessageCount).mockResolvedValue(1)
    vi.mocked(api.getMessages)
      .mockResolvedValueOnce({ items: [mockMsg], hasMore: true })
      .mockResolvedValueOnce({ items: [olderMsg], hasMore: false })
    renderBoard()
    await screen.findByText('Laad oudere berichten')
    await userEvent.click(screen.getByText('Laad oudere berichten'))
    await waitFor(() => expect(screen.getByText('Oud bericht')).toBeInTheDocument())
    expect(screen.queryByText('Laad oudere berichten')).not.toBeInTheDocument()
    // Older message should appear before the newer one in the DOM
    const allMessages = screen.getAllByText(/Oud bericht|Hallo!/)
    expect(allMessages[0]).toHaveTextContent('Oud bericht')
    expect(allMessages[1]).toHaveTextContent('Hallo!')
  })
})
