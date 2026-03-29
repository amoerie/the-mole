import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../hooks/useAuth'
import HomePage from '../pages/HomePage'
import type { UserInfo } from '../types'

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

const mockUser: UserInfo = {
  userId: 'user-123',
  displayName: 'TestUser',
  roles: ['authenticated'],
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
  })

  it('shows loading state', () => {
    renderWithAuth(null, true)
    expect(screen.getByText('Laden...')).toBeInTheDocument()
  })

  it('shows login button when not authenticated', () => {
    renderWithAuth(null)
    expect(screen.getByText('Inloggen')).toBeInTheDocument()
  })

  it('login link points to login page', () => {
    renderWithAuth(null)
    const loginLink = screen.getByText('Inloggen') as HTMLAnchorElement
    expect(loginLink.href).toContain('/login')
  })

  it('shows create and join sections when authenticated', () => {
    renderWithAuth(mockUser)
    expect(screen.getByText('Nieuw spel aanmaken')).toBeInTheDocument()
    expect(screen.getByText('Deelnemen aan spel')).toBeInTheDocument()
  })

  it('does not show login buttons when authenticated', () => {
    renderWithAuth(mockUser)
    expect(screen.queryByText('Inloggen')).not.toBeInTheDocument()
  })

  it('has a create game input and button', () => {
    renderWithAuth(mockUser)
    expect(screen.getByPlaceholderText('Spelnaam')).toBeInTheDocument()
    expect(screen.getByText('Aanmaken')).toBeInTheDocument()
  })

  it('has a join game input and button', () => {
    renderWithAuth(mockUser)
    expect(screen.getByPlaceholderText('Uitnodigingscode')).toBeInTheDocument()
    expect(screen.getByText('Deelnemen')).toBeInTheDocument()
  })
})
