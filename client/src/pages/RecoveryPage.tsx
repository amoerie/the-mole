import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

export default function RecoveryPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleRecover() {
    if (!email.trim()) {
      setError('Voer je e-mailadres in.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.requestRecovery(email.trim())
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is een fout opgetreden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <h2>Toegang herstellen</h2>
      {success ? (
        <div className="success-message">
          Als dit e-mailadres bekend is bij ons, ontvang je een e-mail met een herstellink.
          Controleer ook je spam.
        </div>
      ) : (
        <>
          <div className="form-group">
            <label htmlFor="email">E-mailadres</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRecover()}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button className="btn btn-primary" onClick={handleRecover} disabled={loading}>
            {loading ? 'Bezig...' : 'Herstelmail versturen'}
          </button>
        </>
      )}
      <div className="auth-links">
        <Link to="/login">← Terug naar inloggen</Link>
      </div>
    </div>
  )
}
