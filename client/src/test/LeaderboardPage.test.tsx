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
})
