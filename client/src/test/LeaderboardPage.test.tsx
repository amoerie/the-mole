import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import LeaderboardPage from '../pages/LeaderboardPage'
import type { Game } from '../types'

vi.mock('../api/client', () => ({
  api: {
    getGame: vi.fn(),
    getLeaderboard: vi.fn(),
    getWhatIfLeaderboard: vi.fn(),
  },
}))

import { api } from '../api/client'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useParams: () => ({ gameId: 'game-1' }) }
})

const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

const mockGame: Game = {
  id: 'game-1',
  name: 'Testspel',
  inviteCode: 'ABC123',
  adminUserId: 'admin-1',
  moleContestantId: undefined,
  contestants: [
    { id: 'c1', name: 'Alice', age: 30, photoUrl: '' },
    { id: 'c2', name: 'Bob', age: 25, photoUrl: '', eliminatedInEpisode: 1 },
    { id: 'c3', name: 'Charlie', age: 35, photoUrl: '' },
  ],
  episodes: [{ number: 1, deadline: futureDeadline, eliminatedContestantIds: ['c2'] }],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <LeaderboardPage />
    </MemoryRouter>,
  )
}

describe('LeaderboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getLeaderboard).mockResolvedValue([])
  })

  it('shows only non-eliminated contestants in the what-if dropdown', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderPage()
    await screen.findByLabelText(/wat als de mol is/i)
    expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Charlie' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Bob' })).not.toBeInTheDocument()
  })

  it('fetches what-if leaderboard when a contestant is selected', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getWhatIfLeaderboard).mockResolvedValue([])
    renderPage()
    await screen.findByLabelText(/wat als de mol is/i)
    await userEvent.selectOptions(screen.getByLabelText(/wat als de mol is/i), 'c1')
    await waitFor(() => expect(api.getWhatIfLeaderboard).toHaveBeenCalledWith('game-1', 'c1'))
  })

  it('shows mole reveal when moleContestantId is set instead of what-if selector', async () => {
    vi.mocked(api.getGame).mockResolvedValue({ ...mockGame, moleContestantId: 'c1' })
    renderPage()
    expect(await screen.findByText(/de mol was/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/wat als de mol is/i)).not.toBeInTheDocument()
  })

  it('shows error when game fails to load', async () => {
    vi.mocked(api.getGame).mockRejectedValue(new Error('Netwerkfout'))
    renderPage()
    expect(await screen.findByText('Netwerkfout')).toBeInTheDocument()
  })

  it('shows generic error when game fails to load with non-Error', async () => {
    vi.mocked(api.getGame).mockRejectedValue('oops')
    renderPage()
    expect(await screen.findByText('Fout bij laden')).toBeInTheDocument()
  })

  it('shows not-found alert when game is null after loading', async () => {
    vi.mocked(api.getGame).mockResolvedValue(null as unknown as Game)
    renderPage()
    expect(await screen.findByText('Spel niet gevonden')).toBeInTheDocument()
  })

  it('shows error when what-if leaderboard fails', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getWhatIfLeaderboard).mockRejectedValue(new Error('Ophalen mislukt'))
    renderPage()
    await screen.findByLabelText(/wat als de mol is/i)
    await userEvent.selectOptions(screen.getByLabelText(/wat als de mol is/i), 'c1')
    expect(await screen.findByText('Ophalen mislukt')).toBeInTheDocument()
  })

  it('shows leaderboard table with episode scores', async () => {
    const gameWithEpisode = {
      ...mockGame,
      episodes: [
        {
          number: 1,
          deadline: new Date(Date.now() - 1000).toISOString(),
          eliminatedContestantIds: [],
        },
      ],
    }
    vi.mocked(api.getGame).mockResolvedValue(gameWithEpisode)
    vi.mocked(api.getLeaderboard).mockResolvedValue([
      {
        userId: 'u1',
        displayName: 'Alice',
        totalScore: 10,
        episodeScores: [{ episodeNumber: 1, score: 10, rankGiven: 1, totalContestants: 3 }],
      },
      {
        userId: 'u2',
        displayName: 'Bob',
        totalScore: 5,
        episodeScores: [],
      },
    ])
    renderPage()
    expect(await screen.findAllByText('Alice')).not.toHaveLength(0)
    expect(screen.getAllByText('Bob')).not.toHaveLength(0)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows empty state message when leaderboard is empty and mole is not revealed', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderPage()
    expect(
      await screen.findByText('Selecteer een kandidaat om het hypothetisch klassement te zien.'),
    ).toBeInTheDocument()
  })

  it('shows empty state message when leaderboard is empty and mole is revealed', async () => {
    vi.mocked(api.getGame).mockResolvedValue({ ...mockGame, moleContestantId: 'c1' })
    renderPage()
    expect(await screen.findByText('Nog geen scores beschikbaar.')).toBeInTheDocument()
  })
})
