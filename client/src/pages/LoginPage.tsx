import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { passwordlessClient } from '../lib/passwordless'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  const { setUser } = useAuth()
  const navigate = useNavigate()

  const recovered = searchParams.get('recovered') === 'true'

  async function handleLogin() {
    if (!email.trim()) {
      setError('Voer je e-mailadres in.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await passwordlessClient.signinWithAlias(email.trim())
      if (result.error) {
        setError(result.error.title ?? 'Inloggen mislukt.')
        return
      }
      const user = await api.verifyPasskey(result.token)
      setUser(user)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggen mislukt.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <h2>Inloggen</h2>
      {recovered && (
        <div className="info-message">
          Je bent hersteld. Log in met je e-mailadres en maak daarna een nieuwe passkey aan.
        </div>
      )}
      <div className="form-group">
        <label htmlFor="email">E-mailadres</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
      </div>
      {error && <div className="error-message">{error}</div>}
      <button className="btn btn-primary" onClick={handleLogin} disabled={loading}>
        {loading ? 'Bezig...' : 'Inloggen met passkey'}
      </button>
      <div className="auth-links">
        <Link to="/register">Nieuw account aanmaken →</Link>
        <Link to="/recover">Kan niet inloggen?</Link>
      </div>
    </div>
  )
}
