import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ForgotPasswordPage from '../pages/ForgotPasswordPage'

vi.mock('../api/client', () => ({
  api: {
    forgotPassword: vi.fn(),
  },
}))

import { api } from '../api/client'

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  )
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email field and submit button', () => {
    renderPage()
    expect(screen.getByLabelText('E-mailadres')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Herstelmail versturen' })).toBeInTheDocument()
  })

  it('shows validation error when email is empty', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Herstelmail versturen' }))
    expect(await screen.findByText('Voer je e-mailadres in.')).toBeInTheDocument()
  })

  it('shows success message after submission', async () => {
    vi.mocked(api.forgotPassword).mockResolvedValueOnce({ message: 'ok' })
    renderPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Herstelmail versturen' }))
    expect(await screen.findByText('Mail verstuurd')).toBeInTheDocument()
  })

  it('shows error on api failure', async () => {
    vi.mocked(api.forgotPassword).mockRejectedValueOnce(new Error('fail'))
    renderPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Herstelmail versturen' }))
    expect(
      await screen.findByText('Er is iets misgegaan. Probeer het later opnieuw.'),
    ).toBeInTheDocument()
  })

  it('submits on Enter key', async () => {
    vi.mocked(api.forgotPassword).mockResolvedValueOnce({ message: 'ok' })
    renderPage()
    const input = screen.getByLabelText('E-mailadres')
    fireEvent.change(input, { target: { value: 'a@b.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('Mail verstuurd')).toBeInTheDocument()
  })

  it('shows loading state while submitting', async () => {
    vi.mocked(api.forgotPassword).mockReturnValueOnce(new Promise(() => {}))
    renderPage()
    fireEvent.change(screen.getByLabelText('E-mailadres'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Herstelmail versturen' }))
    expect(await screen.findByText('Bezig...')).toBeInTheDocument()
  })
})
