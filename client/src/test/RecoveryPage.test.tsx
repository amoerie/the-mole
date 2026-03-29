import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import RecoveryPage from '../pages/RecoveryPage'

vi.mock('../api/client', () => ({
  api: {
    requestRecovery: vi.fn(),
  },
}))

import { api } from '../api/client'

function renderRecoveryPage() {
  return render(
    <MemoryRouter>
      <RecoveryPage />
    </MemoryRouter>,
  )
}

describe('RecoveryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the recovery form', () => {
    renderRecoveryPage()
    expect(screen.getByLabelText('E-mailadres')).toBeInTheDocument()
    expect(screen.getByText('Herstelmail versturen')).toBeInTheDocument()
  })

  it('has a link back to login', () => {
    renderRecoveryPage()
    expect(screen.getByText('← Terug naar inloggen')).toBeInTheDocument()
  })

  it('shows error when email is empty', async () => {
    renderRecoveryPage()
    fireEvent.click(screen.getByText('Herstelmail versturen'))
    expect(await screen.findByText('Voer je e-mailadres in.')).toBeInTheDocument()
  })

  it('shows success message after submitting a valid email', async () => {
    vi.mocked(api.requestRecovery).mockResolvedValueOnce({ message: 'ok' })
    renderRecoveryPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'user@test.com' },
    })
    fireEvent.click(screen.getByText('Herstelmail versturen'))
    expect(await screen.findByText(/Als dit e-mailadres bekend is/)).toBeInTheDocument()
  })

  it('hides the form after success', async () => {
    vi.mocked(api.requestRecovery).mockResolvedValueOnce({ message: 'ok' })
    renderRecoveryPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'user@test.com' },
    })
    fireEvent.click(screen.getByText('Herstelmail versturen'))
    await waitFor(() => expect(screen.queryByText('Herstelmail versturen')).not.toBeInTheDocument())
  })

  it('shows error on api failure', async () => {
    vi.mocked(api.requestRecovery).mockRejectedValueOnce(new Error('Fout opgetreden'))
    renderRecoveryPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'user@test.com' },
    })
    fireEvent.click(screen.getByText('Herstelmail versturen'))
    expect(await screen.findByText('Fout opgetreden')).toBeInTheDocument()
  })

  it('shows generic error for non-Error exception', async () => {
    vi.mocked(api.requestRecovery).mockRejectedValueOnce('something')
    renderRecoveryPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'user@test.com' },
    })
    fireEvent.click(screen.getByText('Herstelmail versturen'))
    expect(await screen.findByText('Er is een fout opgetreden.')).toBeInTheDocument()
  })

  it('submits on Enter key press', async () => {
    vi.mocked(api.requestRecovery).mockResolvedValueOnce({ message: 'ok' })
    renderRecoveryPage()
    const input = screen.getByLabelText('E-mailadres')
    fireEvent.change(input, { target: { value: 'user@test.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText(/Als dit e-mailadres bekend is/)).toBeInTheDocument()
  })

  it('shows loading state while sending', async () => {
    vi.mocked(api.requestRecovery).mockReturnValueOnce(new Promise(() => {}))
    renderRecoveryPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), {
      target: { value: 'user@test.com' },
    })
    fireEvent.click(screen.getByText('Herstelmail versturen'))
    expect(await screen.findByText('Bezig...')).toBeInTheDocument()
  })
})
