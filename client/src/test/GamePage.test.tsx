import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../hooks/useAuth'
import GamePage from '../pages/GamePage'
import type { UserInfo, Game, Ranking } from '../types'

vi.mock('../components/EpisodeCard', () => ({
  default: ({
    activeContestants,
    onSubmit,
  }: {
    activeContestants: { id: string; name: string }[]
    onSubmit: (ids: string[]) => Promise<void>
  }) => (
    <div data-testid="episode-card">
      <button onClick={() => onSubmit(['c1', 'c2'])}>Submit ranking</button>
      {activeContestants.map((c) => (
        <span key={c.id} data-testid="active-contestant">
          {c.name}
        </span>
      ))}
    </div>
  ),
}))

vi.mock('../components/AdminContestantManager', () => ({
  default: ({
    onAddContestant,
    onLoadSeason14,
  }: {
    onAddContestant: (name: string, age: number, photoUrl: string) => Promise<void>
    onLoadSeason14: (c: { name: string; age: number; photoUrl: string }[]) => Promise<void>
  }) => (
    <div data-testid="admin-contestant-manager">
      <button onClick={() => onAddContestant('Eve', 28, '')}>Add contestant</button>
      <button onClick={() => onLoadSeason14([{ name: 'Eve', age: 28, photoUrl: '' }])}>
        Load season 14
      </button>
    </div>
  ),
}))

vi.mock('../components/AdminEpisodeManager', () => ({
  default: ({
    onDeleteEpisode,
    onCreateEpisode,
    onRevealMole,
  }: {
    onDeleteEpisode: (n: number) => Promise<void>
    onCreateEpisode: (d: string, ids: string[]) => Promise<void>
    onRevealMole: (id: string) => Promise<void>
  }) => (
    <div data-testid="admin-episode-manager">
      <button onClick={() => onDeleteEpisode(1)}>Delete episode 1</button>
      <button onClick={() => onCreateEpisode('2026-04-06T18:00:00.000Z', [])}>
        Create episode
      </button>
      <button onClick={() => onRevealMole('c1')}>Reveal mole</button>
    </div>
  ),
}))

vi.mock('../components/MessageBoard', () => ({
  default: () => <div data-testid="message-board" />,
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
  episodes: [{ number: 1, deadline: futureDeadline, eliminatedContestantIds: [] }],
}

const mockGameWithEliminatedContestant: Game = {
  ...mockGame,
  contestants: [
    { id: 'c1', name: 'Alice', age: 30, photoUrl: '' },
    { id: 'c2', name: 'Bob', age: 25, photoUrl: '', eliminatedInEpisode: 1 },
  ],
  episodes: [{ number: 1, deadline: futureDeadline, eliminatedContestantIds: ['c2'] }],
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

  it('excludes contestants eliminated in the current episode from the ranking board', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameWithEliminatedContestant)
    renderWithAuth(mockUser)
    await screen.findByTestId('episode-card')
    const activeNames = screen.getAllByTestId('active-contestant').map((el) => el.textContent)
    expect(activeNames).toContain('Alice')
    expect(activeNames).not.toContain('Bob')
  })

  it('shows mole revealed alert when moleContestantId is set', async () => {
    const gameWithMole = { ...mockGame, moleContestantId: 'c1' }
    vi.mocked(api.getGame).mockResolvedValue(gameWithMole)
    renderWithAuth(mockUser)
    expect(await screen.findByText(/De Mol is onthuld/)).toBeInTheDocument()
  })

  it('calls submitRanking and reloads when EpisodeCard submits', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameWithEpisode)
    vi.mocked(api.submitRanking).mockResolvedValue({
      id: 'r1',
      gameId: 'game-1',
      episodeNumber: 1,
      userId: 'user-1',
      contestantIds: ['c1', 'c2'],
      submittedAt: new Date().toISOString(),
    })
    renderWithAuth(mockUser)
    await screen.findByTestId('episode-card')
    screen.getByText('Submit ranking').click()
    await waitFor(() => expect(api.submitRanking).toHaveBeenCalledWith('game-1', 1, ['c1', 'c2']))
    expect(api.getGame).toHaveBeenCalledTimes(2)
  })

  it('shows error when createEpisode fails', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.createEpisode).mockRejectedValue(new Error('Aanmaken mislukt'))
    renderWithAuth(mockAdmin)
    await screen.findByTestId('admin-episode-manager')
    screen.getByText('Create episode').click()
    expect(await screen.findByText('Aanmaken mislukt')).toBeInTheDocument()
  })

  it('shows error when revealMole fails', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.revealMole).mockRejectedValue(new Error('Onthullen mislukt'))
    renderWithAuth(mockAdmin)
    await screen.findByTestId('admin-episode-manager')
    screen.getByText('Reveal mole').click()
    expect(await screen.findByText('Onthullen mislukt')).toBeInTheDocument()
  })

  it('calls addContestants and reloads when admin adds a contestant', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.addContestants).mockResolvedValue(mockGame)
    renderWithAuth(mockAdmin)
    await screen.findByTestId('admin-contestant-manager')
    screen.getByText('Add contestant').click()
    await waitFor(() =>
      expect(api.addContestants).toHaveBeenCalledWith('game-1', [
        { name: 'Eve', age: 28, photoUrl: '' },
      ]),
    )
    expect(api.getGame).toHaveBeenCalledTimes(2)
  })

  it('shows error when addContestants fails', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.addContestants).mockRejectedValue(new Error('Toevoegen mislukt'))
    renderWithAuth(mockAdmin)
    await screen.findByTestId('admin-contestant-manager')
    screen.getByText('Add contestant').click()
    expect(await screen.findByText('Toevoegen mislukt')).toBeInTheDocument()
  })

  it('calls addContestants and reloads when admin loads season 14', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.addContestants).mockResolvedValue(mockGame)
    renderWithAuth(mockAdmin)
    await screen.findByTestId('admin-contestant-manager')
    screen.getByText('Load season 14').click()
    await waitFor(() => expect(api.addContestants).toHaveBeenCalled())
    expect(api.getGame).toHaveBeenCalledTimes(2)
  })

  it('shows error when load season 14 fails', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.addContestants).mockRejectedValue(new Error('Laden mislukt'))
    renderWithAuth(mockAdmin)
    await screen.findByTestId('admin-contestant-manager')
    screen.getByText('Load season 14').click()
    expect(await screen.findByText('Laden mislukt')).toBeInTheDocument()
  })

  it('shows error with default message when load season 14 fails with non-Error', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.addContestants).mockRejectedValue('oops')
    renderWithAuth(mockAdmin)
    await screen.findByTestId('admin-contestant-manager')
    screen.getByText('Load season 14').click()
    expect(await screen.findByText('Fout bij laden seizoen 14')).toBeInTheDocument()
  })

  it('falls back to empty rankings when getMyRankings fails', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getMyRankings).mockRejectedValue(new Error('unauthorized'))
    renderWithAuth(mockUser)
    expect(await screen.findByText('Testspel')).toBeInTheDocument()
  })

  it('fetches episode rankings when last episode deadline has passed', async () => {
    const pastDeadline = new Date(Date.now() - 1000).toISOString()
    const gameWithPastDeadline = {
      ...mockGame,
      episodes: [{ number: 1, deadline: pastDeadline, eliminatedContestantIds: [] }],
    }
    vi.mocked(api.getGame).mockResolvedValue(gameWithPastDeadline)
    vi.mocked(api.getEpisodeRankings).mockResolvedValue([])
    renderWithAuth(mockUser)
    await waitFor(() => expect(api.getEpisodeRankings).toHaveBeenCalledWith('game-1', 1))
  })
})
