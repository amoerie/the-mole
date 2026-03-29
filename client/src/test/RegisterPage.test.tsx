import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../hooks/useAuth'
import RegisterPage from '../pages/RegisterPage'

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../lib/passwordless', () => ({
  passwordlessClient: {
    register: vi.fn(),
    signinWithAlias: vi.fn(),
  },
}))

vi.mock('../api/client', () => ({
  api: {
    registerPasskey: vi.fn(),
    verifyPasskey: vi.fn(),
  },
}))

import { passwordlessClient } from '../lib/passwordless'
import { api } from '../api/client'

const mockSetUser = vi.fn()

function renderRegisterPage() {
  return render(
    <AuthContext.Provider value={{ user: null, loading: false, error: null, setUser: mockSetUser }}>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the registration form', () => {
    renderRegisterPage()
    expect(screen.getByLabelText('E-mailadres')).toBeInTheDocument()
    expect(screen.getByLabelText(/Naam/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Account aanmaken' })).toBeInTheDocument()
  })

  it('has a link back to login', () => {
    renderRegisterPage()
    expect(screen.getByText('← Terug naar inloggen')).toBeInTheDocument()
  })

  it('shows error when both fields are empty', async () => {
    renderRegisterPage()
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken' }))
    expect(await screen.findByText('E-mailadres en naam zijn verplicht.')).toBeInTheDocument()
  })

  it('shows error when only email is filled', async () => {
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'alice@test.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken' }))
    expect(await screen.findByText('E-mailadres en naam zijn verplicht.')).toBeInTheDocument()
  })

  it('navigates home after successful registration', async () => {
    vi.mocked(api.registerPasskey).mockResolvedValueOnce({ token: 'reg-token' })
    vi.mocked(passwordlessClient.register).mockResolvedValueOnce({ error: undefined })
    vi.mocked(passwordlessClient.signinWithAlias).mockResolvedValueOnce({
      token: 'auth-token',
      error: undefined,
    })
    vi.mocked(api.verifyPasskey).mockResolvedValueOnce({
      userId: '1',
      displayName: 'Alice',
      roles: [],
    })
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'alice@test.com' },
    })
    fireEvent.change(screen.getByLabelText(/Naam/), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
    expect(mockSetUser).toHaveBeenCalledWith({ userId: '1', displayName: 'Alice', roles: [] })
  })

  it('navigates to login when signin after register fails', async () => {
    vi.mocked(api.registerPasskey).mockResolvedValueOnce({ token: 'reg-token' })
    vi.mocked(passwordlessClient.register).mockResolvedValueOnce({ error: undefined })
    vi.mocked(passwordlessClient.signinWithAlias).mockResolvedValueOnce({
      token: undefined as unknown as string,
      error: { title: 'Passkey fout', type: 'err', status: 400, detail: '' },
    })
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'alice@test.com' },
    })
    fireEvent.change(screen.getByLabelText(/Naam/), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
  })

  it('shows error when passkey registration fails', async () => {
    vi.mocked(api.registerPasskey).mockResolvedValueOnce({ token: 'reg-token' })
    vi.mocked(passwordlessClient.register).mockResolvedValueOnce({
      error: { title: 'Passkey aanmaken mislukt', type: 'err', status: 400, detail: '' },
    })
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'alice@test.com' },
    })
    fireEvent.change(screen.getByLabelText(/Naam/), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken' }))
    expect(await screen.findByText('Passkey aanmaken mislukt')).toBeInTheDocument()
  })

  it('shows error on api exception', async () => {
    vi.mocked(api.registerPasskey).mockRejectedValueOnce(new Error('Server error'))
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'alice@test.com' },
    })
    fireEvent.change(screen.getByLabelText(/Naam/), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken' }))
    expect(await screen.findByText('Server error')).toBeInTheDocument()
  })

  it('shows generic error for non-Error exception', async () => {
    vi.mocked(api.registerPasskey).mockRejectedValueOnce('something')
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'alice@test.com' },
    })
    fireEvent.change(screen.getByLabelText(/Naam/), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken' }))
    expect(await screen.findByText('Registratie mislukt.')).toBeInTheDocument()
  })

  it('shows loading state while registering', async () => {
    vi.mocked(api.registerPasskey).mockReturnValueOnce(new Promise(() => {}))
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'alice@test.com' },
    })
    fireEvent.change(screen.getByLabelText(/Naam/), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken' }))
    expect(await screen.findByText('Bezig...')).toBeInTheDocument()
  })

  it('submits on Enter key press in name field', async () => {
    vi.mocked(api.registerPasskey).mockResolvedValueOnce({ token: 'reg-token' })
    vi.mocked(passwordlessClient.register).mockResolvedValueOnce({ error: undefined })
    vi.mocked(passwordlessClient.signinWithAlias).mockResolvedValueOnce({
      token: 'auth-token',
      error: undefined,
    })
    vi.mocked(api.verifyPasskey).mockResolvedValueOnce({
      userId: '1',
      displayName: 'Alice',
      roles: [],
    })
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'alice@test.com' },
    })
    const nameInput = screen.getByLabelText(/Naam/)
    fireEvent.change(nameInput, { target: { value: 'Alice' } })
    fireEvent.keyDown(nameInput, { key: 'Enter' })
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })
})
