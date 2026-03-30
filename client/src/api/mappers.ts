/**
 * Anti-corruption layer: explicit mapping from raw orval-generated types to
 * the clean app-level types used throughout the UI.
 *
 * Generated types have all fields optional and some numeric fields as
 * `number | string` due to OpenAPI schema quirks. These mappers assert the
 * expected shape and provide safe defaults, so TypeScript errors here — not
 * silently at runtime — whenever the API contract changes.
 */
import type {
  AdminUserResponse as RawAdminUser,
  Contestant as RawContestant,
  Episode as RawEpisode,
  EpisodeScore as RawEpisodeScore,
  Game as RawGame,
  LeaderboardEntry as RawLeaderboardEntry,
  Message as RawMessage,
  MessagesResponse as RawMessagesPage,
  Player as RawPlayer,
  Ranking as RawRanking,
  UserInfo as RawUserInfo,
} from './generated'
import type {
  AdminUser,
  Contestant,
  Episode,
  EpisodeScore,
  Game,
  GameMessage,
  GamePlayer,
  LeaderboardEntry,
  MessagesPage,
  Ranking,
  UserInfo,
} from '../types'

export function mapAdminUser(raw: RawAdminUser): AdminUser {
  return {
    id: raw.id ?? '',
    email: raw.email ?? '',
    displayName: raw.displayName ?? '',
    isAdmin: raw.isAdmin ?? false,
  }
}

export function mapUserInfo(raw: RawUserInfo): UserInfo {
  return {
    userId: raw.userId ?? '',
    displayName: raw.displayName ?? '',
    roles: raw.roles ?? [],
  }
}

export function mapContestant(raw: RawContestant): Contestant {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    age: Number(raw.age ?? 0),
    photoUrl: raw.photoUrl ?? '',
    eliminatedInEpisode:
      raw.eliminatedInEpisode != null ? Number(raw.eliminatedInEpisode) : undefined,
  }
}

export function mapEpisode(raw: RawEpisode): Episode {
  return {
    number: Number(raw.number ?? 0),
    deadline: raw.deadline ?? '',
    eliminatedContestantIds: raw.eliminatedContestantIds ?? [],
  }
}

export function mapGame(raw: RawGame): Game {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    adminUserId: raw.adminUserId ?? '',
    contestants: (raw.contestants ?? []).map(mapContestant),
    episodes: (raw.episodes ?? []).map(mapEpisode),
    moleContestantId: raw.moleContestantId ?? undefined,
    inviteCode: raw.inviteCode ?? '',
  }
}

function mapEpisodeScore(raw: RawEpisodeScore): EpisodeScore {
  return {
    episodeNumber: Number(raw.episodeNumber ?? 0),
    score: Number(raw.score ?? 0),
    rankGiven: Number(raw.rankGiven ?? 0),
    totalContestants: Number(raw.totalContestants ?? 0),
  }
}

export function mapLeaderboardEntry(raw: RawLeaderboardEntry): LeaderboardEntry {
  return {
    userId: raw.userId ?? '',
    displayName: raw.displayName ?? '',
    totalScore: Number(raw.totalScore ?? 0),
    episodeScores: (raw.episodeScores ?? []).map(mapEpisodeScore),
  }
}

export function mapMessage(raw: RawMessage): GameMessage {
  return {
    id: raw.id ?? '',
    gameId: raw.gameId ?? '',
    userId: raw.userId ?? '',
    displayName: raw.displayName ?? '',
    content: raw.content ?? '',
    postedAt: raw.postedAt ?? '',
  }
}

export function mapMessagesPage(raw: RawMessagesPage): MessagesPage {
  return {
    items: (raw.items ?? []).map(mapMessage),
    hasMore: raw.hasMore ?? false,
  }
}

export function mapGamePlayer(raw: RawPlayer): GamePlayer {
  return {
    id: raw.id ?? '',
    gameId: raw.gameId ?? '',
    userId: raw.userId ?? '',
    displayName: raw.displayName ?? '',
    joinedAt: raw.joinedAt ?? '',
  }
}

export function mapRanking(raw: RawRanking): Ranking {
  return {
    id: raw.id ?? '',
    gameId: raw.gameId ?? '',
    episodeNumber: Number(raw.episodeNumber ?? 0),
    userId: raw.userId ?? '',
    contestantIds: raw.contestantIds ?? [],
    submittedAt: raw.submittedAt ?? '',
  }
}
