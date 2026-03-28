import { useState, useEffect, createContext, useContext } from 'react'
import type { UserInfo } from '../types'
import { api } from '../api/client'

interface AuthState {
  user: UserInfo | null
  loading: boolean
  error: string | null
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, error: null })

export function useAuth() {
  return useContext(AuthContext)
}

export { AuthContext }

export function useAuthProvider(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null })

  useEffect(() => {
    api
      .getMe()
      .then((user) => setState({ user, loading: false, error: null }))
      .catch(() => setState({ user: null, loading: false, error: null }))
  }, [])

  return state
}
