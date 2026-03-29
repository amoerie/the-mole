/**
 * Custom fetch mutator used by the orval-generated API client.
 * Returns { data, status, headers } — the shape orval's fetch client expects.
 * Centralises Content-Type injection and error-to-exception mapping so the
 * generated functions stay thin typed wrappers.
 */
export const fetcher = async <T>(url: string, options: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error ${response.status}: ${errorText}`)
  }

  const data = response.status === 204 ? undefined : await response.json()

  // Return the wrapped object that orval's fetch client types expect
  return { data, status: response.status, headers: response.headers } as T
}
