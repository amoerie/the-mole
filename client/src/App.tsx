import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import HomePage from './pages/HomePage'
import GamePage from './pages/GamePage'
import LeaderboardPage from './pages/LeaderboardPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RecoveryPage from './pages/RecoveryPage'
import MagicLinkPage from './pages/MagicLinkPage'
import JoinPage from './pages/JoinPage'
import ProfilePage from './pages/ProfilePage'
import { Button } from './components/ui/button'
import { api } from './api/client'
import { initPasswordlessClient } from './lib/passwordless'

function App() {
  const auth = useAuthProvider()

  useEffect(() => {
    api.getConfig().then((config) => initPasswordlessClient(config.passwordlessApiKey))
  }, [])

  return (
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          {auth.user && (
            <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
                <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
                  🕵️ De Mol
                </Link>
                <div className="flex items-center gap-3">
                  <span className="hidden text-sm text-muted-foreground sm:block">
                    <Link to="/profile" className="hover:text-foreground">
                      {auth.user.displayName}
                    </Link>
                  </span>
                  <Button asChild variant="ghost" size="sm">
                    <a href="/api/auth/logout">Uitloggen</a>
                  </Button>
                </div>
              </div>
            </header>
          )}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/join" element={<JoinPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/recover" element={<RecoveryPage />} />
            <Route path="/magic-link" element={<MagicLinkPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/game/:gameId" element={<GamePage />} />
            <Route path="/game/:gameId/leaderboard" element={<LeaderboardPage />} />
            <Route path="/join/:inviteCode" element={<HomePage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

export default App
