import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api/client'
import type { Game, Ranking } from '../types'
import ContestantCard from '../components/ContestantCard'
import RankingBoard from '../components/RankingBoard'

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { user } = useAuth()

  const [game, setGame] = useState<Game | null>(null)
  const [myRankings, setMyRankings] = useState<Ranking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Admin controls state
  const [newDeadline, setNewDeadline] = useState('')
  const [eliminatedId, setEliminatedId] = useState('')
  const [moleId, setMoleId] = useState('')
  const [newContestantName, setNewContestantName] = useState('')
  const [newContestantAge, setNewContestantAge] = useState('')
  const [newContestantPhoto, setNewContestantPhoto] = useState('')

  const loadGame = useCallback(async () => {
    if (!gameId) return
    try {
      const [gameData, rankings] = await Promise.all([
        api.getGame(gameId),
        api.getMyRankings(gameId).catch(() => [] as Ranking[]),
      ])
      setGame(gameData)
      setMyRankings(rankings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij laden')
    } finally {
      setLoading(false)
    }
  }, [gameId])

  useEffect(() => {
    loadGame()
  }, [loadGame])

  if (loading) return <div className="loading">Laden...</div>
  if (error) return <div className="error-message">{error}</div>
  if (!game) return <div className="error-message">Spel niet gevonden</div>

  const isAdmin = user?.userId === game.adminUserId
  const currentEpisode = game.episodes.length > 0 ? game.episodes[game.episodes.length - 1] : null
  const isDeadlinePassed = currentEpisode ? new Date(currentEpisode.deadline) < new Date() : true
  const hasSubmittedCurrent = currentEpisode
    ? myRankings.some((r) => r.episodeNumber === currentEpisode.number)
    : false
  const existingRanking = currentEpisode
    ? myRankings.find((r) => r.episodeNumber === currentEpisode.number)
    : undefined

  const eliminatedIds = new Set(
    game.episodes.filter((e) => e.eliminatedContestantId).map((e) => e.eliminatedContestantId!),
  )
  const activeContestants = game.contestants.filter((c) => !eliminatedIds.has(c.id))

  async function handleSubmitRanking(orderedIds: string[]) {
    if (!currentEpisode || !gameId) return
    setSubmitting(true)
    try {
      await api.submitRanking(gameId, currentEpisode.number, orderedIds)
      setSubmitted(true)
      await loadGame()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij indienen')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateEpisode() {
    if (!gameId || !newDeadline) return
    try {
      const updated = await api.createEpisode(gameId, newDeadline, eliminatedId || undefined)
      setGame(updated)
      setNewDeadline('')
      setEliminatedId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij aanmaken aflevering')
    }
  }

  async function handleRevealMole() {
    if (!gameId || !moleId) return
    try {
      const updated = await api.revealMole(gameId, moleId)
      setGame(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij onthullen')
    }
  }

  async function handleAddContestant() {
    if (!gameId || !newContestantName.trim()) return
    try {
      const updated = await api.addContestants(gameId, [
        {
          name: newContestantName.trim(),
          age: parseInt(newContestantAge) || 0,
          photoUrl: newContestantPhoto.trim(),
        },
      ])
      setGame(updated)
      setNewContestantName('')
      setNewContestantAge('')
      setNewContestantPhoto('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij toevoegen kandidaat')
    }
  }

  const season14Contestants = [
    {
      name: 'Abigail',
      age: 33,
      photoUrl:
        'https://images.play.tv/styles/037bb38d74600255a0c9e7fa60cc8a6224818ff02baf79e1604ce8d8220cfa85/meta/demols14500x500abigail-tcb0dt.png?style=W3sicmVzaXplIjp7IndpZHRoIjoxMDAsImhlaWdodCI6MTAwfX1d&sign=346a11041038be8f1580d31014f9e5bbdac79ff232f15645ad306554f48ee987',
    },
    {
      name: 'Dries',
      age: 30,
      photoUrl:
        'https://images.play.tv/styles/037bb38d74600255a0c9e7fa60cc8a6224818ff02baf79e1604ce8d8220cfa85/meta/demols14500x500dries-tcb0qr.png?style=W3sicmVzaXplIjp7IndpZHRoIjoxMDAsImhlaWdodCI6MTAwfX1d&sign=6c47133281658861767b356f7ce19a4293dc4d4d97bd053563d6d693a400898f',
    },
    {
      name: 'Isabel',
      age: 51,
      photoUrl:
        'https://images.play.tv/styles/037bb38d74600255a0c9e7fa60cc8a6224818ff02baf79e1604ce8d8220cfa85/meta/demols14500x500isabel-tcb11c.png?style=W3sicmVzaXplIjp7IndpZHRoIjoxMDAsImhlaWdodCI6MTAwfX1d&sign=6509e7b326e32bdb996c8952ab0e76b7b6f8669271714a059053519fa15499ed',
    },
    {
      name: 'Karla',
      age: 52,
      photoUrl:
        'https://images.play.tv/styles/037bb38d74600255a0c9e7fa60cc8a6224818ff02baf79e1604ce8d8220cfa85/meta/demols14500x500karla-tcb19o.png?style=W3sicmVzaXplIjp7IndpZHRoIjoxMDAsImhlaWdodCI6MTAwfX1d&sign=e3a703d2a9f7d47797fc5575afd09f84e5951eb22f996e1ee12c90821d68c729',
    },
    {
      name: 'Maïté',
      age: 26,
      photoUrl:
        'https://images.play.tv/styles/037bb38d74600255a0c9e7fa60cc8a6224818ff02baf79e1604ce8d8220cfa85/meta/demols14500x500maite-tcb1h1.png?style=W3sicmVzaXplIjp7IndpZHRoIjoxMDAsImhlaWdodCI6MTAwfX1d&sign=62dc338146d3a1755612f3fd806d36b212a09a2c38852f98e6bc48aeff8d4d0e',
    },
    {
      name: 'Vincent',
      age: 51,
      photoUrl:
        'https://images.play.tv/styles/037bb38d74600255a0c9e7fa60cc8a6224818ff02baf79e1604ce8d8220cfa85/meta/demols14500x500vincent-tcb1mj.png?style=W3sicmVzaXplIjp7IndpZHRoIjoxMDAsImhlaWdodCI6MTAwfX1d&sign=b35ffdcb0d89954382acb063348173c8d9c89cf4249c2fbaeb81e195344b9061',
    },
    {
      name: 'Wout',
      age: 33,
      photoUrl:
        'https://images.play.tv/styles/037bb38d74600255a0c9e7fa60cc8a6224818ff02baf79e1604ce8d8220cfa85/meta/demols14500x500wout-tcb1pm.png?style=W3sicmVzaXplIjp7IndpZHRoIjoxMDAsImhlaWdodCI6MTAwfX1d&sign=a9427b6f2b9a54a457f266b59c6179b47f1eeec2e079eac353cce5f68e1c9b69',
    },
    {
      name: 'Maxim',
      age: 26,
      photoUrl:
        'https://images.play.tv/styles/037bb38d74600255a0c9e7fa60cc8a6224818ff02baf79e1604ce8d8220cfa85/meta/demols14500x500maxim-tcb1k7.png?style=W3sicmVzaXplIjp7IndpZHRoIjoxMDAsImhlaWdodCI6MTAwfX1d&sign=081ffab64cadff048ca1e218233f40fb5ad4c223b0eaac22abccf9ad2a96f3e8',
    },
    {
      name: 'Julie',
      age: 26,
      photoUrl:
        'https://images.play.tv/styles/037bb38d74600255a0c9e7fa60cc8a6224818ff02baf79e1604ce8d8220cfa85/meta/demols14500x500julie-tcb14l.png?style=W3sicmVzaXplIjp7IndpZHRoIjoxMDAsImhlaWdodCI6MTAwfX1d&sign=ec0909f5fb07b057f6edae24717b8f18e8d59ec1df4a14a7eb14565c826119ed',
    },
    {
      name: 'Kristof',
      age: 40,
      photoUrl:
        'https://images.play.tv/styles/037bb38d74600255a0c9e7fa60cc8a6224818ff02baf79e1604ce8d8220cfa85/meta/demols14500x500kristof-tcb1ct.png?style=W3sicmVzaXplIjp7IndpZHRoIjoxMDAsImhlaWdodCI6MTAwfX1d&sign=8ad452b559f7388c0dfb9d5ad164aca27aae6f265dce858c5597234277063b1d',
    },
  ]

  async function handleLoadSeason14() {
    if (!gameId) return
    try {
      const updated = await api.addContestants(gameId, season14Contestants)
      setGame(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij laden seizoen 14')
    }
  }

  return (
    <div className="game-page">
      <div className="game-header">
        <h2>{game.name}</h2>
        <div className="game-actions">
          <Link to={`/game/${game.id}/leaderboard`} className="btn btn-secondary">
            Klassement
          </Link>
          <span className="invite-code" title="Uitnodigingscode">
            Code: <strong>{game.inviteCode}</strong>
          </span>
        </div>
      </div>

      {game.moleContestantId && (
        <div className="mole-revealed">
          🕵️ De Mol is onthuld:{' '}
          <strong>{game.contestants.find((c) => c.id === game.moleContestantId)?.name}</strong>
        </div>
      )}

      <section className="contestants-section">
        <h3>Kandidaten</h3>
        <div className="contestants-grid">
          {game.contestants.map((c) => (
            <ContestantCard key={c.id} contestant={c} eliminated={eliminatedIds.has(c.id)} />
          ))}
        </div>
      </section>

      {currentEpisode && !game.moleContestantId && (
        <section className="episode-section">
          <h3>Aflevering {currentEpisode.number}</h3>
          <p className="deadline">
            Deadline: {new Date(currentEpisode.deadline).toLocaleString('nl-BE')}
            {isDeadlinePassed && <span className="deadline-passed"> (verstreken)</span>}
          </p>

          {hasSubmittedCurrent || submitted ? (
            <div className="already-submitted">
              ✅ Je rangschikking is ingediend voor deze aflevering.
            </div>
          ) : (
            <RankingBoard
              contestants={activeContestants}
              initialOrder={existingRanking?.contestantIds}
              onSubmit={handleSubmitRanking}
              disabled={isDeadlinePassed || submitting}
            />
          )}
        </section>
      )}

      {!currentEpisode && !game.moleContestantId && (
        <p className="no-episode">Nog geen aflevering gestart.</p>
      )}

      {isAdmin && (
        <section className="admin-section">
          <h3>Beheer</h3>

          {game.contestants.length === 0 && (
            <div className="admin-card">
              <h4>Kandidaten toevoegen</h4>
              <p>
                Je spel heeft nog geen kandidaten. Voeg ze één voor één toe, of laad het huidige
                seizoen.
              </p>
              <button className="btn btn-primary" onClick={handleLoadSeason14}>
                🇧🇪 Seizoen 14 laden (2026)
              </button>
            </div>
          )}

          <div className="admin-card">
            <h4>Kandidaat toevoegen</h4>
            <div className="form-row">
              <input
                type="text"
                placeholder="Naam"
                value={newContestantName}
                onChange={(e) => setNewContestantName(e.target.value)}
              />
              <input
                type="number"
                placeholder="Leeftijd"
                value={newContestantAge}
                onChange={(e) => setNewContestantAge(e.target.value)}
                style={{ width: '100px' }}
              />
              <input
                type="text"
                placeholder="Foto URL (optioneel)"
                value={newContestantPhoto}
                onChange={(e) => setNewContestantPhoto(e.target.value)}
              />
              <button className="btn btn-primary" onClick={handleAddContestant}>
                Toevoegen
              </button>
            </div>
          </div>

          <div className="admin-card">
            <h4>Nieuwe aflevering</h4>
            <div className="form-row">
              <input
                type="datetime-local"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
              />
              <select value={eliminatedId} onChange={(e) => setEliminatedId(e.target.value)}>
                <option value="">Geen eliminatie</option>
                {activeContestants.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={handleCreateEpisode}>
                Aflevering toevoegen
              </button>
            </div>
          </div>

          {!game.moleContestantId && (
            <div className="admin-card">
              <h4>De Mol onthullen</h4>
              <div className="form-row">
                <select value={moleId} onChange={(e) => setMoleId(e.target.value)}>
                  <option value="">Selecteer de Mol</option>
                  {game.contestants.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button className="btn btn-danger" onClick={handleRevealMole}>
                  Onthullen
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
