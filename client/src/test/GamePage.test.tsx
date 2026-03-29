import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../hooks/useAuth'
import GamePage from '../pages/GamePage'
import type { UserInfo, Game, Ranking } from '../types'

vi.mock('../components/RankingBoard', () => ({
  default: ({ onSubmit }: { onSubmit: (ids: string[]) => void }) => (
    <button onClick={() => onSubmit(['c1', 'c2'])}>Submit ranking</button>
  ),
}))

vi.mock('../api/client', () => ({
  api: {
    getGame: vi.fn(),
    getMyRankings: vi.fn(),
    getEpisodeRankings: vi.fn(),
    createEpisode: vi.fn(),
    deleteEpisode: vi.fn(),
    updateEpisode: vi.fn(),
    revealMole: vi.fn(),
    addContestants: vi.fn(),
    submitRanking: vi.fn(),
  },
}))

import { api } from '../api/client'

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ gameId: 'game-1' }) }
})

const mockUser: UserInfo = { userId: 'user-1', displayName: 'Alex', roles: ['authenticated'] }
const mockAdmin: UserInfo = {
  userId: 'admin-1',
  displayName: 'Admin',
  roles: ['authenticated', 'admin'],
}

const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
const pastDeadline = new Date(Date.now() - 60 * 60 * 1000).toISOString()

const mockGame: Game = {
  id: 'game-1',
  name: 'Testspel',
  inviteCode: 'ABC123',
  adminUserId: 'admin-1',
  contestants: [
    { id: 'c1', name: 'Alice', age: 30, photoUrl: '' },
    { id: 'c2', name: 'Bob', age: 25, photoUrl: '' },
  ],
  episodes: [],
}

const mockGameWithEpisode: Game = {
  ...mockGame,
  episodes: [{ number: 1, deadline: futureDeadline }],
}

const mockGameWithPastEpisode: Game = {
  ...mockGame,
  episodes: [{ number: 1, deadline: pastDeadline }],
}

const emptyRankings: Ranking[] = []

function renderWithAuth(user: UserInfo | null) {
  return render(
    <AuthContext.Provider value={{ user, loading: false, error: null, setUser: () => {} }}>
      <MemoryRouter>
        <GamePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('GamePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getMyRankings).mockResolvedValue(emptyRankings)
    vi.mocked(api.getEpisodeRankings).mockResolvedValue([])
  })

  it('shows loading skeleton initially', () => {
    vi.mocked(api.getGame).mockReturnValue(new Promise(() => {}))
    const { container } = renderWithAuth(mockUser)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows game name after loading', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderWithAuth(mockUser)
    expect(await screen.findByText('Testspel')).toBeInTheDocument()
  })

  it('shows invite code', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderWithAuth(mockUser)
    expect(await screen.findByText('ABC123')).toBeInTheDocument()
  })

  it('shows "Nog geen aflevering gestart" when no episodes', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderWithAuth(mockUser)
    expect(await screen.findByText('Nog geen aflevering gestart.')).toBeInTheDocument()
  })

  it('shows episode card when episode exists', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameWithEpisode)
    renderWithAuth(mockUser)
    expect(await screen.findByText('Aflevering 1')).toBeInTheDocument()
  })

  it('shows Open badge when deadline is in the future', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameWithEpisode)
    renderWithAuth(mockUser)
    expect(await screen.findByText('Open')).toBeInTheDocument()
  })

  it('shows Deadline verstreken badge when deadline has passed', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameWithPastEpisode)
    renderWithAuth(mockUser)
    expect(await screen.findByText('Deadline verstreken')).toBeInTheDocument()
  })

  it('shows error when game fails to load', async () => {
    vi.mocked(api.getGame).mockRejectedValue(new Error('Netwerkfout'))
    renderWithAuth(mockUser)
    expect(await screen.findByText('Netwerkfout')).toBeInTheDocument()
  })

  it('does not show admin panel for non-admin', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderWithAuth(mockUser)
    await screen.findByText('Testspel')
    expect(screen.queryByText('Afleveringen beheren')).not.toBeInTheDocument()
  })

  it('shows admin panel for admin user', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderWithAuth(mockAdmin)
    expect(await screen.findByText('Afleveringen beheren')).toBeInTheDocument()
  })

  it('shows existing episodes in admin panel', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameWithEpisode)
    renderWithAuth(mockAdmin)
    expect(await screen.findByText('Afleveringen beheren')).toBeInTheDocument()
    expect(screen.getAllByText(/Aflevering 1/).length).toBeGreaterThan(0)
  })

  it('shows delete button for each episode in admin panel', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameWithEpisode)
    renderWithAuth(mockAdmin)
    await screen.findByText('Afleveringen beheren')
    expect(screen.getByRole('button', { name: 'Verwijderen' })).toBeInTheDocument()
  })

  it('opens confirmation dialog when delete button is clicked', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameWithEpisode)
    renderWithAuth(mockAdmin)
    await screen.findByText('Afleveringen beheren')
    fireEvent.click(screen.getByRole('button', { name: 'Verwijderen' }))
    expect(await screen.findByText('Aflevering 1 verwijderen?')).toBeInTheDocument()
    expect(
      screen.getByText(/Dit verwijdert ook alle ingediende rangschikkingen/),
    ).toBeInTheDocument()
  })

  it('calls deleteEpisode and reloads when confirmed', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameWithEpisode)
    vi.mocked(api.deleteEpisode).mockResolvedValue(undefined)
    renderWithAuth(mockAdmin)
    await screen.findByText('Afleveringen beheren')
    fireEvent.click(screen.getByRole('button', { name: 'Verwijderen' }))
    await screen.findByText('Aflevering 1 verwijderen?')
    // Click the confirm button inside the dialog (also labelled Verwijderen)
    const confirmButtons = screen.getAllByRole('button', { name: 'Verwijderen' })
    fireEvent.click(confirmButtons[confirmButtons.length - 1])
    await waitFor(() => expect(api.deleteEpisode).toHaveBeenCalledWith('game-1', 1))
    expect(api.getGame).toHaveBeenCalledTimes(2)
  })

  it('does not call deleteEpisode when cancelled', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameWithEpisode)
    renderWithAuth(mockAdmin)
    await screen.findByText('Afleveringen beheren')
    fireEvent.click(screen.getByRole('button', { name: 'Verwijderen' }))
    await screen.findByText('Aflevering 1 verwijderen?')
    fireEvent.click(screen.getByRole('button', { name: 'Annuleren' }))
    expect(api.deleteEpisode).not.toHaveBeenCalled()
  })

  it('shows error when deleteEpisode fails', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameWithEpisode)
    vi.mocked(api.deleteEpisode).mockRejectedValue(new Error('Verwijderen mislukt'))
    renderWithAuth(mockAdmin)
    await screen.findByText('Afleveringen beheren')
    fireEvent.click(screen.getByRole('button', { name: 'Verwijderen' }))
    await screen.findByText('Aflevering 1 verwijderen?')
    const confirmButtons = screen.getAllByRole('button', { name: 'Verwijderen' })
    fireEvent.click(confirmButtons[confirmButtons.length - 1])
    expect(await screen.findByText('Verwijderen mislukt')).toBeInTheDocument()
  })

  it('shows mole revealed alert when moleContestantId is set', async () => {
    const gameWithMole = { ...mockGame, moleContestantId: 'c1' }
    vi.mocked(api.getGame).mockResolvedValue(gameWithMole)
    renderWithAuth(mockUser)
    expect(await screen.findByText(/De Mol is onthuld/)).toBeInTheDocument()
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThanOrEqual(1)
  })
})
