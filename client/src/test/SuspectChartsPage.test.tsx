import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SuspectChartsPage from '../pages/SuspectChartsPage'
import type { Game, EpisodeStat } from '../types'

vi.mock('../api/client', () => ({
  api: {
    getGame: vi.fn(),
    getSuspectStats: vi.fn(),
  },
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useParams: () => ({ gameId: 'game-1' }) }
})

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="bar-chart" data-count={data?.length}>
      {children}
    </div>
  ),
  Bar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Cell: () => null,
}))

import { api } from '../api/client'

const mockGame: Game = {
  id: 'game-1',
  name: 'Testspel',
  inviteCode: 'ABC123',
  adminUserId: 'admin-1',
  contestants: [
    { id: 'c1', name: 'Alice', age: 30, photoUrl: '' },
    { id: 'c2', name: 'Bob', age: 25, photoUrl: '' },
  ],
  episodes: [
    {
      number: 1,
      deadline: new Date(Date.now() - 1000).toISOString(),
      eliminatedContestantIds: [],
    },
  ],
}

const mockStats: EpisodeStat[] = [
  {
    episodeNumber: 1,
    stats: [
      { contestantId: 'c1', name: 'Alice', avgRank: 1.0, rankingCount: 2 },
      { contestantId: 'c2', name: 'Bob', avgRank: 2.0, rankingCount: 2 },
    ],
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <SuspectChartsPage />
    </MemoryRouter>,
  )
}

describe('SuspectChartsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeletons initially', () => {
    vi.mocked(api.getGame).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.getSuspectStats).mockReturnValue(new Promise(() => {}))
    renderPage()
    // Skeletons are shown while loading
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows error when getGame fails', async () => {
    vi.mocked(api.getGame).mockRejectedValue(new Error('Netwerkfout'))
    vi.mocked(api.getSuspectStats).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Netwerkfout')).toBeInTheDocument()
  })

  it('shows generic error on non-Error rejection', async () => {
    vi.mocked(api.getGame).mockRejectedValue('oops')
    vi.mocked(api.getSuspectStats).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Fout bij laden')).toBeInTheDocument()
  })

  it('shows error when getSuspectStats fails', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getSuspectStats).mockRejectedValue(new Error('Stats fout'))
    renderPage()
    expect(await screen.findByText('Stats fout')).toBeInTheDocument()
  })

  it('shows not-found alert when game is null', async () => {
    vi.mocked(api.getGame).mockResolvedValue(null as unknown as Game)
    vi.mocked(api.getSuspectStats).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Spel niet gevonden')).toBeInTheDocument()
  })

  it('shows empty state when no stats returned', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getSuspectStats).mockResolvedValue([])
    renderPage()
    expect(
      await screen.findByText('Nog geen afleveringen met een verstreken deadline.'),
    ).toBeInTheDocument()
  })

  it('shows chart heading for each episode with data', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getSuspectStats).mockResolvedValue(mockStats)
    renderPage()
    expect(await screen.findByText('Aflevering 1')).toBeInTheDocument()
  })

  it('shows back link to game page', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getSuspectStats).mockResolvedValue(mockStats)
    renderPage()
    await screen.findByText('Aflevering 1')
    expect(screen.getByText('Terug')).toBeInTheDocument()
  })

  it('shows chart with correct number of data points', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getSuspectStats).mockResolvedValue(mockStats)
    renderPage()
    await screen.findByText('Aflevering 1')
    const chart = screen.getByTestId('bar-chart')
    expect(chart.getAttribute('data-count')).toBe('2')
  })

  it('renders multiple episodes', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getSuspectStats).mockResolvedValue([
      ...mockStats,
      {
        episodeNumber: 2,
        stats: [{ contestantId: 'c1', name: 'Alice', avgRank: 1.0, rankingCount: 1 }],
      },
    ])
    renderPage()
    expect(await screen.findByText('Aflevering 1')).toBeInTheDocument()
    expect(await screen.findByText('Aflevering 2')).toBeInTheDocument()
  })
})
