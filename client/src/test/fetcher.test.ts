import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetcher } from '../api/fetcher'

describe('fetcher', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed JSON on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {},
        json: async () => ({ name: 'Test' }),
      }),
    )

    const result = await fetcher<{ data: { name: string } }>('/api/test', { method: 'GET' })
    expect((result as { data: { name: string } }).data).toEqual({ name: 'Test' })
  })

  it('returns undefined data for 204 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: {},
        json: async () => null,
      }),
    )

    const result = await fetcher<{ data: undefined }>('/api/test', { method: 'DELETE' })
    expect((result as { data: undefined }).data).toBeUndefined()
  })

  it('throws with error message from JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: {},
        json: async () => ({ error: 'Ongeldige invoer' }),
      }),
    )

    await expect(fetcher('/api/test', { method: 'POST' })).rejects.toThrow('Ongeldige invoer')
  })

  it('throws with status message when response body has no error field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: {},
        json: async () => ({ message: 'something else' }),
      }),
    )

    await expect(fetcher('/api/test', { method: 'POST' })).rejects.toThrow('API error 500')
  })

  it('throws with status message when response body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        headers: {},
        json: async () => {
          throw new SyntaxError('not json')
        },
      }),
    )

    await expect(fetcher('/api/test', { method: 'GET' })).rejects.toThrow('API error 503')
  })
})
