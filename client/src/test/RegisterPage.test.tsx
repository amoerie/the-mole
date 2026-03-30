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

vi.mock('../api/client', () => ({
  api: {
    register: vi.fn(),
    joinGame: vi.fn(),
  },
}))

import { api } from '../api/client'

const mockSetUser = vi.fn()

function renderRegisterPage(state?: object) {
  return render(
    <AuthContext.Provider value={{ user: null, loading: false, error: null, setUser: mockSetUser }}>
      <MemoryRouter
        initialEntries={[{ pathname: '/register', state: state ?? { inviteCode: 'CODE123' } }]}
      >
        <RegisterPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email, name, password, and confirm password fields', () => {
    renderRegisterPage()
    expect(screen.getByLabelText('E-mailadres')).toBeInTheDocument()
    expect(screen.getByLabelText('Naam')).toBeInTheDocument()
    expect(screen.getByLabelText('Wachtwoord')).toBeInTheDocument()
    expect(screen.getByLabelText('Wachtwoord bevestigen')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Account aanmaken' })).toBeInTheDocument()
  })

  it('has a link back to login', () => {
    renderRegisterPage()
    expect(screen.getByText('← Terug naar inloggen')).toBeInTheDocument()
  })

  it('shows error when required fields are empty', async () => {
    renderRegisterPage()
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken' }))
    expect(
      await screen.findByText('E-mailadres, naam en wachtwoord zijn verplicht.'),
    ).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Naam'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord'), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord bevestigen'), { target: { value: 'xyz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken' }))
    expect(await screen.findByText('Wachtwoorden komen niet overeen.')).toBeInTheDocument()
  })

  it('navigates home after successful registration', async () => {
    vi.mocked(api.register).mockResolvedValueOnce({ userId: '1', displayName: 'Alice', roles: [] })
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Naam'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord'), { target: { value: 'secret' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord bevestigen'), {
      target: { value: 'secret' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
    expect(mockSetUser).toHaveBeenCalledWith({ userId: '1', displayName: 'Alice', roles: [] })
  })

  it('shows error on api exception', async () => {
    vi.mocked(api.register).mockRejectedValueOnce(new Error('Dit e-mailadres is al in gebruik.'))
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Naam'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord'), { target: { value: 'secret' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord bevestigen'), {
      target: { value: 'secret' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken' }))
    expect(await screen.findByText('Dit e-mailadres is al in gebruik.')).toBeInTheDocument()
  })

  it('shows generic error for non-Error exception', async () => {
    vi.mocked(api.register).mockRejectedValueOnce('oops')
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Naam'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord'), { target: { value: 'secret' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord bevestigen'), {
      target: { value: 'secret' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken' }))
    expect(await screen.findByText('Registratie mislukt.')).toBeInTheDocument()
  })

  it('shows loading state while registering', async () => {
    vi.mocked(api.register).mockReturnValueOnce(new Promise(() => {}))
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Naam'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord'), { target: { value: 'secret' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord bevestigen'), {
      target: { value: 'secret' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken' }))
    expect(await screen.findByText('Bezig...')).toBeInTheDocument()
  })

  it('submits on Enter key in confirm password field', async () => {
    vi.mocked(api.register).mockResolvedValueOnce({ userId: '1', displayName: 'Alice', roles: [] })
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Naam'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord'), { target: { value: 'secret' } })
    const confirm = screen.getByLabelText('Wachtwoord bevestigen')
    fireEvent.change(confirm, { target: { value: 'secret' } })
    fireEvent.keyDown(confirm, { key: 'Enter' })
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })
})
