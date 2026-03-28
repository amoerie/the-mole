import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import type { Game, Ranking } from '../types';
import ContestantCard from '../components/ContestantCard';
import RankingBoard from '../components/RankingBoard';

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();

  const [game, setGame] = useState<Game | null>(null);
  const [myRankings, setMyRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Admin controls state
  const [newDeadline, setNewDeadline] = useState('');
  const [eliminatedId, setEliminatedId] = useState('');
  const [moleId, setMoleId] = useState('');

  useEffect(() => {
    if (!gameId) return;
    loadGame();
  }, [gameId]);

  async function loadGame() {
    try {
      const [gameData, rankings] = await Promise.all([
        api.getGame(gameId!),
        api.getMyRankings(gameId!).catch(() => [] as Ranking[]),
      ]);
      setGame(gameData);
      setMyRankings(rankings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij laden');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading">Laden...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!game) return <div className="error-message">Spel niet gevonden</div>;

  const isAdmin = user?.userId === game.adminUserId;
  const currentEpisode = game.episodes.length > 0 ? game.episodes[game.episodes.length - 1] : null;
  const isDeadlinePassed = currentEpisode ? new Date(currentEpisode.deadline) < new Date() : true;
  const hasSubmittedCurrent = currentEpisode
    ? myRankings.some(r => r.episodeNumber === currentEpisode.number)
    : false;
  const existingRanking = currentEpisode
    ? myRankings.find(r => r.episodeNumber === currentEpisode.number)
    : undefined;

  const eliminatedIds = new Set(
    game.episodes
      .filter(e => e.eliminatedContestantId)
      .map(e => e.eliminatedContestantId!),
  );
  const activeContestants = game.contestants.filter(c => !eliminatedIds.has(c.id));

  async function handleSubmitRanking(orderedIds: string[]) {
    if (!currentEpisode || !gameId) return;
    setSubmitting(true);
    try {
      await api.submitRanking(gameId, currentEpisode.number, orderedIds);
      setSubmitted(true);
      await loadGame();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij indienen');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateEpisode() {
    if (!gameId || !newDeadline) return;
    try {
      const updated = await api.createEpisode(gameId, newDeadline, eliminatedId || undefined);
      setGame(updated);
      setNewDeadline('');
      setEliminatedId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij aanmaken aflevering');
    }
  }

  async function handleRevealMole() {
    if (!gameId || !moleId) return;
    try {
      const updated = await api.revealMole(gameId, moleId);
      setGame(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij onthullen');
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
          <strong>{game.contestants.find(c => c.id === game.moleContestantId)?.name}</strong>
        </div>
      )}

      <section className="contestants-section">
        <h3>Kandidaten</h3>
        <div className="contestants-grid">
          {game.contestants.map(c => (
            <ContestantCard
              key={c.id}
              contestant={c}
              eliminated={eliminatedIds.has(c.id)}
            />
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

          <div className="admin-card">
            <h4>Nieuwe aflevering</h4>
            <div className="form-row">
              <input
                type="datetime-local"
                value={newDeadline}
                onChange={e => setNewDeadline(e.target.value)}
              />
              <select value={eliminatedId} onChange={e => setEliminatedId(e.target.value)}>
                <option value="">Geen eliminatie</option>
                {activeContestants.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
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
                <select value={moleId} onChange={e => setMoleId(e.target.value)}>
                  <option value="">Selecteer de Mol</option>
                  {game.contestants.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
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
  );
}
