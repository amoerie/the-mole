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
  ContestantStats as RawContestantStats,
  Episode as RawEpisode,
  EpisodeScore as RawEpisodeScore,
  EpisodeStats as RawEpisodeStats,
  Game as RawGame,
  NoteResponse as RawNote,
  NotebookResponse as RawNotebook,
  MyGameResponse as RawMyGameResponse,
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
  ContestantStat,
  Episode,
  EpisodeScore,
  EpisodeStat,
  Game,
  GameMessage,
  GamePlayer,
  LeaderboardEntry,
  MessagesPage,
  MolboekjeNote,
  MyGame,
  Notebook,
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
    highResPhotoUrl: raw.highResPhotoUrl ?? undefined,
    bio: raw.bio ?? undefined,
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

export function mapMyGame(raw: RawMyGameResponse): MyGame {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    adminUserId: raw.adminUserId ?? '',
    contestants: (raw.contestants ?? []).map(mapContestant),
    episodes: (raw.episodes ?? []).map(mapEpisode),
    moleContestantId: raw.moleContestantId ?? undefined,
    inviteCode: raw.inviteCode ?? '',
    playerCount: Number(raw.playerCount ?? 0),
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

function mapContestantStat(raw: RawContestantStats): ContestantStat {
  return {
    contestantId: raw.contestantId,
    name: raw.name,
    avgRank: Number(raw.avgRank),
    rankingCount: Number(raw.rankingCount),
  }
}

export function mapNote(raw: RawNote): MolboekjeNote {
  const suspicionLevels: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw.suspicionLevels ?? {})) {
    suspicionLevels[key] = Number(value)
  }
  return {
    episodeNumber: Number(raw.episodeNumber ?? 0),
    content: raw.content ?? '',
    suspicionLevels,
    updatedAt: raw.updatedAt ?? '',
  }
}

export function mapNotebook(raw: RawNotebook): Notebook {
  return {
    notebookColor: raw.notebookColor ?? null,
    notes: (raw.notes ?? []).map(mapNote),
  }
}

export function mapEpisodeStat(raw: RawEpisodeStats): EpisodeStat {
  return {
    episodeNumber: Number(raw.episodeNumber),
    stats: raw.stats.map(mapContestantStat),
  }
}
