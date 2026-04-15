/**
 * Wrapper für alle API-Calls vom Frontend.
 * Fügt automatisch den x-api-key Header hinzu, wenn NEXT_PUBLIC_INTERNAL_API_KEY gesetzt ist.
 */
export function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const apiKey = process.env.NEXT_PUBLIC_INTERNAL_API_KEY
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
  })
}
