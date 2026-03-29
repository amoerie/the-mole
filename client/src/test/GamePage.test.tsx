import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../hooks/useAuth'
import GamePage from '../pages/GamePage'
import type { UserInfo, Game, Ranking } from '../types'

vi.mock('../components/EpisodeCard', () => ({
  default: ({ onSubmit }: { onSubmit: (ids: string[]) => Promise<void> }) => (
    <div data-testid="episode-card">
      <button onClick={() => onSubmit(['c1', 'c2'])}>Submit ranking</button>
    </div>
  ),
}))

vi.mock('../components/AdminContestantManager', () => ({
  default: () => <div data-testid="admin-contestant-manager">AdminContestantManager</div>,
}))

vi.mock('../components/AdminEpisodeManager', () => ({
  default: ({
    onDeleteEpisode,
    onCreateEpisode,
    onRevealMole,
  }: {
    onDeleteEpisode: (n: number) => Promise<void>
    onCreateEpisode: (d: string) => Promise<void>
    onRevealMole: (id: string) => Promise<void>
  }) => (
    <div data-testid="admin-episode-manager">
      <button onClick={() => onDeleteEpisode(1)}>Delete episode 1</button>
      <button onClick={() => onCreateEpisode('2026-04-06T18:00:00.000Z')}>Create episode</button>
      <button onClick={() => onRevealMole('c1')}>Reveal mole</button>
    </div>
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

  it('shows EpisodeCard when episode exists', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameWithEpisode)
    renderWithAuth(mockUser)
    expect(await screen.findByTestId('episode-card')).toBeInTheDocument()
  })

  it('does not show EpisodeCard when no episodes', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderWithAuth(mockUser)
    await screen.findByText('Testspel')
    expect(screen.queryByTestId('episode-card')).not.toBeInTheDocument()
  })

  it('shows error when game fails to load', async () => {
    vi.mocked(api.getGame).mockRejectedValue(new Error('Netwerkfout'))
    renderWithAuth(mockUser)
    expect(await screen.findByText('Netwerkfout')).toBeInTheDocument()
  })

  it('does not show admin panels for non-admin', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderWithAuth(mockUser)
    await screen.findByText('Testspel')
    expect(screen.queryByTestId('admin-contestant-manager')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-episode-manager')).not.toBeInTheDocument()
  })

  it('shows admin panels for admin user', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderWithAuth(mockAdmin)
    expect(await screen.findByTestId('admin-contestant-manager')).toBeInTheDocument()
    expect(await screen.findByTestId('admin-episode-manager')).toBeInTheDocument()
  })

  it('calls deleteEpisode and reloads when admin deletes an episode', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameWithEpisode)
    vi.mocked(api.deleteEpisode).mockResolvedValue(undefined)
    renderWithAuth(mockAdmin)
    await screen.findByTestId('admin-episode-manager')
    screen.getByText('Delete episode 1').click()
    await waitFor(() => expect(api.deleteEpisode).toHaveBeenCalledWith('game-1', 1))
    expect(api.getGame).toHaveBeenCalledTimes(2)
  })

  it('shows error when deleteEpisode fails', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameWithEpisode)
    vi.mocked(api.deleteEpisode).mockRejectedValue(new Error('Verwijderen mislukt'))
    renderWithAuth(mockAdmin)
    await screen.findByTestId('admin-episode-manager')
    screen.getByText('Delete episode 1').click()
    expect(await screen.findByText('Verwijderen mislukt')).toBeInTheDocument()
  })

  it('calls createEpisode and reloads when admin creates an episode', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.createEpisode).mockResolvedValue(undefined as never)
    renderWithAuth(mockAdmin)
    await screen.findByTestId('admin-episode-manager')
    screen.getByText('Create episode').click()
    await waitFor(() => expect(api.createEpisode).toHaveBeenCalled())
    expect(api.getGame).toHaveBeenCalledTimes(2)
  })

  it('calls revealMole and reloads', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.revealMole).mockResolvedValue(undefined as never)
    renderWithAuth(mockAdmin)
    await screen.findByTestId('admin-episode-manager')
    screen.getByText('Reveal mole').click()
    await waitFor(() => expect(api.revealMole).toHaveBeenCalledWith('game-1', 'c1'))
    expect(api.getGame).toHaveBeenCalledTimes(2)
  })

  it('shows mole revealed alert when moleContestantId is set', async () => {
    const gameWithMole = { ...mockGame, moleContestantId: 'c1' }
    vi.mocked(api.getGame).mockResolvedValue(gameWithMole)
    renderWithAuth(mockUser)
    expect(await screen.findByText(/De Mol is onthuld/)).toBeInTheDocument()
  })
})
