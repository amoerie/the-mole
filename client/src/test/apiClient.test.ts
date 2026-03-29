import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../api/client'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('API client', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  function mockResponse(data: unknown, ok = true, status = 200) {
    mockFetch.mockResolvedValueOnce({
      ok,
      status,
      headers: new Headers(),
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    })
  }

  it('getMe calls /api/me', async () => {
    const user = { userId: '123', displayName: 'Test', roles: ['authenticated'] }
    mockResponse(user)

    const result = await api.getMe()
    expect(result).toEqual(user)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/me',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  it('createGame sends POST to /api/games', async () => {
    const game = { id: 'g1', name: 'Test Game' }
    mockResponse(game)

    await api.createGame('Test Game', [{ name: 'Alice', age: 30, photoUrl: '/a.jpg' }])
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/games',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Test Game'),
      }),
    )
  })

  it('getGame calls /api/games/{gameId}', async () => {
    mockResponse({ id: 'g1' })
    await api.getGame('g1')
    expect(mockFetch).toHaveBeenCalledWith('/api/games/g1', expect.anything())
  })

  it('joinGame sends POST with invite code', async () => {
    mockResponse(undefined)
    await api.joinGame('g1', 'abc123')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/games/g1/join',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ inviteCode: 'abc123' }),
      }),
    )
  })

  it('submitRanking sends POST with contestant IDs', async () => {
    mockResponse({ id: 'r1' })
    await api.submitRanking('g1', 2, ['c1', 'c2', 'c3'])
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/games/g1/episodes/2/rankings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ contestantIds: ['c1', 'c2', 'c3'] }),
      }),
    )
  })

  it('throws on non-ok response', async () => {
    mockResponse('Unauthorized', false, 401)
    await expect(api.getMe()).rejects.toThrow('API error 401')
  })

  it('getWhatIfLeaderboard calls correct URL', async () => {
    mockResponse([])
    await api.getWhatIfLeaderboard('g1', 'c5')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/games/g1/leaderboard/what-if/c5',
      expect.anything(),
    )
  })

  it('revealMole sends POST with moleContestantId', async () => {
    mockResponse({ id: 'g1' })
    await api.revealMole('g1', 'c3')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/games/g1/reveal-mole',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ moleContestantId: 'c3' }),
      }),
    )
  })

  it('registerPasskey sends POST with email and displayName', async () => {
    mockResponse({ token: 'reg-token' })
    const result = await api.registerPasskey('alice@test.com', 'Alice')
    expect(result).toEqual({ token: 'reg-token' })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'alice@test.com', displayName: 'Alice', inviteCode: null }),
      }),
    )
  })

  it('verifyPasskey sends POST with token', async () => {
    const user = { userId: '1', displayName: 'Alice', roles: [] }
    mockResponse(user)
    const result = await api.verifyPasskey('auth-token')
    expect(result).toEqual(user)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/verify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'auth-token' }),
      }),
    )
  })

  it('requestRecovery sends POST with email', async () => {
    mockResponse({ message: 'ok' })
    await api.requestRecovery('user@test.com')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/recover',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'user@test.com' }),
      }),
    )
  })

  it('getMyGames calls /api/my-games', async () => {
    mockResponse([])
    await api.getMyGames()
    expect(mockFetch).toHaveBeenCalledWith('/api/my-games', expect.anything())
  })

  it('getGameByInvite calls correct URL', async () => {
    mockResponse({ id: 'g1' })
    await api.getGameByInvite('invite123')
    expect(mockFetch).toHaveBeenCalledWith('/api/games/by-invite/invite123', expect.anything())
  })

  it('addContestants sends POST with contestants', async () => {
    mockResponse({ id: 'g1' })
    await api.addContestants('g1', [{ name: 'Bob', age: 25, photoUrl: '/b.jpg' }])
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/games/g1/contestants',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Bob'),
      }),
    )
  })

  it('createEpisode sends POST with deadline', async () => {
    mockResponse({ id: 'g1' })
    await api.createEpisode('g1', '2025-01-01T00:00:00Z')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/games/g1/episodes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          deadline: '2025-01-01T00:00:00Z',
          eliminatedContestantIds: null,
        }),
      }),
    )
  })

  it('getMyRanking calls correct URL', async () => {
    mockResponse({ id: 'r1' })
    await api.getMyRanking('g1', 2)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/games/g1/episodes/2/rankings/mine',
      expect.anything(),
    )
  })

  it('getMyRankings calls correct URL', async () => {
    mockResponse([])
    await api.getMyRankings('g1')
    expect(mockFetch).toHaveBeenCalledWith('/api/games/g1/rankings', expect.anything())
  })

  it('getLeaderboard calls correct URL', async () => {
    mockResponse([])
    await api.getLeaderboard('g1')
    expect(mockFetch).toHaveBeenCalledWith('/api/games/g1/leaderboard', expect.anything())
  })
})
