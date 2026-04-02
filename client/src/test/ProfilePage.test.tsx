import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../hooks/useAuth'
import ProfilePage from '../pages/ProfilePage'
import type { UserInfo } from '../types'

vi.mock('../api/client', () => ({
  api: {
    getMyGames: vi.fn().mockResolvedValue([]),
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
    updateProfile: vi.fn(),
  },
}))

import { api } from '../api/client'

const mockUser: UserInfo = {
  userId: 'user-1',
  displayName: 'Alice',
  roles: ['authenticated'],
}

function renderPage(user: UserInfo | null = mockUser) {
  return render(
    <AuthContext.Provider value={{ user, setUser: vi.fn() }}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ProfilePage — email preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getMyGames).mockResolvedValue([])
  })

  it('renders the reminder email toggle', async () => {
    vi.mocked(api.getPreferences).mockResolvedValue({ reminderEmailsEnabled: true })
    renderPage()
    expect(await screen.findByText('E-mailmeldingen')).toBeInTheDocument()
    const checkbox = await screen.findByRole<HTMLInputElement>('checkbox')
    expect(checkbox.checked).toBe(true)
  })

  it('shows checkbox unchecked when reminder emails are disabled', async () => {
    vi.mocked(api.getPreferences).mockResolvedValue({ reminderEmailsEnabled: false })
    renderPage()
    const checkbox = await screen.findByRole<HTMLInputElement>('checkbox')
    expect(checkbox.checked).toBe(false)
  })

  it('calls updatePreferences when toggled off', async () => {
    vi.mocked(api.getPreferences).mockResolvedValue({ reminderEmailsEnabled: true })
    vi.mocked(api.updatePreferences).mockResolvedValue({ reminderEmailsEnabled: false })
    renderPage()
    const checkbox = await screen.findByRole<HTMLInputElement>('checkbox')
    fireEvent.click(checkbox)
    await waitFor(() => expect(api.updatePreferences).toHaveBeenCalledWith(false))
  })

  it('calls updatePreferences when toggled on', async () => {
    vi.mocked(api.getPreferences).mockResolvedValue({ reminderEmailsEnabled: false })
    vi.mocked(api.updatePreferences).mockResolvedValue({ reminderEmailsEnabled: true })
    renderPage()
    const checkbox = await screen.findByRole<HTMLInputElement>('checkbox')
    fireEvent.click(checkbox)
    await waitFor(() => expect(api.updatePreferences).toHaveBeenCalledWith(true))
  })

  it('rolls back checkbox on save error', async () => {
    vi.mocked(api.getPreferences).mockResolvedValue({ reminderEmailsEnabled: true })
    vi.mocked(api.updatePreferences).mockRejectedValue(new Error('network error'))
    renderPage()
    const checkbox = await screen.findByRole<HTMLInputElement>('checkbox')
    fireEvent.click(checkbox)
    await waitFor(() =>
      expect(screen.getByText('Opslaan mislukt. Probeer het opnieuw.')).toBeInTheDocument(),
    )
    expect(checkbox.checked).toBe(true)
  })
})
