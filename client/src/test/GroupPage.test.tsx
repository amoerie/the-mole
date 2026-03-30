import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import GroupPage from '../pages/GroupPage'
import type { Game, GamePlayer, PlayerRanking } from '../types'

vi.mock('../api/client', () => ({
  api: {
    getGame: vi.fn(),
    getGamePlayers: vi.fn(),
    getEpisodeRankings: vi.fn(),
  },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'player-1', displayName: 'Alice', roles: ['authenticated'] } }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useParams: () => ({ gameId: 'game-1' }) }
})

import { api } from '../api/client'

const pastDeadline = new Date(Date.now() - 1000).toISOString()
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
  episodes: [{ number: 1, deadline: pastDeadline, eliminatedContestantIds: [] }],
}

const mockPlayers: GamePlayer[] = [
  {
    id: 'p1',
    gameId: 'game-1',
    userId: 'player-1',
    displayName: 'Alice',
    joinedAt: new Date().toISOString(),
  },
  {
    id: 'p2',
    gameId: 'game-1',
    userId: 'player-2',
    displayName: 'Bob',
    joinedAt: new Date().toISOString(),
  },
]

const mockRankings: PlayerRanking[] = [
  {
    userId: 'player-1',
    displayName: 'Alice',
    contestantIds: ['c1', 'c2'],
    submittedAt: new Date().toISOString(),
  },
  {
    userId: 'player-2',
    displayName: 'Bob',
    contestantIds: ['c2', 'c1'],
    submittedAt: new Date().toISOString(),
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <GroupPage />
    </MemoryRouter>,
  )
}

describe('GroupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    vi.mocked(api.getGame).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.getGamePlayers).mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows error when getGame fails', async () => {
    vi.mocked(api.getGame).mockRejectedValue(new Error('Netwerkfout'))
    vi.mocked(api.getGamePlayers).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Netwerkfout')).toBeInTheDocument()
  })

  it('shows generic error on non-Error rejection', async () => {
    vi.mocked(api.getGame).mockRejectedValue('oops')
    vi.mocked(api.getGamePlayers).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Fout bij laden')).toBeInTheDocument()
  })

  it('shows not-found alert when game is null', async () => {
    vi.mocked(api.getGame).mockResolvedValue(null as unknown as Game)
    vi.mocked(api.getGamePlayers).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Spel niet gevonden')).toBeInTheDocument()
  })

  it('shows empty state when no players', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getGamePlayers).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Nog geen spelers.')).toBeInTheDocument()
  })

  it('renders player names', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    renderPage()
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('marks current user with "Jij" badge', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    renderPage()
    await screen.findByText('Alice')
    expect(screen.getByText('Jij')).toBeInTheDocument()
  })

  it('expands player row and shows rankings after click', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    vi.mocked(api.getEpisodeRankings).mockResolvedValue(mockRankings)
    renderPage()
    await screen.findByText('Alice')
    await userEvent.click(screen.getAllByRole('button')[0])
    await waitFor(() => expect(api.getEpisodeRankings).toHaveBeenCalledWith('game-1', 1))
    expect(await screen.findByText('Aflevering 1')).toBeInTheDocument()
  })

  it('shows contestant names in ranking order', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    vi.mocked(api.getEpisodeRankings).mockResolvedValue(mockRankings)
    renderPage()
    await screen.findByText('Alice')
    await userEvent.click(screen.getAllByRole('button')[0])
    await screen.findByText('Aflevering 1')
    // Alice's ranking has c1 first
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Alice')
    expect(items[1]).toHaveTextContent('Bob')
  })

  it('collapses expanded player row when clicked again', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    vi.mocked(api.getEpisodeRankings).mockResolvedValue(mockRankings)
    renderPage()
    await screen.findByText('Alice')
    const firstButton = screen.getAllByRole('button')[0]
    await userEvent.click(firstButton)
    await screen.findByText('Aflevering 1')
    await userEvent.click(firstButton)
    await waitFor(() => expect(screen.queryByText('Aflevering 1')).not.toBeInTheDocument())
  })

  it('shows no-ranking message when player has no ranking for episode', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    vi.mocked(api.getEpisodeRankings).mockResolvedValue([])
    renderPage()
    await screen.findByText('Alice')
    await userEvent.click(screen.getAllByRole('button')[0])
    expect(await screen.findByText('Geen rangschikking ingediend.')).toBeInTheDocument()
  })

  it('shows no deadline message when no episodes have passed', async () => {
    const gameNoDeadline = {
      ...mockGame,
      episodes: [{ number: 1, deadline: futureDeadline, eliminatedContestantIds: [] }],
    }
    vi.mocked(api.getGame).mockResolvedValue(gameNoDeadline)
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    renderPage()
    await screen.findByText('Alice')
    await userEvent.click(screen.getAllByRole('button')[0])
    expect(
      await screen.findByText('Nog geen afleveringen met een verstreken deadline.'),
    ).toBeInTheDocument()
  })
})
