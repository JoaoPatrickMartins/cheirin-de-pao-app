import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { apiFetch } from '../apiFetch'

// Helper: cria uma Response fake com status e json() dado.
function mockRes(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

describe('apiFetch — interceptor de refresh (401)', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('auth_access', 'access-old')
    localStorage.setItem('auth_refresh', 'refresh-1')
    localStorage.setItem('device_id', 'dev-1')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('renova em 401 e refaz a requisição original com o novo access token', async () => {
    const calls: string[] = []
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      calls.push(url)
      if (url.endsWith('/client/profile')) {
        // 1ª vez: 401; depois do refresh, o header Authorization deve estar atualizado
        const auth = (init?.headers as Record<string, string>)?.['Authorization']
        if (auth === 'Bearer access-old') return Promise.resolve(mockRes(401, { error: 'expirado' }))
        return Promise.resolve(mockRes(200, { ok: true }))
      }
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(mockRes(200, { accessToken: 'access-new', refreshToken: 'refresh-2' }))
      }
      return Promise.resolve(mockRes(500, {}))
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await apiFetch('/client/profile')

    expect(res.status).toBe(200)
    // access + refresh atualizados no storage
    expect(localStorage.getItem('auth_access')).toBe('access-new')
    expect(localStorage.getItem('auth_refresh')).toBe('refresh-2')
    // ordem: profile(401) → refresh → profile(retry)
    expect(calls.filter((u) => u.endsWith('/auth/refresh'))).toHaveLength(1)
    expect(calls.filter((u) => u.endsWith('/client/profile'))).toHaveLength(2)
  })

  it('em falha de refresh, limpa a sessão e emite auth:logout', async () => {
    const logoutSpy = vi.fn()
    window.addEventListener('auth:logout', logoutSpy)

    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/auth/refresh')) return Promise.resolve(mockRes(401, { error: 'inválido' }))
      return Promise.resolve(mockRes(401, { error: 'expirado' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await apiFetch('/client/profile')

    expect(res.status).toBe(401)
    expect(logoutSpy).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('auth_access')).toBeNull()
    expect(localStorage.getItem('auth_refresh')).toBeNull()

    window.removeEventListener('auth:logout', logoutSpy)
  })

  it('não tenta refresh para rotas /auth/* (login/otp)', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(mockRes(401, { error: 'E-mail ou senha inválidos' })))
    vi.stubGlobal('fetch', fetchMock)

    const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({}) })

    expect(res.status).toBe(401)
    // Só a chamada original, nenhum refresh
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('single-flight: 401s concorrentes disparam um único /auth/refresh', async () => {
    let profileAuthSeen = 0
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(mockRes(200, { accessToken: 'access-new', refreshToken: 'refresh-2' }))
      }
      const auth = (init?.headers as Record<string, string>)?.['Authorization']
      if (auth === 'Bearer access-old') {
        profileAuthSeen++
        return Promise.resolve(mockRes(401, { error: 'expirado' }))
      }
      return Promise.resolve(mockRes(200, { ok: true }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const [r1, r2] = await Promise.all([apiFetch('/a'), apiFetch('/b')])

    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
    expect(profileAuthSeen).toBe(2) // ambas tomaram 401 inicial
    expect(fetchMock.mock.calls.filter((c) => (c[0] as string).endsWith('/auth/refresh'))).toHaveLength(1)
  })
})
