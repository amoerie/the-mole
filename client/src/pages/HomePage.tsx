import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import type { Game } from '../types';

export default function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { inviteCode: routeInviteCode } = useParams<{ inviteCode?: string }>();

  const [games, setGames] = useState<Game[]>([]);
  const [gameName, setGameName] = useState('');
  const [inviteCode, setInviteCode] = useState(routeInviteCode ?? '');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (routeInviteCode && user) {
      handleJoinByInvite(routeInviteCode);
    }
  }, [routeInviteCode, user]);

  useEffect(() => {
    if (!user) return;
    // Load user's games - for now we don't have a list endpoint,
    // so we'll show games from local storage
    const savedGameIds = JSON.parse(localStorage.getItem('myGameIds') ?? '[]') as string[];
    Promise.all(savedGameIds.map(id => api.getGame(id).catch(() => null)))
      .then(results => setGames(results.filter((g): g is Game => g !== null)));
  }, [user]);

  async function handleCreateGame() {
    if (!gameName.trim()) return;
    setError('');
    try {
      const game = await api.createGame(gameName, []);
      saveGameId(game.id);
      navigate(`/game/${game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij aanmaken');
    }
  }

  async function handleJoinByInvite(code: string) {
    setError('');
    setJoining(true);
    try {
      const game = await api.getGameByInvite(code);
      await api.joinGame(game.id, code);
      saveGameId(game.id);
      navigate(`/game/${game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ongeldige uitnodigingscode');
    } finally {
      setJoining(false);
    }
  }

  function saveGameId(gameId: string) {
    const ids = JSON.parse(localStorage.getItem('myGameIds') ?? '[]') as string[];
    if (!ids.includes(gameId)) {
      ids.push(gameId);
      localStorage.setItem('myGameIds', JSON.stringify(ids));
    }
  }

  if (loading) {
    return <div className="loading">Laden...</div>;
  }

  if (!user) {
    return (
      <div className="home-page">
        <div className="login-section">
          <h2>Welkom bij De Mol</h2>
          <p>Log in om mee te spelen</p>
          <div className="login-buttons">
            <a href="/.auth/login/github" className="btn btn-login">
              Inloggen met GitHub
            </a>
            <a href="/.auth/login/aad" className="btn btn-login">
              Inloggen met Microsoft
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <section className="create-game">
        <h2>Nieuw spel aanmaken</h2>
        <div className="form-row">
          <input
            type="text"
            placeholder="Spelnaam"
            value={gameName}
            onChange={e => setGameName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateGame()}
          />
          <button className="btn btn-primary" onClick={handleCreateGame}>
            Aanmaken
          </button>
        </div>
      </section>

      <section className="join-game">
        <h2>Deelnemen aan spel</h2>
        <div className="form-row">
          <input
            type="text"
            placeholder="Uitnodigingscode"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoinByInvite(inviteCode)}
          />
          <button
            className="btn btn-primary"
            onClick={() => handleJoinByInvite(inviteCode)}
            disabled={joining}
          >
            {joining ? 'Bezig...' : 'Deelnemen'}
          </button>
        </div>
      </section>

      {error && <div className="error-message">{error}</div>}

      {games.length > 0 && (
        <section className="my-games">
          <h2>Mijn spellen</h2>
          <ul className="game-list">
            {games.map(game => (
              <li key={game.id}>
                <button className="btn btn-game" onClick={() => navigate(`/game/${game.id}`)}>
                  {game.name}
                  <span className="game-meta">
                    {game.contestants.length} deelnemers · {game.episodes.length} afleveringen
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
