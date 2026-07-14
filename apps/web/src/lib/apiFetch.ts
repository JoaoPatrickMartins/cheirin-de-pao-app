/**
 * apiFetch — centralized fetch wrapper
 *
 * Injects on every request:
 *   - Content-Type: application/json  (only when the request has a body)
 *   - X-Device-Id: localStorage device_id (generated via crypto.randomUUID() on first use)
 *   - Authorization: Bearer <accessToken>  (only when auth_access exists in localStorage)
 *
 * Sessão em 2 tokens (JWT):
 *   - auth_access  — access token JWT de vida curta (~15 min), enviado como Bearer.
 *   - auth_refresh — refresh token opaco (90 dias), usado em POST /auth/refresh.
 *
 * Interceptor de 401: quando uma requisição autenticada recebe 401, tenta renovar
 * via /auth/refresh (single-flight — 401s concorrentes compartilham UM refresh) e
 * refaz a requisição original UMA vez. Se o refresh falhar, limpa a sessão e emite
 * o evento 'auth:logout' (o AuthContext escuta e desloga/navega).
 *
 * Base URL: VITE_API_URL env var, defaults to http://localhost:3001
 *
 * Returns the raw Response — callers handle .json() and error status themselves.
 *
 * All localStorage access wrapped in try/catch — iOS Safari private mode can throw (Pitfall 6).
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

const ACCESS_KEY = 'auth_access'
const REFRESH_KEY = 'auth_refresh'
const USER_KEY = 'auth_user'

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // localStorage indisponível (iOS Safari private mode) — ignora
  }
}

function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // idem
  }
}

// Fonte ÚNICA do device_id. Gera e persiste na 1ª vez (crypto.randomUUID). Exportada
// para que o corpo das requisições de auth (login/otp/reset) use exatamente o mesmo id
// do header X-Device-Id — evita divergência e o deviceId vazio que o backend rejeita
// (DeviceIdSchema = z.string().min(1)).
export function getDeviceId(): string {
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

function buildFetch(path: string, options: RequestInit): Promise<Response> {
  const deviceId = getDeviceId()
  const token = lsGet(ACCESS_KEY)

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

  return fetch(`${BASE_URL}${path}`, { ...options, headers })
}

// Single-flight: garante que N requisições que tomaram 401 ao mesmo tempo
// disparem UM único /auth/refresh e aguardem o mesmo resultado.
let refreshPromise: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  const refreshToken = lsGet(REFRESH_KEY)
  if (!refreshToken) return false
  const deviceId = getDeviceId()
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Id': deviceId },
      body: JSON.stringify({ refreshToken, deviceId }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { accessToken?: string; refreshToken?: string }
    if (!data.accessToken || !data.refreshToken) return false
    lsSet(ACCESS_KEY, data.accessToken)
    lsSet(REFRESH_KEY, data.refreshToken)
    return true
  } catch {
    return false
  }
}

function refreshSingleFlight(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await buildFetch(path, options)

  // Só tenta refresh: em 401, fora das rotas /auth/* (login/otp/refresh legitimamente
  // retornam 401 e não têm sessão a renovar) e quando existe um refresh token.
  if (res.status !== 401 || path.startsWith('/auth/') || !lsGet(REFRESH_KEY)) {
    return res
  }

  const refreshed = await refreshSingleFlight()
  if (refreshed) {
    // Refaz a requisição original uma única vez com o novo access token.
    return buildFetch(path, options)
  }

  // Refresh falhou → sessão morta. Limpa e avisa o AuthContext.
  lsRemove(ACCESS_KEY)
  lsRemove(REFRESH_KEY)
  lsRemove(USER_KEY)
  try {
    window.dispatchEvent(new Event('auth:logout'))
  } catch {
    // ambiente sem window (SSR/testes) — ignora
  }
  return res
}
