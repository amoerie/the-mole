import { describe, expect, it } from 'vitest'
import {
  mapAdminUser,
  mapContestant,
  mapEpisodeStat,
  mapGame,
  mapGamePlayer,
  mapLeaderboardEntry,
  mapMessage,
  mapMessagesPage,
  mapRanking,
  mapUserInfo,
} from '../api/mappers'
import type {
  AdminUserResponse as RawAdminUser,
  Contestant as RawContestant,
  ContestantStats as RawContestantStats,
  EpisodeScore as RawEpisodeScore,
  EpisodeStats as RawEpisodeStats,
  Game as RawGame,
  LeaderboardEntry as RawLeaderboardEntry,
  Message as RawMessage,
  MessagesResponse as RawMessagesPage,
  Player as RawPlayer,
  Ranking as RawRanking,
  UserInfo as RawUserInfo,
} from '../api/generated'

describe('mapAdminUser', () => {
  it('maps an admin user', () => {
    const raw: RawAdminUser = { id: 'u1', email: 'a@b.com', displayName: 'Alice', isAdmin: true }
    expect(mapAdminUser(raw)).toEqual({
      id: 'u1',
      email: 'a@b.com',
      displayName: 'Alice',
      isAdmin: true,
    })
  })

  it('maps a non-admin user', () => {
    const raw: RawAdminUser = { id: 'u2', email: 'b@c.com', displayName: 'Bob', isAdmin: false }
    expect(mapAdminUser(raw).isAdmin).toBe(false)
  })
})

describe('mapUserInfo', () => {
  it('maps all fields', () => {
    const raw: RawUserInfo = { userId: 'u1', displayName: 'Alice', roles: ['authenticated'] }
    expect(mapUserInfo(raw)).toEqual({
      userId: 'u1',
      displayName: 'Alice',
      roles: ['authenticated'],
    })
  })

  it('uses empty string defaults for missing string fields', () => {
    const raw: RawUserInfo = {}
    const result = mapUserInfo(raw)
    expect(result.userId).toBe('')
    expect(result.displayName).toBe('')
    expect(result.roles).toEqual([])
  })
})

describe('mapContestant', () => {
  it('maps all fields', () => {
    const raw: RawContestant = {
      id: 'c1',
      name: 'Bob',
      age: 30,
      photoUrl: '/b.jpg',
      highResPhotoUrl: '/b-hires.jpg',
      bio: 'A short bio.',
      eliminatedInEpisode: 2,
    }
    expect(mapContestant(raw)).toEqual({
      id: 'c1',
      name: 'Bob',
      age: 30,
      photoUrl: '/b.jpg',
      highResPhotoUrl: '/b-hires.jpg',
      bio: 'A short bio.',
      eliminatedInEpisode: 2,
    })
  })

  it('maps numeric age when it comes as a string (orval number|string quirk)', () => {
    const raw = { id: 'c1', name: 'Bob', age: '30' as unknown as number, photoUrl: '/b.jpg' }
    expect(mapContestant(raw).age).toBe(30)
  })

  it('sets eliminatedInEpisode to undefined when null/absent', () => {
    const raw: RawContestant = { id: 'c1', name: 'Bob', age: 25, photoUrl: '/b.jpg' }
    expect(mapContestant(raw).eliminatedInEpisode).toBeUndefined()
  })

  it('sets highResPhotoUrl to undefined when null/absent', () => {
    const raw: RawContestant = { id: 'c1', name: 'Bob', age: 25, photoUrl: '/b.jpg' }
    expect(mapContestant(raw).highResPhotoUrl).toBeUndefined()
  })

  it('sets bio to undefined when null/absent', () => {
    const raw: RawContestant = { id: 'c1', name: 'Bob', age: 25, photoUrl: '/b.jpg' }
    expect(mapContestant(raw).bio).toBeUndefined()
  })

  it('uses empty string defaults for missing fields', () => {
    const raw: RawContestant = {}
    const result = mapContestant(raw)
    expect(result.id).toBe('')
    expect(result.name).toBe('')
    expect(result.age).toBe(0)
    expect(result.photoUrl).toBe('')
  })
})

describe('mapGame', () => {
  const rawGame: RawGame = {
    id: 'g1',
    name: 'Test Game',
    adminUserId: 'u1',
    contestants: [{ id: 'c1', name: 'Alice', age: 28, photoUrl: '/a.jpg' }],
    episodes: [{ number: 1, deadline: '2025-01-01T00:00:00Z', eliminatedContestantIds: [] }],
    moleContestantId: null,
    inviteCode: 'abc123',
  }

  it('maps all fields', () => {
    const result = mapGame(rawGame)
    expect(result.id).toBe('g1')
    expect(result.name).toBe('Test Game')
    expect(result.adminUserId).toBe('u1')
    expect(result.inviteCode).toBe('abc123')
  })

  it('maps nested contestants', () => {
    const result = mapGame(rawGame)
    expect(result.contestants).toHaveLength(1)
    expect(result.contestants[0].id).toBe('c1')
    expect(result.contestants[0].name).toBe('Alice')
  })

  it('maps nested episodes', () => {
    const result = mapGame(rawGame)
    expect(result.episodes).toHaveLength(1)
    expect(result.episodes[0].number).toBe(1)
    expect(result.episodes[0].deadline).toBe('2025-01-01T00:00:00Z')
  })

  it('sets moleContestantId to undefined when null', () => {
    expect(mapGame(rawGame).moleContestantId).toBeUndefined()
  })

  it('maps moleContestantId when present', () => {
    expect(mapGame({ ...rawGame, moleContestantId: 'c1' }).moleContestantId).toBe('c1')
  })

  it('defaults to empty arrays for missing contestants/episodes', () => {
    const result = mapGame({ id: 'g1' })
    expect(result.contestants).toEqual([])
    expect(result.episodes).toEqual([])
  })

  it('uses empty string defaults for missing string fields', () => {
    const result = mapGame({})
    expect(result.id).toBe('')
    expect(result.name).toBe('')
    expect(result.adminUserId).toBe('')
    expect(result.inviteCode).toBe('')
  })
})

describe('mapRanking', () => {
  const rawRanking: RawRanking = {
    id: 'r1',
    gameId: 'g1',
    episodeNumber: 2,
    userId: 'u1',
    contestantIds: ['c1', 'c2', 'c3'],
    submittedAt: '2025-01-01T00:00:00Z',
  }

  it('maps all fields', () => {
    expect(mapRanking(rawRanking)).toEqual({
      id: 'r1',
      gameId: 'g1',
      episodeNumber: 2,
      userId: 'u1',
      contestantIds: ['c1', 'c2', 'c3'],
      submittedAt: '2025-01-01T00:00:00Z',
    })
  })

  it('maps episodeNumber when it comes as a string', () => {
    const raw = { ...rawRanking, episodeNumber: '2' as unknown as number }
    expect(mapRanking(raw).episodeNumber).toBe(2)
  })

  it('uses safe defaults for missing fields', () => {
    const result = mapRanking({})
    expect(result.id).toBe('')
    expect(result.gameId).toBe('')
    expect(result.episodeNumber).toBe(0)
    expect(result.userId).toBe('')
    expect(result.contestantIds).toEqual([])
    expect(result.submittedAt).toBe('')
  })
})

describe('mapLeaderboardEntry', () => {
  const rawEpisodeScore: RawEpisodeScore = {
    episodeNumber: 1,
    score: 0.75,
    rankGiven: 2,
    totalContestants: 10,
  }

  const rawEntry: RawLeaderboardEntry = {
    userId: 'u1',
    displayName: 'Alice',
    totalScore: 3.5,
    episodeScores: [rawEpisodeScore],
  }

  it('maps all fields', () => {
    const result = mapLeaderboardEntry(rawEntry)
    expect(result.userId).toBe('u1')
    expect(result.displayName).toBe('Alice')
    expect(result.totalScore).toBe(3.5)
  })

  it('maps nested episode scores', () => {
    const result = mapLeaderboardEntry(rawEntry)
    expect(result.episodeScores).toHaveLength(1)
    expect(result.episodeScores[0]).toEqual({
      episodeNumber: 1,
      score: 0.75,
      rankGiven: 2,
      totalContestants: 10,
    })
  })

  it('maps numeric fields when they come as strings', () => {
    const raw: RawLeaderboardEntry = {
      userId: 'u1',
      displayName: 'Alice',
      totalScore: '3.5' as unknown as number,
      episodeScores: [
        {
          episodeNumber: '1' as unknown as number,
          score: '0.75' as unknown as number,
          rankGiven: '2' as unknown as number,
          totalContestants: '10' as unknown as number,
        },
      ],
    }
    const result = mapLeaderboardEntry(raw)
    expect(result.totalScore).toBe(3.5)
    expect(result.episodeScores[0].episodeNumber).toBe(1)
    expect(result.episodeScores[0].score).toBe(0.75)
  })

  it('uses safe defaults for missing fields', () => {
    const result = mapLeaderboardEntry({})
    expect(result.userId).toBe('')
    expect(result.displayName).toBe('')
    expect(result.totalScore).toBe(0)
    expect(result.episodeScores).toEqual([])
  })
})

describe('mapMessage', () => {
  const rawMessage: RawMessage = {
    id: 'm1',
    gameId: 'g1',
    userId: 'u1',
    displayName: 'Alice',
    content: 'Hello!',
    postedAt: '2025-01-01T00:00:00Z',
  }

  it('maps all fields', () => {
    expect(mapMessage(rawMessage)).toEqual({
      id: 'm1',
      gameId: 'g1',
      userId: 'u1',
      displayName: 'Alice',
      content: 'Hello!',
      postedAt: '2025-01-01T00:00:00Z',
    })
  })

  it('uses empty string defaults for missing fields', () => {
    const result = mapMessage({})
    expect(result.id).toBe('')
    expect(result.gameId).toBe('')
    expect(result.userId).toBe('')
    expect(result.displayName).toBe('')
    expect(result.content).toBe('')
    expect(result.postedAt).toBe('')
  })
})

describe('mapMessagesPage', () => {
  it('maps items and hasMore', () => {
    const raw: RawMessagesPage = {
      items: [
        {
          id: 'm1',
          gameId: 'g1',
          userId: 'u1',
          displayName: 'Alice',
          content: 'Hi',
          postedAt: '2025-01-01T00:00:00Z',
        },
      ],
      hasMore: true,
    }
    const result = mapMessagesPage(raw)
    expect(result.hasMore).toBe(true)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe('m1')
    expect(result.items[0].content).toBe('Hi')
  })

  it('defaults to empty items and hasMore=false when fields are missing', () => {
    const result = mapMessagesPage({ items: [], hasMore: false })
    expect(result.items).toEqual([])
    expect(result.hasMore).toBe(false)
  })

  it('maps nested messages through mapMessage', () => {
    const raw: RawMessagesPage = {
      items: [{ id: 'm2', displayName: 'Bob' }],
      hasMore: false,
    }
    const result = mapMessagesPage(raw)
    expect(result.items[0].id).toBe('m2')
    expect(result.items[0].displayName).toBe('Bob')
    expect(result.items[0].content).toBe('')
  })
})

describe('mapGamePlayer', () => {
  it('maps all fields', () => {
    const raw: RawPlayer = {
      id: 'p1',
      gameId: 'g1',
      userId: 'u1',
      displayName: 'Alice',
      joinedAt: '2025-01-01T00:00:00Z',
    }
    expect(mapGamePlayer(raw)).toEqual({
      id: 'p1',
      gameId: 'g1',
      userId: 'u1',
      displayName: 'Alice',
      joinedAt: '2025-01-01T00:00:00Z',
    })
  })

  it('uses empty string defaults for missing fields', () => {
    const result = mapGamePlayer({})
    expect(result.id).toBe('')
    expect(result.gameId).toBe('')
    expect(result.userId).toBe('')
    expect(result.displayName).toBe('')
    expect(result.joinedAt).toBe('')
  })
})

describe('mapEpisodeStat', () => {
  const rawStat: RawContestantStats = {
    contestantId: 'c1',
    name: 'Alice',
    avgRank: 1.5,
    rankingCount: 3,
  }
  const rawEpisode: RawEpisodeStats = { episodeNumber: 2, stats: [rawStat] }

  it('maps all fields', () => {
    const result = mapEpisodeStat(rawEpisode)
    expect(result.episodeNumber).toBe(2)
    expect(result.stats).toHaveLength(1)
    expect(result.stats[0]).toEqual({
      contestantId: 'c1',
      name: 'Alice',
      avgRank: 1.5,
      rankingCount: 3,
    })
  })

  it('converts string numeric fields to numbers', () => {
    const raw: RawEpisodeStats = {
      episodeNumber: '2' as unknown as number,
      stats: [
        {
          contestantId: 'c1',
          name: 'Alice',
          avgRank: '1.5' as unknown as number,
          rankingCount: '3' as unknown as number,
        },
      ],
    }
    const result = mapEpisodeStat(raw)
    expect(result.episodeNumber).toBe(2)
    expect(result.stats[0].avgRank).toBe(1.5)
    expect(result.stats[0].rankingCount).toBe(3)
  })
})
