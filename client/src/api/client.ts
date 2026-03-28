import type { Game, Ranking, LeaderboardEntry, UserInfo } from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }
  return response.json();
}

export const api = {
  // Auth
  getMe: () => fetchJson<UserInfo>('/me'),

  // Games
  createGame: (name: string, contestants: { name: string; age: number; photoUrl: string }[]) =>
    fetchJson<Game>('/games', {
      method: 'POST',
      body: JSON.stringify({ name, contestants }),
    }),

  getMyGames: () => fetchJson<Game[]>('/my-games'),

  getGame: (gameId: string) => fetchJson<Game>(`/games/${gameId}`),

  getGameByInvite: (inviteCode: string) => fetchJson<Game>(`/games/by-invite/${inviteCode}`),

  joinGame: (gameId: string, inviteCode: string) =>
    fetchJson<void>(`/games/${gameId}/join`, {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    }),

  addContestants: (gameId: string, contestants: { name: string; age: number; photoUrl: string }[]) =>
    fetchJson<Game>(`/games/${gameId}/contestants`, {
      method: 'POST',
      body: JSON.stringify({ contestants }),
    }),

  // Episodes
  createEpisode: (gameId: string, deadline: string, eliminatedContestantId?: string) =>
    fetchJson<Game>(`/games/${gameId}/episodes`, {
      method: 'POST',
      body: JSON.stringify({ deadline, eliminatedContestantId }),
    }),

  revealMole: (gameId: string, moleContestantId: string) =>
    fetchJson<Game>(`/games/${gameId}/reveal-mole`, {
      method: 'POST',
      body: JSON.stringify({ moleContestantId }),
    }),

  // Rankings
  submitRanking: (gameId: string, episodeNumber: number, contestantIds: string[]) =>
    fetchJson<Ranking>(`/games/${gameId}/episodes/${episodeNumber}/rankings`, {
      method: 'POST',
      body: JSON.stringify({ contestantIds }),
    }),

  getMyRanking: (gameId: string, episodeNumber: number) =>
    fetchJson<Ranking>(`/games/${gameId}/episodes/${episodeNumber}/rankings/mine`),

  getMyRankings: (gameId: string) => fetchJson<Ranking[]>(`/games/${gameId}/rankings`),

  // Leaderboard
  getLeaderboard: (gameId: string) => fetchJson<LeaderboardEntry[]>(`/games/${gameId}/leaderboard`),

  getWhatIfLeaderboard: (gameId: string, contestantId: string) =>
    fetchJson<LeaderboardEntry[]>(`/games/${gameId}/leaderboard/what-if/${contestantId}`),
};
