import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../hooks/useAuth'
import ResetPasswordPage from '../pages/ResetPasswordPage'

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../api/client', () => ({
  api: {
    resetPassword: vi.fn(),
  },
}))

import { api } from '../api/client'

const mockSetUser = vi.fn()

function renderPage(token = 'validtoken') {
  return render(
    <AuthContext.Provider value={{ user: null, loading: false, error: null, setUser: mockSetUser }}>
      <MemoryRouter initialEntries={[`/reset-password?token=${token}`]}>
        <ResetPasswordPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders password and confirm password fields', () => {
    renderPage()
    expect(screen.getByLabelText('Nieuw wachtwoord')).toBeInTheDocument()
    expect(screen.getByLabelText('Wachtwoord bevestigen')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wachtwoord opslaan' })).toBeInTheDocument()
  })

  it('shows error when fields are empty', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Wachtwoord opslaan' }))
    expect(await screen.findByText('Vul beide wachtwoordvelden in.')).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Nieuw wachtwoord'), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord bevestigen'), { target: { value: 'xyz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Wachtwoord opslaan' }))
    expect(await screen.findByText('Wachtwoorden komen niet overeen.')).toBeInTheDocument()
  })

  it('navigates home on success', async () => {
    vi.mocked(api.resetPassword).mockResolvedValueOnce({
      userId: '1',
      displayName: 'Alice',
      roles: [],
    })
    renderPage()
    fireEvent.change(screen.getByLabelText('Nieuw wachtwoord'), { target: { value: 'newpass' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord bevestigen'), {
      target: { value: 'newpass' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Wachtwoord opslaan' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
    expect(mockSetUser).toHaveBeenCalledWith({ userId: '1', displayName: 'Alice', roles: [] })
  })

  it('shows error when token is invalid or expired', async () => {
    vi.mocked(api.resetPassword).mockRejectedValueOnce(new Error('BadRequest'))
    renderPage()
    fireEvent.change(screen.getByLabelText('Nieuw wachtwoord'), { target: { value: 'newpass' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord bevestigen'), {
      target: { value: 'newpass' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Wachtwoord opslaan' }))
    expect(await screen.findByText('De herstellink is ongeldig of verlopen.')).toBeInTheDocument()
  })

  it('shows error when token is missing', async () => {
    renderPage('')
    fireEvent.change(screen.getByLabelText('Nieuw wachtwoord'), { target: { value: 'newpass' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord bevestigen'), {
      target: { value: 'newpass' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Wachtwoord opslaan' }))
    expect(await screen.findByText('Ongeldige herstellink.')).toBeInTheDocument()
  })

  it('submits on Enter key in confirm field', async () => {
    vi.mocked(api.resetPassword).mockResolvedValueOnce({
      userId: '1',
      displayName: 'Alice',
      roles: [],
    })
    renderPage()
    fireEvent.change(screen.getByLabelText('Nieuw wachtwoord'), { target: { value: 'newpass' } })
    const confirm = screen.getByLabelText('Wachtwoord bevestigen')
    fireEvent.change(confirm, { target: { value: 'newpass' } })
    fireEvent.keyDown(confirm, { key: 'Enter' })
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  it('shows loading state while resetting', async () => {
    vi.mocked(api.resetPassword).mockReturnValueOnce(new Promise(() => {}))
    renderPage()
    fireEvent.change(screen.getByLabelText('Nieuw wachtwoord'), { target: { value: 'newpass' } })
    fireEvent.change(screen.getByLabelText('Wachtwoord bevestigen'), {
      target: { value: 'newpass' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Wachtwoord opslaan' }))
    expect(await screen.findByText('Bezig...')).toBeInTheDocument()
  })
})
