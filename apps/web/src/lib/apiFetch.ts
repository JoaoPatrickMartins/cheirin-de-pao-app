/**
 * Centralized fetch wrapper for Cheirin de Pão API calls.
 * Injects: Authorization Bearer token (if auth_token in localStorage)
 * Injects: X-Device-Id header (always — generates UUID v4 on first call)
 * Base URL: VITE_API_URL ?? 'http://localhost:3001'
 */

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'

function getOrCreateDeviceId(): string {
  try {
    let deviceId = localStorage.getItem('device_id')
    if (!deviceId) {
      // Generate UUID v4 — crypto.randomUUID() is available in all modern browsers
      deviceId = crypto.randomUUID()
      localStorage.setItem('device_id', deviceId)
    }
    return deviceId
  } catch {
    // localStorage unavailable (iOS Safari private mode) — generate ephemeral device ID
    return crypto.randomUUID()
  }
}

function getAuthToken(): string | null {
  try {
    return localStorage.getItem('auth_token')
  } catch {
    return null
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const deviceId = getOrCreateDeviceId()
  const token = getAuthToken()

  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('X-Device-Id', deviceId)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const url = `${BASE_URL}${path}`

  return fetch(url, {
    ...options,
    headers,
    body:
      options.body && typeof options.body === 'object' && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body,
  })
}
