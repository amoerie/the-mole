/**
 * API client — thin wrapper around the orval-generated functions.
 *
 * Each method calls the generated typed function and extracts `.data` so the
 * rest of the app keeps its simple `api.getMe()` call shape. TypeScript will
 * catch any mismatch between what the backend returns and what callers expect
 * the moment the spec changes and you re-run `npm run generate`.
 *
 * Return types are cast to the app-level types from `../types` (which declare
 * fields as required, matching what the API always returns in practice).
 */
import {
  addContestants as _addContestants,
  createEpisode as _createEpisode,
  createGame as _createGame,
  getGame as _getGame,
  getGameByInvite as _getGameByInvite,
  getLeaderboard as _getLeaderboard,
  getMe as _getMe,
  getMyGames as _getMyGames,
  getMyRanking as _getMyRanking,
  getMyRankings as _getMyRankings,
  getWhatIfLeaderboard as _getWhatIfLeaderboard,
  joinGame as _joinGame,
  registerPasskey as _registerPasskey,
  requestRecovery as _requestRecovery,
  revealMole as _revealMole,
  submitRanking as _submitRanking,
  updateEpisode as _updateEpisode,
  verifyPasskey as _verifyPasskey,
} from './generated'
import type { Contestant, Game, LeaderboardEntry, Ranking, UserInfo } from '../types'

export type { Contestant, Game, LeaderboardEntry, Ranking, UserInfo }

export const api = {
  // Auth
  getMe: () => _getMe().then((r) => r.data as UserInfo),

  registerPasskey: (email: string, displayName: string) =>
    _registerPasskey({ email, displayName }).then((r) => r.data),

  verifyPasskey: (token: string) => _verifyPasskey({ token }).then((r) => r.data as UserInfo),

  requestRecovery: (email: string) => _requestRecovery({ email }).then((r) => r.data),

  // Games
  createGame: (name: string, contestants: Contestant[]) =>
    _createGame({ name, contestants }).then((r) => r.data as Game),

  getMyGames: () => _getMyGames().then((r) => r.data as Game[]),

  getGame: (gameId: string) => _getGame(gameId).then((r) => r.data as Game),

  getGameByInvite: (inviteCode: string) => _getGameByInvite(inviteCode).then((r) => r.data),

  joinGame: (gameId: string, inviteCode: string) =>
    _joinGame(gameId, { inviteCode }).then((r) => r.data),

  addContestants: (gameId: string, contestants: Contestant[]) =>
    _addContestants(gameId, { contestants }).then((r) => r.data as Game),

  // Episodes
  createEpisode: (gameId: string, deadline: string, eliminatedContestantId?: string) =>
    _createEpisode(gameId, {
      deadline,
      eliminatedContestantId: eliminatedContestantId ?? null,
    }).then((r) => r.data),

  updateEpisode: (
    gameId: string,
    episodeNumber: number,
    deadline?: string,
    eliminatedContestantId?: string,
  ) =>
    _updateEpisode(gameId, episodeNumber, {
      deadline: deadline ?? null,
      eliminatedContestantId: eliminatedContestantId ?? null,
    }).then((r) => r.data),

  revealMole: (gameId: string, moleContestantId: string) =>
    _revealMole(gameId, { moleContestantId }).then((r) => r.data),

  // Rankings
  submitRanking: (gameId: string, episodeNumber: number, contestantIds: string[]) =>
    _submitRanking(gameId, episodeNumber, { contestantIds }).then((r) => r.data as Ranking),

  getMyRanking: (gameId: string, episodeNumber: number) =>
    _getMyRanking(gameId, episodeNumber).then((r) => r.data as Ranking),

  getMyRankings: (gameId: string) => _getMyRankings(gameId).then((r) => r.data as Ranking[]),

  // Leaderboard
  getLeaderboard: (gameId: string) =>
    _getLeaderboard(gameId).then((r) => r.data as LeaderboardEntry[]),

  getWhatIfLeaderboard: (gameId: string, contestantId: string) =>
    _getWhatIfLeaderboard(gameId, contestantId).then((r) => r.data as LeaderboardEntry[]),
}
