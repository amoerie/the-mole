import { describe, expect, it } from 'vitest'
import {
  mapContestant,
  mapGame,
  mapLeaderboardEntry,
  mapRanking,
  mapUserInfo,
} from '../api/mappers'
import type {
  Contestant as RawContestant,
  EpisodeScore as RawEpisodeScore,
  Game as RawGame,
  LeaderboardEntry as RawLeaderboardEntry,
  Ranking as RawRanking,
  UserInfo as RawUserInfo,
} from '../api/generated'

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
      eliminatedInEpisode: 2,
    }
    expect(mapContestant(raw)).toEqual({
      id: 'c1',
      name: 'Bob',
      age: 30,
      photoUrl: '/b.jpg',
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
    episodes: [{ number: 1, deadline: '2025-01-01T00:00:00Z', eliminatedContestantId: null }],
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
