import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import HomePage from './pages/HomePage'
import GamePage from './pages/GamePage'
import LeaderboardPage from './pages/LeaderboardPage'
import './App.css'

function App() {
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        <div className="app">
          <header className="app-header">
            <h1>🕵️ De Mol</h1>
            {auth.user && (
              <div className="user-info">
                <span>{auth.user.displayName}</span>
                <a href="/.auth/logout">Uitloggen</a>
              </div>
            )}
          </header>
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/game/:gameId" element={<GamePage />} />
              <Route path="/game/:gameId/leaderboard" element={<LeaderboardPage />} />
              <Route path="/join/:inviteCode" element={<HomePage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

export default App
