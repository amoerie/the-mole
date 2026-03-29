/**
 * API client — thin wrapper around the orval-generated functions.
 *
 * Each method calls the generated typed function, then passes the raw response
 * through the anti-corruption layer (mappers.ts) to produce clean app-level
 * types. TypeScript will fail to compile here if the API contract changes and
 * the generated types no longer match what the mappers expect.
 *
 * Re-run `npm run generate` after changing the API, then fix any mapper errors.
 */
import {
  addContestants as _addContestants,
  createEpisode as _createEpisode,
  deleteEpisode as _deleteEpisode,
  createGame as _createGame,
  getConfig as _getConfig,
  getGame as _getGame,
  getGameByInvite as _getGameByInvite,
  getEpisodeRankings as _getEpisodeRankings,
  getLeaderboard as _getLeaderboard,
  getMe as _getMe,
  getMyGames as _getMyGames,
  getMyRanking as _getMyRanking,
  getMyRankings as _getMyRankings,
  getWhatIfLeaderboard as _getWhatIfLeaderboard,
  grantAdmin as _grantAdmin,
  joinGame as _joinGame,
  listUsers as _listUsers,
  registerPasskey as _registerPasskey,
  requestRecovery as _requestRecovery,
  resetPasskey as _resetPasskey,
  revealMole as _revealMole,
  submitRanking as _submitRanking,
  updateEpisode as _updateEpisode,
  updateProfile as _updateProfile,
  verifyPasskey as _verifyPasskey,
} from './generated'
import { mapAdminUser, mapGame, mapLeaderboardEntry, mapRanking, mapUserInfo } from './mappers'
import type {
  AdminUser,
  Game,
  LeaderboardEntry,
  NewContestant,
  PlayerRanking,
  Ranking,
  UserInfo,
} from '../types'

export type { AdminUser, Game, LeaderboardEntry, NewContestant, PlayerRanking, Ranking, UserInfo }

export const api = {
  // Config
  async getConfig() {
    const { data } = await _getConfig()
    return data!
  },

  // Admin
  async listUsers(): Promise<AdminUser[]> {
    const { data } = await _listUsers()
    return (data ?? []).map(mapAdminUser)
  },

  async grantAdmin(userId: string) {
    const { data } = await _grantAdmin(userId)
    return data
  },

  // Auth
  async getMe(): Promise<UserInfo> {
    const { data } = await _getMe()
    return mapUserInfo(data!)
  },

  async updateProfile(displayName: string): Promise<UserInfo> {
    const { data } = await _updateProfile({ displayName })
    return mapUserInfo(data!)
  },

  async registerPasskey(email: string, displayName: string, inviteCode?: string) {
    const { data } = await _registerPasskey({ email, displayName, inviteCode: inviteCode ?? null })
    return data
  },

  async resetPasskey() {
    const { data } = await _resetPasskey()
    return data!
  },

  async verifyPasskey(token: string): Promise<UserInfo> {
    const { data } = await _verifyPasskey({ token })
    return mapUserInfo(data!)
  },

  async requestRecovery(email: string) {
    const { data } = await _requestRecovery({ email })
    return data
  },

  // Games
  async createGame(name: string, contestants: NewContestant[]): Promise<Game> {
    const { data } = await _createGame({ name, contestants })
    return mapGame(data!)
  },

  async getMyGames(): Promise<Game[]> {
    const { data } = await _getMyGames()
    return (data ?? []).map(mapGame)
  },

  async getGame(gameId: string): Promise<Game> {
    const { data } = await _getGame(gameId)
    return mapGame(data!)
  },

  async getGameByInvite(inviteCode: string) {
    const { data } = await _getGameByInvite(inviteCode)
    return data
  },

  async joinGame(gameId: string, inviteCode: string) {
    const { data } = await _joinGame(gameId, { inviteCode })
    return data
  },

  async addContestants(gameId: string, contestants: NewContestant[]): Promise<Game> {
    const { data } = await _addContestants(gameId, { contestants })
    return mapGame(data!)
  },

  // Episodes — these return Episode/RevealMoleResponse, not Game.
  // Callers that need updated game state should call api.getGame() afterwards.
  async createEpisode(gameId: string, deadline: string, eliminatedContestantIds?: string[]) {
    const { data } = await _createEpisode(gameId, {
      deadline,
      eliminatedContestantIds: eliminatedContestantIds ?? null,
    })
    return data
  },

  async deleteEpisode(gameId: string, episodeNumber: number) {
    await _deleteEpisode(gameId, episodeNumber)
  },

  async updateEpisode(
    gameId: string,
    episodeNumber: number,
    deadline?: string,
    eliminatedContestantIds?: string[],
  ) {
    const { data } = await _updateEpisode(gameId, episodeNumber, {
      deadline: deadline ?? null,
      eliminatedContestantIds: eliminatedContestantIds ?? null,
    })
    return data
  },

  async revealMole(gameId: string, moleContestantId: string) {
    const { data } = await _revealMole(gameId, { moleContestantId })
    return data
  },

  // Rankings
  async submitRanking(
    gameId: string,
    episodeNumber: number,
    contestantIds: string[],
  ): Promise<Ranking> {
    const { data } = await _submitRanking(gameId, episodeNumber, { contestantIds })
    return mapRanking(data!)
  },

  async getEpisodeRankings(gameId: string, episodeNumber: number): Promise<PlayerRanking[]> {
    const { data } = await _getEpisodeRankings(gameId, episodeNumber)
    return (data ?? []).map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      contestantIds: r.contestantIds,
      submittedAt: r.submittedAt,
    }))
  },

  async getMyRanking(gameId: string, episodeNumber: number): Promise<Ranking> {
    const { data } = await _getMyRanking(gameId, episodeNumber)
    return mapRanking(data!)
  },

  async getMyRankings(gameId: string): Promise<Ranking[]> {
    const { data } = await _getMyRankings(gameId)
    return (data ?? []).map(mapRanking)
  },

  // Leaderboard
  async getLeaderboard(gameId: string): Promise<LeaderboardEntry[]> {
    const { data } = await _getLeaderboard(gameId)
    return (data ?? []).map(mapLeaderboardEntry)
  },

  async getWhatIfLeaderboard(gameId: string, contestantId: string): Promise<LeaderboardEntry[]> {
    const { data } = await _getWhatIfLeaderboard(gameId, contestantId)
    return (data ?? []).map(mapLeaderboardEntry)
  },
}
