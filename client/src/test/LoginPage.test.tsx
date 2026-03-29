import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
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
  },
}))

vi.mock('../api/client', () => ({
  api: {
    verifyPasskey: vi.fn(),
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

  it('has links to register and recover', () => {
    renderLoginPage()
    expect(screen.getByText('Nieuw account aanmaken →')).toBeInTheDocument()
    expect(screen.getByText('Kan niet inloggen?')).toBeInTheDocument()
  })

  it('shows recovery info message when recovered=true', () => {
    renderLoginPage('/login?recovered=true')
    expect(screen.getByText(/Je bent hersteld/)).toBeInTheDocument()
  })

  it('does not show recovery info when recovered is not set', () => {
    renderLoginPage()
    expect(screen.queryByText(/Je bent hersteld/)).not.toBeInTheDocument()
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
