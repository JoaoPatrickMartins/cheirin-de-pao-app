/**
 * Login com Google no app — plano: .projeto/docs/plano-login-social.md (§5.4, §9.1).
 *
 *   start → guarda { flowId, secret } aqui → /entrar/social (L3a "Conectando…") → Google
 *   → a API devolve para /?social=<flowId> (captureSocialReturn reescreve para /entrar/social)
 *   → claim { flowId, secret } → entra / completa o cadastro / confirma a conta
 *
 * O `secret` só existe neste aparelho: é ele que prova, no `claim`, que foi este app que começou.
 * No iPhone com o app instalado, o Google abre numa janela do Safari com armazenamento separado —
 * lá o fluxo não existe, a tela mostra "Pode voltar ao app", e o app (que ficou no L3a) busca o
 * resultado quando volta para a tela.
 */
import { apiFetch, getDeviceId } from './apiFetch'

export type SocialProvider = 'google'
/** De onde a pessoa começou — para onde volta se cancelar. */
export type SocialOrigin = 'login' | 'register' | 'account'
export type DisplayMode = 'standalone' | 'browser'

export interface PendingSocialFlow {
  flowId: string
  secret: string
  provider: SocialProvider
  origin: SocialOrigin
  displayMode: DisplayMode
  // URL do Google — o L3a abre ao montar (e o "Tentar de novo" reabre).
  authUrl: string
  createdAt: number
}

export type SocialErrorCode =
  | 'cancelled'
  | 'not_client'
  | 'blocked'
  | 'email_unverified'
  | 'expired'
  | 'already_linked'
  | 'provider_taken'
  | 'provider_error'

export interface SocialAuthUser {
  id: string
  role: 'CLIENT' | 'COURIER' | 'ADMIN'
  name: string
}

export type ClaimResponse =
  | { status: 'PENDING' }
  | {
      status: 'LOGGED_IN'
      accessToken: string
      refreshToken: string
      hasPassword: boolean
      mustSetPassword: boolean
      user: SocialAuthUser
    }
  | { status: 'NEEDS_SIGNUP'; prefill: { name: string; email: string; provider: SocialProvider } }
  | { status: 'NEEDS_LINK'; maskedEmail: string; canUsePassword: boolean }
  | { status: 'LINKED'; provider: SocialProvider }
  | { status: 'ERROR'; code: SocialErrorCode }

const FLOW_KEY = 'cdp_social_flow'
const FLOW_TTL_MS = 60 * 60 * 1000 // igual ao do servidor

// ── Fluxo pendente (localStorage, sempre em try/catch — Safari privado lança) ────
export function readPendingFlow(now: number = Date.now()): PendingSocialFlow | null {
  try {
    const raw = localStorage.getItem(FLOW_KEY)
    if (!raw) return null
    const flow = JSON.parse(raw) as PendingSocialFlow
    if (!flow.flowId || !flow.secret || now - flow.createdAt > FLOW_TTL_MS) {
      localStorage.removeItem(FLOW_KEY)
      return null
    }
    return flow
  } catch {
    return null
  }
}

function savePendingFlow(flow: PendingSocialFlow): void {
  try {
    localStorage.setItem(FLOW_KEY, JSON.stringify(flow))
  } catch {
    // sem storage o fluxo ainda funciona na mesma aba (o claim usa o estado em memória)
  }
}

export function clearPendingFlow(): void {
  try {
    localStorage.removeItem(FLOW_KEY)
  } catch {
    // idem
  }
}

/** App instalado (tela cheia) × navegador. O `claim` só roda no mesmo contexto em que começou. */
export function currentDisplayMode(): DisplayMode {
  try {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    return standalone ? 'standalone' : 'browser'
  } catch {
    return 'browser'
  }
}

// ── Provedores ligados (o botão só aparece se o servidor estiver configurado) ─────
let providersPromise: Promise<{ google: boolean }> | null = null

export function fetchSocialProviders(): Promise<{ google: boolean }> {
  if (!providersPromise) {
    providersPromise = apiFetch('/auth/social/providers')
      .then(async (res) => (res.ok ? ((await res.json()) as { google?: boolean }) : {}))
      .then((d) => ({ google: d.google === true }))
      .catch(() => {
        providersPromise = null // tenta de novo na próxima tela
        return { google: false }
      })
  }
  return providersPromise
}

/** Só para testes: esquece o cache dos provedores. */
export function resetSocialProvidersCache(): void {
  providersPromise = null
}

// ── start ─────────────────────────────────────────────────────────────────────
/**
 * Cria o fluxo no servidor e guarda o segredo. NÃO navega: quem chama leva para /entrar/social,
 * que abre o Google (assim o app fica no L3a enquanto espera — o caso do iPhone).
 * `origin: 'account'` conecta o Google à conta logada (rota autenticada /connect).
 */
export async function startSocial(
  provider: SocialProvider,
  origin: SocialOrigin,
): Promise<{ ok: true; flow: PendingSocialFlow } | { ok: false; error: string }> {
  const path = origin === 'account' ? `/auth/social/${provider}/connect` : `/auth/social/${provider}/start`
  try {
    const res = await apiFetch(path, {
      method: 'POST',
      body: JSON.stringify({ deviceId: getDeviceId() }),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null
      return { ok: false, error: err?.error ?? 'Não foi possível falar com o Google. Tente de novo.' }
    }
    const data = (await res.json()) as { flowId: string; secret: string; authUrl: string }
    const flow: PendingSocialFlow = {
      ...data,
      provider,
      origin,
      displayMode: currentDisplayMode(),
      createdAt: Date.now(),
    }
    savePendingFlow(flow)
    return { ok: true, flow }
  } catch {
    return { ok: false, error: 'Não foi possível falar com o Google. Tente de novo.' }
  }
}

/** Leva o navegador ao Google (página inteira — o PWA do iPhone abre a janela do Safari). */
export function goToProvider(authUrl: string): void {
  window.location.assign(authUrl)
}

// ── claim e passos seguintes ──────────────────────────────────────────────────
async function post<T>(path: string, body: Record<string, unknown>): Promise<{ status: number; data: T | null }> {
  const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) })
  const data = (await res.json().catch(() => null)) as T | null
  return { status: res.status, data }
}

const flowBody = (flow: PendingSocialFlow) => ({ flowId: flow.flowId, secret: flow.secret })

// Um claim por fluxo de cada vez. A API entrega o LOGGED_IN UMA vez só; se a busca roda de novo com
// um claim no ar (StrictMode em dev, ou o AuthProvider terminando de hidratar logo depois da volta do
// Google), um 2º pedido levaria "expirou" e o 1º — o que levou os tokens — seria descartado. Quem pede
// enquanto há um no ar recebe a mesma resposta.
const claimsInFlight = new Map<string, Promise<ClaimResponse | null>>()

export function claimSocial(flow: PendingSocialFlow): Promise<ClaimResponse | null> {
  const inFlight = claimsInFlight.get(flow.flowId)
  if (inFlight) return inFlight
  const claim = requestClaim(flow).finally(() => claimsInFlight.delete(flow.flowId))
  claimsInFlight.set(flow.flowId, claim)
  return claim
}

async function requestClaim(flow: PendingSocialFlow): Promise<ClaimResponse | null> {
  try {
    const { status, data } = await post<ClaimResponse>('/auth/social/claim', { ...flowBody(flow), deviceId: getDeviceId() })
    return status === 200 ? data : null
  } catch {
    return null // rede: quem chama tenta de novo
  }
}

// Erro de campo do vínculo (L6): senha/código errado, código vencido, tentativas esgotadas.
export interface LinkFieldError {
  reason: 'code_wrong' | 'code_expired' | 'no_code' | 'password_wrong' | 'too_many'
  attemptsLeft: number
  error: string
}

export type LinkStepResult = { ok: true; result: ClaimResponse } | { ok: false; field?: LinkFieldError; network?: boolean }

async function linkStep(path: string, body: Record<string, unknown>): Promise<LinkStepResult> {
  try {
    const { status, data } = await post<ClaimResponse & Partial<LinkFieldError>>(path, body)
    if (status === 200 && data) return { ok: true, result: data }
    if (data && 'reason' in data && data.reason) return { ok: false, field: data as LinkFieldError }
    return { ok: false, network: true }
  } catch {
    return { ok: false, network: true }
  }
}

export async function sendLinkCode(flow: PendingSocialFlow): Promise<{ ok: boolean; maskedEmail?: string }> {
  try {
    const { status, data } = await post<{ ok?: boolean; maskedEmail?: string }>('/auth/social/link/code', flowBody(flow))
    return { ok: status === 200 && data?.ok === true, maskedEmail: data?.maskedEmail }
  } catch {
    return { ok: false }
  }
}

export function verifyLinkCode(flow: PendingSocialFlow, code: string): Promise<LinkStepResult> {
  return linkStep('/auth/social/link/code/verify', { ...flowBody(flow), deviceId: getDeviceId(), code })
}

export function linkWithPassword(flow: PendingSocialFlow, password: string): Promise<LinkStepResult> {
  return linkStep('/auth/social/link/password', { ...flowBody(flow), deviceId: getDeviceId(), password })
}

export interface SocialSignupPayload {
  name: string
  cpf: string
  birthDate: string
  phone: string
  condominiumId: string
  apartment: string
  block?: string
  complement?: string
  referralCode?: string
  referralSource?: 'LINK' | 'CODE'
}

export async function completeSocialSignup(
  flow: PendingSocialFlow,
  payload: SocialSignupPayload,
): Promise<{ ok: true; result: ClaimResponse } | { ok: false; status: number; error: string }> {
  try {
    const { status, data } = await post<ClaimResponse & { error?: string }>('/auth/social/complete', {
      ...flowBody(flow),
      deviceId: getDeviceId(),
      ...payload,
    })
    if (status === 200 && data) return { ok: true, result: data }
    return { ok: false, status, error: data?.error ?? 'Algo deu errado. Verifique sua conexão e tente novamente.' }
  } catch {
    return { ok: false, status: 0, error: 'Algo deu errado. Verifique sua conexão e tente novamente.' }
  }
}

// ── contas conectadas (Perfil) ────────────────────────────────────────────────
export interface ConnectedAccount {
  provider: SocialProvider
  email: string | null
  linkedAt: string
}

export async function fetchConnectedAccounts(): Promise<ConnectedAccount[] | null> {
  try {
    const res = await apiFetch('/auth/social/accounts')
    return res.ok ? ((await res.json()) as ConnectedAccount[]) : null
  } catch {
    return null
  }
}

export async function disconnectSocial(provider: SocialProvider): Promise<boolean> {
  try {
    const res = await apiFetch(`/auth/social/${provider}`, { method: 'DELETE' })
    return res.ok
  } catch {
    return false
  }
}

// ── retorno pela raiz do app (T-4) ────────────────────────────────────────────
/**
 * A API devolve o navegador para `/?social=<flowId>` (ou `/?social_error=<código>`), porque a raiz
 * sempre abre. Chamado no boot (main.tsx), ANTES do router: reescreve a URL para /entrar/social,
 * que o router já abre na tela certa. Devolve true quando havia um retorno.
 */
export function captureSocialReturn(win: Window = window): boolean {
  try {
    const url = new URL(win.location.href)
    const flowId = url.searchParams.get('social')
    const error = url.searchParams.get('social_error')
    if (!flowId && !error) return false
    const target = new URLSearchParams()
    if (flowId) target.set('flow', flowId)
    if (error) target.set('erro', error)
    win.history.replaceState(win.history.state, '', `/entrar/social?${target.toString()}`)
    return true
  } catch {
    return false
  }
}
