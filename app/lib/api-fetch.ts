export function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, options)
}
