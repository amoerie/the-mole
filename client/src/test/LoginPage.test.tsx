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

vi.mock('../lib/passwordless', () => ({
  passwordlessClient: {
    signinWithAlias: vi.fn(),
    register: vi.fn(),
  },
}))

vi.mock('../api/client', () => ({
  api: {
    verifyPasskey: vi.fn(),
    resetPasskey: vi.fn(),
  },
}))

import { passwordlessClient } from '../lib/passwordless'
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

  it('renders the login form', () => {
    renderLoginPage()
    expect(screen.getByLabelText('E-mailadres')).toBeInTheDocument()
    expect(screen.getByText('Inloggen met passkey')).toBeInTheDocument()
  })

  it('does not show register link without invite code', () => {
    renderLoginPage()
    expect(screen.queryByText('Nieuw account aanmaken →')).not.toBeInTheDocument()
    expect(screen.getByText('Kan niet inloggen?')).toBeInTheDocument()
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

  it('shows recovery UI when recovered=true', () => {
    renderLoginPage('/login?recovered=true')
    expect(screen.getByText('Nieuwe passkey instellen')).toBeInTheDocument()
    expect(screen.getByText('Nieuwe passkey aanmaken')).toBeInTheDocument()
    expect(screen.queryByLabelText('E-mailadres')).not.toBeInTheDocument()
  })

  it('does not show recovery UI when recovered is not set', () => {
    renderLoginPage()
    expect(screen.queryByText('Nieuwe passkey instellen')).not.toBeInTheDocument()
    expect(screen.getByLabelText('E-mailadres')).toBeInTheDocument()
  })

  it('calls resetPasskey and navigates home on recovery setup', async () => {
    vi.mocked(api.resetPasskey).mockResolvedValueOnce({ token: 'reg-tok', email: 'me@test.com' })
    vi.mocked(passwordlessClient.register).mockResolvedValueOnce({ error: undefined })
    renderLoginPage('/login?recovered=true')
    fireEvent.click(screen.getByText('Nieuwe passkey aanmaken'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  it('shows error when resetPasskey fails on recovery', async () => {
    vi.mocked(api.resetPasskey).mockRejectedValueOnce(new Error('Reset mislukt'))
    renderLoginPage('/login?recovered=true')
    fireEvent.click(screen.getByText('Nieuwe passkey aanmaken'))
    expect(await screen.findByText('Reset mislukt')).toBeInTheDocument()
  })

  it('shows error when email is empty and login clicked', async () => {
    renderLoginPage()
    fireEvent.click(screen.getByText('Inloggen met passkey'))
    expect(await screen.findByText('Voer je e-mailadres in.')).toBeInTheDocument()
  })

  it('navigates home on successful login', async () => {
    vi.mocked(passwordlessClient.signinWithAlias).mockResolvedValueOnce({
      token: 'tok',
      error: undefined,
    })
    vi.mocked(api.verifyPasskey).mockResolvedValueOnce({
      userId: '1',
      displayName: 'Test',
      roles: [],
    })
    renderLoginPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'test@test.com' },
    })
    fireEvent.click(screen.getByText('Inloggen met passkey'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
    expect(mockSetUser).toHaveBeenCalledWith({ userId: '1', displayName: 'Test', roles: [] })
  })

  it('shows error when passkey signin returns error', async () => {
    vi.mocked(passwordlessClient.signinWithAlias).mockResolvedValueOnce({
      token: undefined as unknown as string,
      error: { title: 'Passkey mislukt', type: 'err', status: 400, detail: '' },
    })
    renderLoginPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'test@test.com' },
    })
    fireEvent.click(screen.getByText('Inloggen met passkey'))
    expect(await screen.findByText('Passkey mislukt')).toBeInTheDocument()
  })

  it('shows fallback error when passkey error has no title', async () => {
    vi.mocked(passwordlessClient.signinWithAlias).mockResolvedValueOnce({
      token: undefined as unknown as string,
      error: { title: undefined as unknown as string, type: 'err', status: 400, detail: '' },
    })
    renderLoginPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'test@test.com' },
    })
    fireEvent.click(screen.getByText('Inloggen met passkey'))
    expect(await screen.findByText('Inloggen mislukt.')).toBeInTheDocument()
  })

  it('shows error on thrown exception', async () => {
    vi.mocked(passwordlessClient.signinWithAlias).mockRejectedValueOnce(new Error('Netwerkfout'))
    renderLoginPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'test@test.com' },
    })
    fireEvent.click(screen.getByText('Inloggen met passkey'))
    expect(await screen.findByText('Netwerkfout')).toBeInTheDocument()
  })

  it('shows generic error for non-Error exception', async () => {
    vi.mocked(passwordlessClient.signinWithAlias).mockRejectedValueOnce('string error')
    renderLoginPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'test@test.com' },
    })
    fireEvent.click(screen.getByText('Inloggen met passkey'))
    expect(await screen.findByText('Inloggen mislukt.')).toBeInTheDocument()
  })

  it('submits on Enter key press in email field', async () => {
    vi.mocked(passwordlessClient.signinWithAlias).mockResolvedValueOnce({
      token: 'tok',
      error: undefined,
    })
    vi.mocked(api.verifyPasskey).mockResolvedValueOnce({
      userId: '1',
      displayName: 'Test',
      roles: [],
    })
    renderLoginPage()
    const input = screen.getByLabelText('E-mailadres')
    fireEvent.change(input, { target: { value: 'test@test.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  it('shows loading state while signing in', async () => {
    vi.mocked(passwordlessClient.signinWithAlias).mockReturnValueOnce(new Promise(() => {}))
    renderLoginPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'test@test.com' },
    })
    fireEvent.click(screen.getByText('Inloggen met passkey'))
    expect(await screen.findByText('Bezig...')).toBeInTheDocument()
  })
})
