import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { passwordlessClient } from '../lib/passwordless'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUser } = useAuth()
  const navigate = useNavigate()

  async function handleRegister() {
    if (!email.trim() || !displayName.trim()) {
      setError('E-mailadres en naam zijn verplicht.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { token } = await api.registerPasskey(email.trim(), displayName.trim())
      const registerResult = await passwordlessClient.register(token, email.trim())
      if (registerResult.error) {
        throw new Error(registerResult.error.title)
      }
      const signinResult = await passwordlessClient.signinWithAlias(email.trim())
      if (signinResult.error) {
        navigate('/login')
        return
      }
      const user = await api.verifyPasskey(signinResult.token)
      setUser(user)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registratie mislukt.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <h2>Account aanmaken</h2>
      <div className="form-group">
        <label htmlFor="email">E-mailadres</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="form-group">
        <label htmlFor="displayName">Naam (zoals zichtbaar voor andere spelers)</label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
        />
      </div>
      {error && <div className="error-message">{error}</div>}
      <button className="btn btn-primary" onClick={handleRegister} disabled={loading}>
        {loading ? 'Bezig...' : 'Account aanmaken'}
      </button>
      <div className="auth-links">
        <Link to="/login">← Terug naar inloggen</Link>
      </div>
    </div>
  )
}
