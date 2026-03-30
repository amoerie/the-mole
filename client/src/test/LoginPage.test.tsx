import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext } from '../hooks/useAuth'
import LoginPage from '../pages/LoginPage'

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../api/client', () => ({
  api: {
    login: vi.fn(),
    joinGame: vi.fn(),
  },
}))

import { api } from '../api/client'

const mockSetUser = vi.fn()

function renderLoginPage(path = '/login') {
  return render(
    <AuthContext.Provider value={{ user: null, loading: false, error: null, setUser: mockSetUser }}>
      <MemoryRouter initialEntries={[path]}>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email and password fields', () => {
    renderLoginPage()
    expect(screen.getByLabelText('E-mailadres')).toBeInTheDocument()
    expect(screen.getByLabelText('Wachtwoord')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inloggen' })).toBeInTheDocument()
  })

  it('shows forgot password link', () => {
    renderLoginPage()
    expect(screen.getByText('Wachtwoord vergeten?')).toBeInTheDocument()
  })

  it('does not show register link without invite code', () => {
    renderLoginPage()
    expect(screen.queryByText('Nieuw account aanmaken →')).not.toBeInTheDocument()
  })

  it('shows register link when invite code is in state', () => {
    render(
      <AuthContext.Provider value={{ user: null, loading: false, error: null, setUser: vi.fn() }}>
        <MemoryRouter initialEntries={[{ pathname: '/login', state: { inviteCode: 'abc123' } }]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(screen.getByText('Nieuw account aanmaken →')).toBeInTheDocument()
  })

  it('shows validation error when fields are empty', async () => {
    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: 'Inloggen' }))
    expect(await screen.findByText('Voer je e-mailadres en wachtwoord in.')).toBeInTheDocument()
  })

  it('shows validation error when only email is filled', async () => {
    renderLoginPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Inloggen' }))
    expect(await screen.findByText('Voer je e-mailadres en wachtwoord in.')).toBeInTheDocument()
  })

  it('navigates home on successful login', async () => {
    vi.mocked(api.login).mockResolvedValueOnce({ userId: '1', displayName: 'Alice', roles: [] })
    renderLoginPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Inloggen' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
    expect(mockSetUser).toHaveBeenCalledWith({ userId: '1', displayName: 'Alice', roles: [] })
  })

  it('shows error on failed login', async () => {
    vi.mocked(api.login).mockRejectedValueOnce(new Error('Unauthorized'))
    renderLoginPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Inloggen' }))
    expect(await screen.findByText('E-mailadres of wachtwoord is onjuist.')).toBeInTheDocument()
  })

  it('submits on Enter key in password field', async () => {
    vi.mocked(api.login).mockResolvedValueOnce({ userId: '1', displayName: 'Alice', roles: [] })
    renderLoginPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    const pwd = screen.getByLabelText('Wachtwoord')
    fireEvent.change(pwd, { target: { value: 'secret' } })
    fireEvent.keyDown(pwd, { key: 'Enter' })
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  it('shows loading state while logging in', async () => {
    vi.mocked(api.login).mockReturnValueOnce(new Promise(() => {}))
    renderLoginPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Inloggen' }))
    expect(await screen.findByText('Bezig...')).toBeInTheDocument()
  })

  it('joins game and navigates to it after login when gameId and inviteCode are in state', async () => {
    vi.mocked(api.login).mockResolvedValueOnce({ userId: '1', displayName: 'Alice', roles: [] })
    vi.mocked(api.joinGame).mockResolvedValueOnce(undefined)
    render(
      <AuthContext.Provider
        value={{ user: null, loading: false, error: null, setUser: mockSetUser }}
      >
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/login',
              state: { gameId: 'g1', inviteCode: 'abc', gameName: 'Testspel' },
            },
          ]}
        >
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(screen.getByText('Testspel')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Inloggen' }))
    await waitFor(() => expect(api.joinGame).toHaveBeenCalledWith('g1', 'abc'))
    expect(mockNavigate).toHaveBeenCalledWith('/game/g1')
  })
})
