import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../hooks/useAuth'
import ContestantDetailPage from '../pages/ContestantDetailPage'
import type { UserInfo, Game } from '../types'

vi.mock('../api/client', () => ({
  api: {
    getGame: vi.fn(),
    getNotebook: vi.fn(),
  },
}))

import { api } from '../api/client'

const mockUser: UserInfo = { userId: 'user-1', displayName: 'Alex', roles: ['authenticated'] }

const mockGame: Game = {
  id: 'game-1',
  name: 'Testspel',
  inviteCode: 'ABC123',
  adminUserId: 'admin-1',
  contestants: [
    {
      id: 'c1',
      name: 'Abigail',
      age: 33,
      photoUrl: '/contestants/abigail.png',
      highResPhotoUrl: '/contestants/abigail-hires.webp',
      bio: 'Abigail heeft wortels in Ghana.',
    },
    {
      id: 'c2',
      name: 'Dries',
      age: 30,
      photoUrl: '/contestants/dries.png',
    },
  ],
  episodes: [],
}

function renderPage(contestantId: string, user: UserInfo | null = mockUser) {
  return render(
    <AuthContext.Provider value={{ user, loading: false, error: null, setUser: () => {} }}>
      <MemoryRouter initialEntries={[`/game/game-1/contestant/${contestantId}`]}>
        <Routes>
          <Route path="/game/:gameId/contestant/:contestantId" element={<ContestantDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ContestantDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getNotebook).mockResolvedValue({ notebookColor: null, notes: [] })
  })

  it('shows loading skeleton initially', () => {
    vi.mocked(api.getGame).mockReturnValue(new Promise(() => {}))
    const { container } = renderPage('c1')
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders contestant name and age after load', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderPage('c1')
    expect(await screen.findByText('Abigail')).toBeInTheDocument()
    expect(screen.getByText('33 jaar')).toBeInTheDocument()
  })

  it('renders bio when present', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderPage('c1')
    expect(await screen.findByText('Abigail heeft wortels in Ghana.')).toBeInTheDocument()
  })

  it('does not render bio section when bio is absent', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderPage('c2')
    await screen.findByText('Dries')
    expect(screen.queryByText(/Ghana/)).not.toBeInTheDocument()
  })

  it('uses highResPhotoUrl as image src when present', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderPage('c1')
    await screen.findByText('Abigail')
    const img = screen.getByRole('img', { name: 'Abigail' }) as HTMLImageElement
    expect(img.src).toContain('abigail-hires.webp')
  })

  it('does not render image when highResPhotoUrl is absent', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderPage('c2')
    await screen.findByText('Dries')
    expect(screen.queryByRole('img', { name: 'Dries' })).not.toBeInTheDocument()
  })

  it('shows error alert when API call fails', async () => {
    vi.mocked(api.getGame).mockRejectedValue(new Error('Netwerkfout'))
    renderPage('c1')
    expect(await screen.findByText('Netwerkfout')).toBeInTheDocument()
  })

  it('shows "niet gevonden" when contestant ID has no match', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderPage('unknown-id')
    expect(await screen.findByText('Kandidaat niet gevonden')).toBeInTheDocument()
  })

  it('back button links to the game page', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderPage('c1')
    await screen.findByText('Abigail')
    const link = screen.getByRole('link', { name: /terug/i })
    expect(link).toHaveAttribute('href', '/game/game-1')
  })

  it('calls getGame with the correct gameId', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    renderPage('c1')
    await waitFor(() => expect(api.getGame).toHaveBeenCalledWith('game-1'))
  })

  it('shows "In jouw molboekje" section when a note mentions the contestant by first name', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getNotebook).mockResolvedValue({
      notebookColor: 'blue',
      notes: [
        {
          episodeNumber: 2,
          content: 'Abigail was acting very suspicious during challenge 1.',
          suspicionLevels: {},
          updatedAt: '2025-03-14T20:00:00Z',
        },
      ],
    })
    renderPage('c1')
    expect(await screen.findByText('In jouw molboekje')).toBeInTheDocument()
    expect(screen.getByText('Aflevering 2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /bekijk notitie/i })).toHaveAttribute(
      'href',
      '/game/game-1/molboekje',
    )
  })

  it('extracts a snippet around the first name mention, not the start of the note', async () => {
    const filler = 'x'.repeat(400)
    const noteContent = `${filler} Abigail deed iets verdachts. ${filler}`
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getNotebook).mockResolvedValue({
      notebookColor: null,
      notes: [{ episodeNumber: 1, content: noteContent, suspicionLevels: {}, updatedAt: '' }],
    })
    renderPage('c1')
    await screen.findByText('In jouw molboekje')
    expect(screen.getByText(/verdachts/)).toBeInTheDocument()
    // The start-of-note filler should not be shown
    expect(screen.queryByText(new RegExp(`^${filler.slice(0, 50)}`))).not.toBeInTheDocument()
  })

  it('omits "In jouw molboekje" section when no notes mention the contestant', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getNotebook).mockResolvedValue({
      notebookColor: null,
      notes: [
        {
          episodeNumber: 1,
          content: 'Dries was very quiet this episode.',
          suspicionLevels: {},
          updatedAt: '2025-03-07T20:00:00Z',
        },
      ],
    })
    renderPage('c1')
    await screen.findByText('Abigail')
    expect(screen.queryByText('In jouw molboekje')).not.toBeInTheDocument()
  })

  it('omits "In jouw molboekje" section when notebook fetch fails', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGame)
    vi.mocked(api.getNotebook).mockRejectedValue(new Error('forbidden'))
    renderPage('c1')
    await screen.findByText('Abigail')
    expect(screen.queryByText('In jouw molboekje')).not.toBeInTheDocument()
  })
})
