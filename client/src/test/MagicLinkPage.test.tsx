import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../hooks/useAuth'
import MagicLinkPage from '../pages/MagicLinkPage'

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../api/client', () => ({
  api: {
    verifyPasskey: vi.fn(),
  },
}))

import { api } from '../api/client'

const mockSetUser = vi.fn()

function renderMagicLinkPage(path = '/magic-link') {
  return render(
    <AuthContext.Provider value={{ user: null, loading: false, error: null, setUser: mockSetUser }}>
      <MemoryRouter initialEntries={[path]}>
        <MagicLinkPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('MagicLinkPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially when token is present', () => {
    vi.mocked(api.verifyPasskey).mockReturnValueOnce(new Promise(() => {}))
    renderMagicLinkPage('/magic-link?token=abc123')
    expect(screen.getByText('Bezig met inloggen...')).toBeInTheDocument()
  })

  it('shows error immediately when no token is in the URL', async () => {
    renderMagicLinkPage('/magic-link')
    expect(await screen.findByText('Ongeldige herstellink.')).toBeInTheDocument()
  })

  it('navigates to login after successful verification', async () => {
    vi.mocked(api.verifyPasskey).mockResolvedValueOnce({
      userId: '1',
      displayName: 'Test',
      roles: [],
    })
    renderMagicLinkPage('/magic-link?token=valid-token')
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login?recovered=true'))
    expect(mockSetUser).toHaveBeenCalledWith({ userId: '1', displayName: 'Test', roles: [] })
  })

  it('shows error when verification fails', async () => {
    vi.mocked(api.verifyPasskey).mockRejectedValueOnce(new Error('Token verlopen'))
    renderMagicLinkPage('/magic-link?token=bad-token')
    expect(await screen.findByText(/De herstellink is ongeldig of verlopen/)).toBeInTheDocument()
  })

  it('shows a link to request new recovery email on error', async () => {
    renderMagicLinkPage('/magic-link')
    expect(await screen.findByText('Nieuwe herstelmail aanvragen')).toBeInTheDocument()
  })
})
