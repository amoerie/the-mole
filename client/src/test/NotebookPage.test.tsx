import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../hooks/useAuth'
import NotebookPage from '../pages/NotebookPage'
import type { UserInfo, Game, Notebook } from '../types'

vi.mock('../api/client', () => ({
  api: {
    getGame: vi.fn(),
    getNotebook: vi.fn(),
    saveNote: vi.fn(),
    updateNotebookColor: vi.fn(),
  },
}))

import { api } from '../api/client'

const mockUser: UserInfo = { userId: 'user-1', displayName: 'Alex', roles: ['authenticated'] }

const yesterday = new Date(Date.now() - 86400000).toISOString()
const tomorrow = new Date(Date.now() + 86400000).toISOString()

const mockGame: Game = {
  id: 'game-1',
  name: 'Testspel',
  inviteCode: 'ABC123',
  adminUserId: 'admin-1',
  contestants: [
    { id: 'c1', name: 'Abigail de Vries', age: 33, photoUrl: '' },
    { id: 'c2', name: 'Dries Janssen', age: 30, photoUrl: '' },
  ],
  episodes: [
    { number: 1, deadline: yesterday, eliminatedContestantIds: [] },
    { number: 2, deadline: tomorrow, eliminatedContestantIds: [] },
  ],
  moleContestantId: undefined,
}

const emptyNotebook: Notebook = { notebookColor: null, notes: [] }

function renderPage(user: UserInfo | null = mockUser) {
  return render(
    <AuthContext.Provider value={{ user, loading: false, error: null, setUser: () => {} }}>
      <MemoryRouter initialEntries={['/game/game-1/molboekje']}>
        <Routes>
          <Route path="/game/:gameId/molboekje" element={<NotebookPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('NotebookPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.saveNote).mockResolvedValue(undefined)
    vi.mocked(api.updateNotebookColor).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows loading skeleton while data is fetching', () => {
    vi.mocked(api.getGame).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.getNotebook).mockReturnValue(new Promise(() => {}))
    const { container } = renderPage()
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows error alert when API calls fail', async () => {
    vi.mocked(api.getGame).mockRejectedValue(new Error('Netwerkfout'))
    vi.mocked(api.getNotebook).mockResolvedValue(emptyNotebook)
    renderPage()
    expect(await screen.findByText('Netwerkfout')).toBeInTheDocument()
  })

  it('renders only past episodes (deadline passed), not future ones', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getNotebook).mockResolvedValue(emptyNotebook)
    renderPage()
    await screen.findByText('Aflevering 1')
    expect(screen.queryByText('Aflevering 2')).not.toBeInTheDocument()
  })

  it('renders note content from API response', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getNotebook).mockResolvedValue({
      notebookColor: 'teal',
      notes: [
        {
          episodeNumber: 1,
          content: 'Abigail was suspicious.',
          suspicionLevels: {},
          updatedAt: '2025-03-07T20:00:00Z',
        },
      ],
    })
    renderPage()
    expect(await screen.findByDisplayValue('Abigail was suspicious.')).toBeInTheDocument()
  })

  it('enqueues a debounced save when textarea content changes', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getNotebook).mockResolvedValue(emptyNotebook)
    renderPage()
    const textarea = await screen.findByPlaceholderText(/notities voor aflevering 1/i)

    // Enable fake timers only after async render is complete so findBy* polling is not blocked
    vi.useFakeTimers()
    fireEvent.change(textarea, { target: { value: 'new content' } })

    expect(api.saveNote).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(600)
    })
    expect(api.saveNote).toHaveBeenCalledWith('game-1', 1, 'new content', {})
  })

  it('saves immediately when a suspicion level is changed', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getNotebook).mockResolvedValue(emptyNotebook)
    renderPage()
    await screen.findByText('Aflevering 1')

    const starButtons = screen.getAllByRole('radio', { name: '4 ster' })
    await userEvent.click(starButtons[0])

    await waitFor(() => expect(api.saveNote).toHaveBeenCalledWith('game-1', 1, '', { c1: 4 }))
  })

  it('shows "Opslaan..." indicator while save is in flight', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getNotebook).mockResolvedValue(emptyNotebook)
    vi.mocked(api.saveNote).mockReturnValue(new Promise(() => {}))
    renderPage()
    await screen.findByText('Aflevering 1')

    const starButtons = screen.getAllByRole('radio', { name: '1 ster' })
    await userEvent.click(starButtons[0])

    expect(await screen.findByText('Opslaan...')).toBeInTheDocument()
  })

  it('switches to Verdachten view when toggle is clicked', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getNotebook).mockResolvedValue(emptyNotebook)
    renderPage()
    await screen.findByText('Aflevering 1')

    await userEvent.click(screen.getByRole('button', { name: 'Verdachten' }))

    expect(screen.queryByText('Aflevering 1')).not.toBeInTheDocument()
    expect(screen.getByText('Afl. 1')).toBeInTheDocument()
  })

  it('fires updateNotebookColor when a color swatch is clicked', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getNotebook).mockResolvedValue(emptyNotebook)
    renderPage()
    await screen.findByText('Aflevering 1')

    await userEvent.click(screen.getByRole('button', { name: 'red' }))

    await waitFor(() => expect(api.updateNotebookColor).toHaveBeenCalledWith('game-1', 'red'))
  })

  it('hides eliminated contestants from the suspicion row', async () => {
    const gameWithEliminated: Game = {
      ...mockGame,
      contestants: [
        { id: 'c1', name: 'Abigail de Vries', age: 33, photoUrl: '', eliminatedInEpisode: 1 },
        { id: 'c2', name: 'Dries Janssen', age: 30, photoUrl: '' },
      ],
    }
    vi.mocked(api.getGame).mockResolvedValue(gameWithEliminated)
    vi.mocked(api.getNotebook).mockResolvedValue(emptyNotebook)
    renderPage()
    await screen.findByText('Aflevering 1')
    // Abigail was eliminated in episode 1, so she should not appear in the chip row
    expect(screen.queryByText('Abigail')).not.toBeInTheDocument()
    // Dries is still active and should remain visible
    expect(screen.getByText('Dries')).toBeInTheDocument()
  })

  it('shows suspect timeline cells with saved levels', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getNotebook).mockResolvedValue({
      notebookColor: null,
      notes: [
        {
          episodeNumber: 1,
          content: '',
          suspicionLevels: { c1: 4 },
          updatedAt: '2025-03-07T20:00:00Z',
        },
      ],
    })
    renderPage()
    await screen.findByText('Aflevering 1')

    await userEvent.click(screen.getByRole('button', { name: 'Verdachten' }))

    expect(screen.getByText('★★★★')).toBeInTheDocument()
  })
})
