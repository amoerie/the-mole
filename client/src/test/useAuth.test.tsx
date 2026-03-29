import { renderHook, waitFor, act } from '@testing-library/react'
import { createElement } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthProvider, useAuth, AuthContext } from '../hooks/useAuth'
import type { UserInfo } from '../types'

vi.mock('../api/client', () => ({
  api: {
    getMe: vi.fn(),
  },
}))

import { api } from '../api/client'

const testUser: UserInfo = { userId: '1', displayName: 'Test', roles: ['authenticated'] }

describe('useAuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with loading=true and user=null', () => {
    vi.mocked(api.getMe).mockReturnValueOnce(new Promise(() => {}))
    const { result } = renderHook(() => useAuthProvider())
    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('sets user and loading=false when getMe succeeds', async () => {
    vi.mocked(api.getMe).mockResolvedValueOnce(testUser)
    const { result } = renderHook(() => useAuthProvider())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual(testUser)
  })

  it('sets user=null and loading=false when getMe fails', async () => {
    vi.mocked(api.getMe).mockRejectedValueOnce(new Error('Not authenticated'))
    const { result } = renderHook(() => useAuthProvider())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it('setUser updates the user state', async () => {
    vi.mocked(api.getMe).mockResolvedValueOnce(testUser)
    const { result } = renderHook(() => useAuthProvider())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => {
      result.current.setUser({ userId: '2', displayName: 'New User', roles: [] })
    })
    expect(result.current.user?.displayName).toBe('New User')
  })

  it('setUser can set user to null', async () => {
    vi.mocked(api.getMe).mockResolvedValueOnce(testUser)
    const { result } = renderHook(() => useAuthProvider())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => {
      result.current.setUser(null)
    })
    expect(result.current.user).toBeNull()
  })

  it('error is always null', async () => {
    vi.mocked(api.getMe).mockResolvedValueOnce(testUser)
    const { result } = renderHook(() => useAuthProvider())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
  })
})

describe('useAuth', () => {
  it('returns context value from AuthContext.Provider', () => {
    const ctx = {
      user: testUser,
      loading: false,
      error: null,
      setUser: vi.fn(),
    }
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(AuthContext.Provider, { value: ctx }, children)
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.user).toEqual(testUser)
    expect(result.current.loading).toBe(false)
  })
})
