import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'

export default function MagicLinkPage() {
  const [searchParams] = useSearchParams()
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const [error, setError] = useState(token ? '' : 'Ongeldige herstellink.')

  useEffect(() => {
    if (!token) return

    api
      .verifyPasskey(token)
      .then((user) => {
        setUser(user)
        navigate('/login?recovered=true')
      })
      .catch(() => {
        setError('De herstellink is ongeldig of verlopen. Vraag een nieuwe aan.')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="auth-page">
      <h2>Toegang herstellen</h2>
      {error ? (
        <>
          <div className="error-message">{error}</div>
          <a href="/recover" className="btn btn-primary">
            Nieuwe herstelmail aanvragen
          </a>
        </>
      ) : (
        <div className="loading">Bezig met inloggen...</div>
      )}
    </div>
  )
}
