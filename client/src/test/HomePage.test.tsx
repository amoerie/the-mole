import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../hooks/useAuth'
import HomePage from '../pages/HomePage'
import type { UserInfo, Game } from '../types'

// Mock the api module
vi.mock('../api/client', () => ({
  api: {
    getMe: vi.fn(),
    getMyGames: vi.fn().mockRejectedValue(new Error('not available')),
    createGame: vi.fn(),
    getGame: vi.fn(),
    getGameByInvite: vi.fn(),
    joinGame: vi.fn(),
  },
}))

import { api } from '../api/client'

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockUser: UserInfo = {
  userId: 'user-123',
  displayName: 'TestUser',
  roles: ['authenticated'],
}

const mockAdminUser: UserInfo = {
  userId: 'admin-123',
  displayName: 'AdminUser',
  roles: ['authenticated', 'admin'],
}

const mockGame: Game = {
  id: 'game-1',
  name: 'Testspel',
  inviteCode: 'abc123',
  adminUserId: 'user-123',
  contestants: [{ id: 'c1', name: 'Alice', age: 30, photoUrl: '/a.jpg' }],
  episodes: [],
}

function renderWithAuth(user: UserInfo | null, loading = false) {
  return render(
    <AuthContext.Provider value={{ user, loading, error: null, setUser: () => {} }}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('HomePage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(api.getMyGames).mockRejectedValue(new Error('not available'))
    vi.mocked(api.getGame).mockResolvedValue({
      id: 'g',
      name: '',
      adminUserId: '',
      inviteCode: '',
      contestants: [],
      episodes: [],
    })
  })

  it('shows loading state', () => {
    renderWithAuth(null, true)
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
  })

  it('redirects to /join when not authenticated', () => {
    renderWithAuth(null)
    expect(mockNavigate).toHaveBeenCalledWith('/join')
  })

  it('shows create and join sections when authenticated as admin', () => {
    renderWithAuth(mockAdminUser)
    expect(screen.getByText('Nieuw spel aanmaken')).toBeInTheDocument()
    expect(screen.getByText('Deelnemen aan spel')).toBeInTheDocument()
  })

  it('does not show create game section for non-admin', () => {
    renderWithAuth(mockUser)
    expect(screen.queryByText('Nieuw spel aanmaken')).not.toBeInTheDocument()
    expect(screen.getByText('Deelnemen aan spel')).toBeInTheDocument()
  })

  it('does not show login buttons when authenticated', () => {
    renderWithAuth(mockUser)
    expect(screen.queryByText('Inloggen')).not.toBeInTheDocument()
  })

  it('has a create game input and button', () => {
    renderWithAuth(mockAdminUser)
    expect(screen.getByPlaceholderText('Spelnaam')).toBeInTheDocument()
    expect(screen.getByText('Aanmaken')).toBeInTheDocument()
  })

  it('has a join game input and button', () => {
    renderWithAuth(mockUser)
    expect(screen.getByPlaceholderText('Uitnodigingscode')).toBeInTheDocument()
    expect(screen.getByText('Deelnemen')).toBeInTheDocument()
  })

  it('creates a game and navigates to it', async () => {
    vi.mocked(api.createGame).mockResolvedValueOnce(mockGame)
    renderWithAuth(mockAdminUser)
    fireEvent.change(screen.getByPlaceholderText('Spelnaam'), {
      target: { value: 'Testspel' },
    })
    fireEvent.click(screen.getByText('Aanmaken'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/game/game-1'))
  })

  it('shows error when create game fails', async () => {
    vi.mocked(api.createGame).mockRejectedValueOnce(new Error('Fout bij aanmaken'))
    renderWithAuth(mockAdminUser)
    fireEvent.change(screen.getByPlaceholderText('Spelnaam'), {
      target: { value: 'Testspel' },
    })
    fireEvent.click(screen.getByText('Aanmaken'))
    expect(await screen.findByText('Fout bij aanmaken')).toBeInTheDocument()
  })

  it('does not create a game when name is empty', async () => {
    renderWithAuth(mockAdminUser)
    fireEvent.click(screen.getByText('Aanmaken'))
    expect(api.createGame).not.toHaveBeenCalled()
  })

  it('joins a game by invite code and navigates', async () => {
    vi.mocked(api.getGameByInvite).mockResolvedValueOnce(mockGame)
    vi.mocked(api.joinGame).mockResolvedValueOnce(undefined)
    renderWithAuth(mockUser)
    fireEvent.change(screen.getByPlaceholderText('Uitnodigingscode'), {
      target: { value: 'abc123' },
    })
    fireEvent.click(screen.getByText('Deelnemen'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/game/game-1'))
  })

  it('shows error when joining with invalid invite code', async () => {
    vi.mocked(api.getGameByInvite).mockRejectedValueOnce(new Error('Ongeldige code'))
    renderWithAuth(mockUser)
    fireEvent.change(screen.getByPlaceholderText('Uitnodigingscode'), {
      target: { value: 'badcode' },
    })
    fireEvent.click(screen.getByText('Deelnemen'))
    expect(await screen.findByText('Ongeldige code')).toBeInTheDocument()
  })

  it('does not join when invite code is empty', () => {
    renderWithAuth(mockUser)
    fireEvent.click(screen.getByText('Deelnemen'))
    expect(api.getGameByInvite).not.toHaveBeenCalled()
  })

  it('creates game on Enter key press', async () => {
    vi.mocked(api.createGame).mockResolvedValueOnce(mockGame)
    renderWithAuth(mockAdminUser)
    const input = screen.getByPlaceholderText('Spelnaam')
    fireEvent.change(input, { target: { value: 'Testspel' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/game/game-1'))
  })

  it('joins game on Enter key press', async () => {
    vi.mocked(api.getGameByInvite).mockResolvedValueOnce(mockGame)
    vi.mocked(api.joinGame).mockResolvedValueOnce(undefined)
    renderWithAuth(mockUser)
    const input = screen.getByPlaceholderText('Uitnodigingscode')
    fireEvent.change(input, { target: { value: 'abc123' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/game/game-1'))
  })

  it('shows games list when getMyGames succeeds', async () => {
    vi.mocked(api.getMyGames).mockResolvedValueOnce([mockGame])
    renderWithAuth(mockUser)
    expect(await screen.findByText('Testspel')).toBeInTheDocument()
    expect(screen.getByText('Mijn spellen')).toBeInTheDocument()
  })

  it('navigates to game when game button is clicked', async () => {
    vi.mocked(api.getMyGames).mockResolvedValueOnce([mockGame])
    renderWithAuth(mockUser)
    const gameButton = await screen.findByText('Testspel')
    fireEvent.click(gameButton)
    expect(mockNavigate).toHaveBeenCalledWith('/game/game-1')
  })
})
