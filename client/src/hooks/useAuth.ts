import { useState, useEffect, createContext, useContext } from 'react'
import type { UserInfo } from '../types'
import { api } from '../api/client'

interface AuthState {
  user: UserInfo | null
  loading: boolean
  error: string | null
  setUser: (user: UserInfo | null) => void
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  error: null,
  setUser: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export { AuthContext }

export function useAuthProvider(): AuthState {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .getMe()
      .then((u) => {
        setUser(u)
        setLoading(false)
      })
      .catch(() => {
        setUser(null)
        setLoading(false)
      })
  }, [])

  return { user, loading, error: null, setUser }
}
