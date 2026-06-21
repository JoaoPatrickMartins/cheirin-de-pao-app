/**
 * apiFetch — centralized fetch wrapper
 *
 * Injects on every request:
 *   - Content-Type: application/json  (only when the request has a body)
 *   - X-Device-Id: localStorage device_id (generated via crypto.randomUUID() on first use)
 *   - Authorization: Bearer <token>  (only when auth_token exists in localStorage)
 *
 * Base URL: VITE_API_URL env var, defaults to http://localhost:3001
 *
 * Returns the raw Response — callers handle .json() and error status themselves.
 *
 * All localStorage access wrapped in try/catch — iOS Safari private mode can throw (Pitfall 6).
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function getDeviceId(): string {
  try {
    let id = localStorage.getItem('device_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('device_id', id)
    }
    return id
  } catch {
    // localStorage unavailable (iOS Safari private mode) — generate ephemeral ID
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

export function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const deviceId = getDeviceId()
  const token = getAuthToken()

  const headers: Record<string, string> = {
    // Só declara JSON quando há corpo. Requisições sem body (ex.: DELETE) com
    // Content-Type: application/json fazem o Fastify rejeitar com 400
    // FST_ERR_CTP_EMPTY_JSON_BODY antes mesmo de chegar à rota.
    ...(options.body != null ? { 'Content-Type': 'application/json' } : {}),
    'X-Device-Id': deviceId,
    ...(options.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })
}
