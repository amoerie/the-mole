import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Game, LeaderboardEntry } from '../types'

export default function LeaderboardPage() {
  const { gameId } = useParams<{ gameId: string }>()

  const [game, setGame] = useState<Game | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [selectedContestant, setSelectedContestant] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!gameId) return
    Promise.all([api.getGame(gameId), api.getLeaderboard(gameId).catch(() => [])])
      .then(([gameData, lb]) => {
        setGame(gameData)
        setLeaderboard(lb)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Fout bij laden'))
      .finally(() => setLoading(false))
  }, [gameId])

  useEffect(() => {
    if (!gameId || !selectedContestant) return
    api
      .getWhatIfLeaderboard(gameId, selectedContestant)
      .then(setLeaderboard)
      .catch((err) => setError(err instanceof Error ? err.message : 'Fout bij laden'))
  }, [gameId, selectedContestant])

  if (loading) return <div className="loading">Laden...</div>
  if (error) return <div className="error-message">{error}</div>
  if (!game) return <div className="error-message">Spel niet gevonden</div>

  const isMoleRevealed = !!game.moleContestantId
  const episodeNumbers = game.episodes.map((e) => e.number)

  return (
    <div className="leaderboard-page">
      <h2>Klassement — {game.name}</h2>

      {isMoleRevealed ? (
        <div className="mole-revealed">
          🕵️ De Mol was:{' '}
          <strong>{game.contestants.find((c) => c.id === game.moleContestantId)?.name}</strong>
        </div>
      ) : (
        <div className="what-if-selector">
          <label htmlFor="what-if">Wat als de Mol is...</label>
          <select
            id="what-if"
            value={selectedContestant}
            onChange={(e) => setSelectedContestant(e.target.value)}
          >
            <option value="">Selecteer een kandidaat</option>
            {game.contestants.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {leaderboard.length > 0 ? (
        <div className="leaderboard-table-wrapper">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Speler</th>
                {episodeNumbers.map((n) => (
                  <th key={n}>Afl. {n}</th>
                ))}
                <th>Totaal</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard
                .sort((a, b) => b.totalScore - a.totalScore)
                .map((entry, index) => (
                  <tr key={entry.userId} className={index === 0 ? 'leader' : ''}>
                    <td className="rank">{index + 1}</td>
                    <td className="player-name">{entry.displayName}</td>
                    {episodeNumbers.map((n) => {
                      const epScore = entry.episodeScores.find((es) => es.episodeNumber === n)
                      return (
                        <td key={n} className="episode-score">
                          {epScore ? epScore.score : '—'}
                        </td>
                      )
                    })}
                    <td className="total-score">{entry.totalScore}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="no-data">
          {isMoleRevealed
            ? 'Nog geen scores beschikbaar.'
            : 'Selecteer een kandidaat om het hypothetisch klassement te zien.'}
        </p>
      )}
    </div>
  )
}
