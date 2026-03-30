export interface Contestant {
  id: string
  name: string
  age: number
  photoUrl: string
  eliminatedInEpisode?: number
}

/** Input type for creating contestants — server assigns the id */
export interface NewContestant {
  name: string
  age: number
  photoUrl: string
}

export interface Episode {
  number: number
  deadline: string // ISO date
  eliminatedContestantIds: string[]
}

export interface Game {
  id: string
  name: string
  adminUserId: string
  contestants: Contestant[]
  episodes: Episode[]
  moleContestantId?: string
  inviteCode: string
}

export interface Player {
  id: string
  gameId: string
  userId: string
  displayName: string
  joinedAt: string
}

export interface Ranking {
  id: string
  gameId: string
  episodeNumber: number
  userId: string
  contestantIds: string[]
  submittedAt: string
}

export interface PlayerRanking {
  userId: string
  displayName: string
  contestantIds: string[]
  submittedAt: string
}

export interface LeaderboardEntry {
  userId: string
  displayName: string
  totalScore: number
  episodeScores: EpisodeScore[]
}

export interface EpisodeScore {
  episodeNumber: number
  score: number
  rankGiven: number
  totalContestants: number
}

export interface UserInfo {
  userId: string
  displayName: string
  roles: string[]
}

export interface GameMessage {
  id: string
  gameId: string
  userId: string
  displayName: string
  content: string
  postedAt: string
}

export interface MessagesPage {
  items: GameMessage[]
  hasMore: boolean
}

export type GamePlayer = Player

export interface ContestantStat {
  contestantId: string
  name: string
  avgRank: number
  rankingCount: number
}

export interface EpisodeStat {
  episodeNumber: number
  stats: ContestantStat[]
}

export interface AdminUser {
  id: string
  email: string
  displayName: string
  isAdmin: boolean
}
