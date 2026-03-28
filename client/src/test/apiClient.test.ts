import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mock setup
import { api } from '../api/client';

describe('API client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  function mockResponse(data: unknown, ok = true, status = 200) {
    mockFetch.mockResolvedValueOnce({
      ok,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    });
  }

  it('getMe calls /api/me', async () => {
    const user = { userId: '123', displayName: 'Test' };
    mockResponse(user);

    const result = await api.getMe();
    expect(result).toEqual(user);
    expect(mockFetch).toHaveBeenCalledWith('/api/me', expect.objectContaining({
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }));
  });

  it('createGame sends POST to /api/games', async () => {
    const game = { id: 'g1', name: 'Test Game' };
    mockResponse(game);

    await api.createGame('Test Game', [{ name: 'Alice', age: 30, photoUrl: '/a.jpg' }]);
    expect(mockFetch).toHaveBeenCalledWith('/api/games', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('Test Game'),
    }));
  });

  it('getGame calls /api/games/{gameId}', async () => {
    mockResponse({ id: 'g1' });
    await api.getGame('g1');
    expect(mockFetch).toHaveBeenCalledWith('/api/games/g1', expect.anything());
  });

  it('joinGame sends POST with invite code', async () => {
    mockResponse(undefined);
    await api.joinGame('g1', 'abc123');
    expect(mockFetch).toHaveBeenCalledWith('/api/games/g1/join', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ inviteCode: 'abc123' }),
    }));
  });

  it('submitRanking sends POST with contestant IDs', async () => {
    mockResponse({ id: 'r1' });
    await api.submitRanking('g1', 2, ['c1', 'c2', 'c3']);
    expect(mockFetch).toHaveBeenCalledWith('/api/games/g1/episodes/2/rankings', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ contestantIds: ['c1', 'c2', 'c3'] }),
    }));
  });

  it('throws on non-ok response', async () => {
    mockResponse('Unauthorized', false, 401);
    await expect(api.getMe()).rejects.toThrow('API error 401');
  });

  it('getWhatIfLeaderboard calls correct URL', async () => {
    mockResponse([]);
    await api.getWhatIfLeaderboard('g1', 'c5');
    expect(mockFetch).toHaveBeenCalledWith('/api/games/g1/leaderboard/what-if/c5', expect.anything());
  });

  it('revealMole sends POST with moleContestantId', async () => {
    mockResponse({ id: 'g1' });
    await api.revealMole('g1', 'c3');
    expect(mockFetch).toHaveBeenCalledWith('/api/games/g1/reveal-mole', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ moleContestantId: 'c3' }),
    }));
  });
});
