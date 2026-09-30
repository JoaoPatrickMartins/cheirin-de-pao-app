/**
 * Indique e Ganhe — o lado do app: captura do link, montagem do link/mensagem e compartilhamento.
 *
 * A mensagem em si é montada pelo `renderReferralMessage` do shared, a MESMA função da prévia do
 * admin — o que o amigo recebe é exatamente o que o admin viu (V-1 do plano).
 */
import { normalizeReferralCode, renderReferralMessage } from '@cheirin-de-pao/shared'
import { apiFetch } from './apiFetch'

/** Onde o código do link fica guardado até o cadastro. */
export const REFERRAL_STORAGE_KEY = 'cdp_ref'

/** O código do link vale 30 dias: o amigo pode abrir hoje e se cadastrar na semana que vem. */
const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Formato aceito na captura — lixo no `?ref=` não vai parar no cadastro. */
const CODE_RE = /^[A-Z0-9]{3,20}$/

export interface StoredReferral {
  code: string
  source: 'LINK' | 'CODE'
  /** Epoch ms da captura. */
  at: number
}

/**
 * Lê `?ref=CODIGO` da URL (na carga do app), guarda por 30 dias e tira o parâmetro da barra de
 * endereço — sem isso, quem copiasse a URL depois repassaria o código de outra pessoa.
 *
 * O link é `/?ref=` e não `/indique/CODIGO`: não há fallback de SPA no servidor, e a raiz sempre
 * carrega (achado 5 do plano).
 *
 * @returns o código capturado NESTA carga (vai no evento de acesso do funil), ou `null`.
 */
export function captureReferralFromUrl(win: Window = window): string | null {
  try {
    const url = new URL(win.location.href)
    const raw = url.searchParams.get('ref')
    if (raw === null) return null
    url.searchParams.delete('ref')
    win.history.replaceState(win.history.state, '', `${url.pathname}${url.search}${url.hash}`)

    const code = normalizeReferralCode(raw)
    if (!CODE_RE.test(code)) return null
    const stored: StoredReferral = { code, source: 'LINK', at: Date.now() }
    try {
      win.localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(stored))
    } catch {
      // Safari privado / storage cheio: o código ainda vale nesta carga (o cadastro lê `null` e
      // o amigo digita — é por isso que a mensagem sempre leva o código escrito).
    }
    return code
  } catch {
    return null
  }
}

/**
 * O código guardado, se ainda estiver no prazo. No iPhone o PWA instalado não enxerga o
 * `localStorage` do Safari — daí o campo digitável no cadastro ser obrigatório (achado 4).
 */
export function getStoredReferral(now: number = Date.now()): StoredReferral | null {
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredReferral>
    const valid =
      typeof parsed.code === 'string' &&
      CODE_RE.test(parsed.code) &&
      typeof parsed.at === 'number' &&
      now - parsed.at < REFERRAL_TTL_MS
    if (!valid) {
      localStorage.removeItem(REFERRAL_STORAGE_KEY)
      return null
    }
    return { code: parsed.code!, source: parsed.source === 'CODE' ? 'CODE' : 'LINK', at: parsed.at! }
  } catch {
    return null
  }
}

/** Depois do cadastro (201): o código já foi usado. */
export function clearStoredReferral(): void {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY)
  } catch {
    /* sem storage, nada a limpar */
  }
}

/** Link de indicação — a origem do próprio app: certo em dev e em produção sem variável nova. */
export function buildReferralLink(code: string, origin: string = window.location.origin): string {
  return `${origin}/?ref=${encodeURIComponent(code)}`
}

/** A mensagem pronta para compartilhar (mesma função da prévia do admin). */
export function buildReferralMessage(args: {
  template: string
  code: string
  name: string
  welcomeBreads: number
  origin?: string
}): string {
  return renderReferralMessage(args.template, {
    code: args.code,
    link: buildReferralLink(args.code, args.origin),
    name: args.name,
    welcomeBreads: args.welcomeBreads,
  })
}

/** WhatsApp com a mensagem pronta — `wa.me` sem número abre a escolha do contato. */
export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

/** Copia texto. Sem a API de clipboard (contexto inseguro, navegador antigo), cai no `execCommand`. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* cai no fallback */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/**
 * "Mais opções": o menu de compartilhar do celular (Web Share). Sem suporte, copia a mensagem.
 *
 * @returns `shared` (abriu o menu), `copied` (caiu no copiar), `cancelled` (fechou o menu) ou `failed`.
 */
export async function shareReferral(message: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ text: message })
      return 'shared'
    } catch (err) {
      // Fechar o menu é escolha do usuário, não erro — nada de copiar por cima.
      if ((err as { name?: string })?.name === 'AbortError') return 'cancelled'
    }
  }
  return (await copyText(message)) ? 'copied' : 'failed'
}

/** Resposta de `GET /referrals/code/:code` (validação pública do cadastro). */
export interface ReferralCodeCheck {
  valid: boolean
  referrerName?: string
  welcomeBreads?: number
}

/** Confere um código no servidor. Erro de rede conta como "não deu para conferir" (`null`). */
export async function checkReferralCode(code: string): Promise<ReferralCodeCheck | null> {
  const normalized = normalizeReferralCode(code)
  if (!normalized) return { valid: false }
  try {
    const res = await apiFetch(`/referrals/code/${encodeURIComponent(normalized)}`)
    if (!res.ok) return null
    return (await res.json()) as ReferralCodeCheck
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────── tipos das respostas

/** Chave de estado da indicação (API → rótulo na tela). */
export type ReferralStateKey = 'cadastro' | 'aguardando' | 'analise' | 'ganhou' | 'recusada' | 'expirou'

export type ReferralCampaign = { label: string; until: string } | null

export interface ReferralCelebration {
  variant: 'friend' | 'goal' | 'multi' | 'referrer'
  breads: number
  names: string[]
  referrerName: string | null
  goal: { threshold: number; bonus: number; next: { threshold: number; bonus: number } | null } | null
  seen: { referralIds: string[]; goalThresholds: number[]; welcome: boolean }
}

/** `GET /referrals/summary`. */
export interface ReferralSummary {
  active: boolean
  hasReferrals: boolean
  isNew: boolean
  rewardBreads: number
  campaign: ReferralCampaign
  homeCard: { visible: boolean }
  bonusThisMonth: number
  celebration: ReferralCelebration | null
}

/** `GET /referrals/me`. */
export interface ReferralMe {
  state: 'active' | 'paused'
  code: string | null
  messageTemplate: string
  referrerFirstName: string
  rewardBreads: number
  baseRewardBreads: number
  welcomeBreads: number
  campaign: ReferralCampaign
  rules: { prazoDias: number; compraMinima: number }
  stats: { earnedBreads: number; valeram: number; emAndamento: number }
  goals: {
    count: number
    milestones: Array<{ quantidade: number; bonus: number; reached: boolean; paid: boolean }>
    justHit: { quantidade: number; bonus: number } | null
    next: { quantidade: number; bonus: number } | null
  }
  referrals: Array<{
    id: string
    name: string
    state: ReferralStateKey
    date: string
    rewardBreads: number | null
    campaign: boolean
  }>
}

/** "11/10" a partir de "2026-10-11" — o "até 11/10" da campanha. */
export function shortDay(isoDay: string): string {
  const [, m, d] = isoDay.slice(0, 10).split('-')
  return d && m ? `${d}/${m}` : isoDay
}
