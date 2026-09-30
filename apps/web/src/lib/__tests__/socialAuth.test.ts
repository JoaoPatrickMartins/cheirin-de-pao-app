// Login com Google no app — guarda do fluxo, retorno pela raiz e chamadas (plano-login-social.md §9.1).
import { vi, describe, it, expect, beforeEach } from 'vitest'

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../apiFetch', () => ({
  apiFetch: api.fetch,
  getDeviceId: () => 'device-1',
}))

import {
  captureSocialReturn,
  claimSocial,
  clearPendingFlow,
  currentDisplayMode,
  fetchSocialProviders,
  readPendingFlow,
  resetSocialProvidersCache,
  startSocial,
  verifyLinkCode,
  type PendingSocialFlow,
} from '../socialAuth'
import { needsPasswordSetup } from '../roleRoutes'
import { isInAppBrowser } from '../inAppBrowser'

function json(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })
}

const FLOW: PendingSocialFlow = {
  flowId: 'flow1',
  secret: 's'.repeat(43),
  provider: 'google',
  origin: 'login',
  displayMode: 'browser',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1',
  createdAt: Date.now(),
}

beforeEach(() => {
  api.fetch.mockReset()
  localStorage.clear()
  resetSocialProvidersCache()
})

describe('startSocial', () => {
  it('login: chama /start, guarda flowId + segredo + origem e NÃO navega', async () => {
    api.fetch.mockReturnValue(json(200, { flowId: 'f1', secret: 'x'.repeat(43), authUrl: 'https://accounts.google.com/a' }))

    const res = await startSocial('google', 'login')

    expect(api.fetch).toHaveBeenCalledWith('/auth/social/google/start', expect.objectContaining({ method: 'POST', body: JSON.stringify({ deviceId: 'device-1' }) }))
    expect(res.ok).toBe(true)
    expect(readPendingFlow()).toMatchObject({ flowId: 'f1', origin: 'login', provider: 'google', authUrl: 'https://accounts.google.com/a' })
  })

  it('Perfil: usa a rota autenticada /connect', async () => {
    api.fetch.mockReturnValue(json(200, { flowId: 'f2', secret: 'x'.repeat(43), authUrl: 'https://accounts.google.com/b' }))
    await startSocial('google', 'account')
    expect(api.fetch.mock.calls[0][0]).toBe('/auth/social/google/connect')
  })

  it('falha do servidor → erro amigável, nada guardado', async () => {
    api.fetch.mockReturnValue(json(404, { error: 'Login com o Google indisponível no momento.' }))
    expect(await startSocial('google', 'login')).toEqual({ ok: false, error: 'Login com o Google indisponível no momento.' })
    expect(readPendingFlow()).toBeNull()
  })
})

describe('fluxo pendente', () => {
  it('some depois de 60 min (igual ao servidor)', () => {
    localStorage.setItem('cdp_social_flow', JSON.stringify({ ...FLOW, createdAt: Date.now() - 61 * 60 * 1000 }))
    expect(readPendingFlow()).toBeNull()
    expect(localStorage.getItem('cdp_social_flow')).toBeNull()
  })

  it('clearPendingFlow apaga', () => {
    localStorage.setItem('cdp_social_flow', JSON.stringify(FLOW))
    clearPendingFlow()
    expect(readPendingFlow()).toBeNull()
  })

  it('localStorage que lança não quebra', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readPendingFlow()).toBeNull()
    spy.mockRestore()
  })
})

describe('claimSocial e vínculo', () => {
  it('manda flowId + segredo + deviceId e devolve o desfecho', async () => {
    api.fetch.mockReturnValue(json(200, { status: 'PENDING' }))
    expect(await claimSocial(FLOW)).toEqual({ status: 'PENDING' })
    expect(JSON.parse(api.fetch.mock.calls[0][1].body)).toEqual({ flowId: 'flow1', secret: FLOW.secret, deviceId: 'device-1' })
  })

  it('rede fora → null (quem chama tenta de novo)', async () => {
    api.fetch.mockRejectedValue(new Error('offline'))
    expect(await claimSocial(FLOW)).toBeNull()
  })

  it('código errado vira erro de campo com tentativas restantes', async () => {
    api.fetch.mockReturnValue(json(401, { error: 'Código não confere.', reason: 'code_wrong', attemptsLeft: 3 }))
    expect(await verifyLinkCode(FLOW, '0000')).toEqual({
      ok: false,
      field: { error: 'Código não confere.', reason: 'code_wrong', attemptsLeft: 3 },
    })
  })
})

describe('fetchSocialProviders', () => {
  it('guarda em memória e trata falha como Google desligado', async () => {
    api.fetch.mockReturnValue(json(200, { google: true }))
    expect(await fetchSocialProviders()).toEqual({ google: true })
    await fetchSocialProviders()
    expect(api.fetch).toHaveBeenCalledTimes(1)

    resetSocialProvidersCache()
    api.fetch.mockRejectedValue(new Error('offline'))
    expect(await fetchSocialProviders()).toEqual({ google: false })
  })
})

describe('captureSocialReturn', () => {
  it('reescreve /?social=<id> para /entrar/social?flow=<id>', () => {
    window.history.replaceState(null, '', '/?social=abc123')
    expect(captureSocialReturn()).toBe(true)
    expect(window.location.pathname + window.location.search).toBe('/entrar/social?flow=abc123')
  })

  it('reescreve /?social_error=expired para /entrar/social?erro=expired', () => {
    window.history.replaceState(null, '', '/?social_error=expired')
    captureSocialReturn()
    expect(window.location.pathname + window.location.search).toBe('/entrar/social?erro=expired')
  })

  it('URL comum não mexe em nada', () => {
    window.history.replaceState(null, '', '/login')
    expect(captureSocialReturn()).toBe(false)
    expect(window.location.pathname).toBe('/login')
  })
})

describe('currentDisplayMode', () => {
  it('browser por padrão; standalone com display-mode do PWA', () => {
    expect(currentDisplayMode()).toBe('browser')
    const original = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q === '(display-mode: standalone)' })) as unknown as typeof window.matchMedia
    expect(currentDisplayMode()).toBe('standalone')
    window.matchMedia = original
  })
})

describe('needsPasswordSetup (T-7)', () => {
  it('a API manda mustSetPassword: vale ele', () => {
    expect(needsPasswordSetup({ hasPassword: false, mustSetPassword: false })).toBe(false) // entrou pelo Google
    expect(needsPasswordSetup({ hasPassword: false, mustSetPassword: true })).toBe(true)
  })

  it('sessão antiga (sem o campo) cai no hasPassword', () => {
    expect(needsPasswordSetup({ hasPassword: false })).toBe(true)
    expect(needsPasswordSetup({ hasPassword: true })).toBe(false)
    expect(needsPasswordSetup({})).toBe(false)
  })
})

describe('isInAppBrowser', () => {
  it('reconhece Instagram e Facebook; navegador comum não', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone) Instagram 300.0')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android) [FBAN/FB4A;FBAV/400.0]')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Mobile Safari/604.1')).toBe(false)
  })
})
