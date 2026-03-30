import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import GroupMembers from '../components/GroupMembers'
import type { Game, GamePlayer, PlayerRanking } from '../types'

vi.mock('../api/client', () => ({
  api: {
    getGamePlayers: vi.fn(),
    getEpisodeRankings: vi.fn(),
  },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'player-1', displayName: 'Alice', roles: ['authenticated'] } }),
}))

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

function renderComponent(game: Game = mockGame) {
  return render(<GroupMembers game={game} />)
}

async function open() {
  await userEvent.click(screen.getByRole('button', { name: /groep/i }))
}

describe('GroupMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders collapsed by default', () => {
    renderComponent()
    expect(screen.getByRole('button', { name: /groep/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })

  it('shows loading skeletons while fetching players', async () => {
    vi.mocked(api.getGamePlayers).mockReturnValue(new Promise(() => {}))
    renderComponent()
    await open()
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows error when getGamePlayers fails', async () => {
    vi.mocked(api.getGamePlayers).mockRejectedValue(new Error('Netwerkfout'))
    renderComponent()
    await open()
    expect(await screen.findByText('Netwerkfout')).toBeInTheDocument()
  })

  it('shows generic error on non-Error rejection', async () => {
    vi.mocked(api.getGamePlayers).mockRejectedValue('oops')
    renderComponent()
    await open()
    expect(await screen.findByText('Fout bij laden')).toBeInTheDocument()
  })

  it('shows empty state when no players', async () => {
    vi.mocked(api.getGamePlayers).mockResolvedValue([])
    renderComponent()
    await open()
    expect(await screen.findByText('Nog geen spelers.')).toBeInTheDocument()
  })

  it('renders player names after opening', async () => {
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    renderComponent()
    await open()
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('marks current user with "Jij" badge', async () => {
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    renderComponent()
    await open()
    await screen.findByText('Alice')
    expect(screen.getByText('Jij')).toBeInTheDocument()
  })

  it('does not refetch players when closed and reopened', async () => {
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    renderComponent()
    await open()
    await screen.findByText('Alice')
    await userEvent.click(screen.getByRole('button', { name: /groep/i }))
    await userEvent.click(screen.getByRole('button', { name: /groep/i }))
    expect(api.getGamePlayers).toHaveBeenCalledTimes(1)
  })

  it('expands player row and fetches episode rankings', async () => {
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    vi.mocked(api.getEpisodeRankings).mockResolvedValue(mockRankings)
    renderComponent()
    await open()
    await screen.findByText('Alice')
    await userEvent.click(screen.getAllByRole('button')[1])
    await waitFor(() => expect(api.getEpisodeRankings).toHaveBeenCalledWith('game-1', 1))
    expect(await screen.findByText('Aflevering 1')).toBeInTheDocument()
  })

  it('shows contestant names in ranking order', async () => {
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    vi.mocked(api.getEpisodeRankings).mockResolvedValue(mockRankings)
    renderComponent()
    await open()
    await screen.findByText('Alice')
    await userEvent.click(screen.getAllByRole('button')[1])
    await screen.findByText('Aflevering 1')
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Alice')
    expect(items[1]).toHaveTextContent('Bob')
  })

  it('collapses expanded player row when clicked again', async () => {
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    vi.mocked(api.getEpisodeRankings).mockResolvedValue(mockRankings)
    renderComponent()
    await open()
    await screen.findByText('Alice')
    const playerButton = screen.getAllByRole('button')[1]
    await userEvent.click(playerButton)
    await screen.findByText('Aflevering 1')
    await userEvent.click(playerButton)
    await waitFor(() => expect(screen.queryByText('Aflevering 1')).not.toBeInTheDocument())
  })

  it('shows no-ranking message when player has no ranking for episode', async () => {
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    vi.mocked(api.getEpisodeRankings).mockResolvedValue([])
    renderComponent()
    await open()
    await screen.findByText('Alice')
    await userEvent.click(screen.getAllByRole('button')[1])
    expect(await screen.findByText('Geen rangschikking ingediend.')).toBeInTheDocument()
  })

  it('shows no-deadline message when no episodes have passed', async () => {
    const gameNoDeadline = {
      ...mockGame,
      episodes: [{ number: 1, deadline: futureDeadline, eliminatedContestantIds: [] }],
    }
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    renderComponent(gameNoDeadline)
    await open()
    await screen.findByText('Alice')
    await userEvent.click(screen.getAllByRole('button')[1])
    expect(
      await screen.findByText('Nog geen afleveringen met een verstreken deadline.'),
    ).toBeInTheDocument()
  })

  it('shows episode error when getEpisodeRankings fails', async () => {
    vi.mocked(api.getGamePlayers).mockResolvedValue(mockPlayers)
    vi.mocked(api.getEpisodeRankings).mockRejectedValue(new Error('Rankingfout'))
    renderComponent()
    await open()
    await screen.findByText('Alice')
    await userEvent.click(screen.getAllByRole('button')[1])
    expect(await screen.findByText('Rankingfout')).toBeInTheDocument()
  })
})
