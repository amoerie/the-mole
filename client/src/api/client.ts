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
  getPreferences as _getPreferences,
  updatePreferences as _updatePreferences,
  addContestants as _addContestants,
  createEpisode as _createEpisode,
  deleteEpisode as _deleteEpisode,
  deleteGame as _deleteGame,
  createGame as _createGame,
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
  login as _login,
  register as _register,
  forgotPassword as _forgotPassword,
  resetPassword as _resetPassword,
  revealMole as _revealMole,
  submitRanking as _submitRanking,
  updateEpisode as _updateEpisode,
  updateProfile as _updateProfile,
  getMessages as _getMessages,
  postMessage as _postMessage,
  getUnreadMessageCount as _getUnreadMessageCount,
  markMessagesRead as _markMessagesRead,
  getGamePlayers as _getGamePlayers,
  getSuspectStats as _getSuspectStats,
} from './generated'
import {
  mapAdminUser,
  mapEpisodeStat,
  mapGame,
  mapGamePlayer,
  mapLeaderboardEntry,
  mapMessage,
  mapMessagesPage,
  mapRanking,
  mapUserInfo,
} from './mappers'
import type {
  AdminUser,
  EpisodeStat,
  Game,
  GameMessage,
  GamePlayer,
  MessagesPage,
  LeaderboardEntry,
  NewContestant,
  PlayerRanking,
  Ranking,
  UserInfo,
} from '../types'

export type {
  AdminUser,
  EpisodeStat,
  Game,
  GameMessage,
  GamePlayer,
  MessagesPage,
  LeaderboardEntry,
  NewContestant,
  PlayerRanking,
  Ranking,
  UserInfo,
}

export const api = {
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

  async getPreferences(): Promise<{ reminderEmailsEnabled: boolean }> {
    const { data } = await _getPreferences()
    return { reminderEmailsEnabled: data!.reminderEmailsEnabled }
  },

  async updatePreferences(
    reminderEmailsEnabled: boolean,
  ): Promise<{ reminderEmailsEnabled: boolean }> {
    const { data } = await _updatePreferences({ reminderEmailsEnabled })
    return { reminderEmailsEnabled: data!.reminderEmailsEnabled }
  },

  async login(email: string, password: string): Promise<UserInfo> {
    const { data } = await _login({ email, password })
    return mapUserInfo(data!)
  },

  async register(
    email: string,
    displayName: string,
    password: string,
    inviteCode?: string,
  ): Promise<UserInfo> {
    const { data } = await _register({
      email,
      displayName,
      password,
      inviteCode: inviteCode ?? null,
    })
    return mapUserInfo(data!)
  },

  async forgotPassword(email: string) {
    const { data } = await _forgotPassword({ email })
    return data
  },

  async resetPassword(token: string, newPassword: string): Promise<UserInfo> {
    const { data } = await _resetPassword({ token, newPassword })
    return mapUserInfo(data!)
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

  async deleteGame(gameId: string) {
    await _deleteGame(gameId)
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

  async getMessages(gameId: string, skip = 0): Promise<MessagesPage> {
    const { data } = await _getMessages(gameId, { skip })
    return mapMessagesPage(data!)
  },

  async postMessage(gameId: string, content: string): Promise<GameMessage> {
    const { data } = await _postMessage(gameId, { content })
    return mapMessage(data!)
  },

  async getUnreadMessageCount(gameId: string): Promise<number> {
    const { data } = await _getUnreadMessageCount(gameId)
    return Number(data?.count ?? 0)
  },

  async markMessagesRead(gameId: string): Promise<void> {
    await _markMessagesRead(gameId)
  },

  async getGamePlayers(gameId: string): Promise<GamePlayer[]> {
    const { data } = await _getGamePlayers(gameId)
    return (data ?? []).map(mapGamePlayer)
  },

  async getSuspectStats(gameId: string): Promise<EpisodeStat[]> {
    const { data } = await _getSuspectStats(gameId)
    return (data ?? []).map(mapEpisodeStat)
  },
}
