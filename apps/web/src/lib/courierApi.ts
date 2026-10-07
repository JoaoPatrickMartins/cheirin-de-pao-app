import { consumptionUnit } from '@cheirin-de-pao/shared'
import { apiFetch } from './apiFetch'
import type { OpTarget, QueuedOp, SendOutcome } from './courierQueue'

/** Resumo da parada que a API devolve na confirmação e na busca por código (E4). */
export interface StopSummary {
  /** `HOOK` = parada só de gancho (sem pão nem Cestinha no turno). */
  kind: 'BREAD' | 'MARKET' | 'HOOK'
  orderId: string | null
  /** O gancho da parada só de gancho. */
  hookId?: string
  marketOrderIds: string[]
  clientName: string
  condominiumId: string | null
  condominiumName: string
  block: string | null
  complement: string | null
  apartment: string
  quantity: number
  marketItems: Array<{ name: string; qty: number }>
  isFirstOrder: boolean
  hasHook: boolean
  hookToDeliver: { id: string } | null
  status: string
  deliveredAt: string | null
  failedAt: string | null
  proofRequired: boolean
}

export type ConfirmVia = 'SCAN' | 'CODE' | 'LIST'

/** Desfecho da confirmação, já traduzido para o que o pop-up (E4) mostra. */
export type ConfirmResult =
  | { kind: 'ok'; summary: StopSummary }
  | { kind: 'already'; summary: StopSummary | null; message: string }
  | { kind: 'other' }
  | { kind: 'notfound' }
  /** `network` = sem sinal (ou demorou demais); senão o servidor respondeu `status`. */
  | { kind: 'error'; network?: boolean; status?: number }

/** Id de uma operação do entregador (idempotência da fila offline). */
export function newClientOpId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

/** Rota da parada pelo tipo: pão (inclui a Cestinha junto), só Cestinha ou só gancho. */
function stopPath(target: OpTarget, action: 'confirm' | 'not-delivered'): string {
  const base = target.kind === 'HOOK' ? 'hooks' : target.kind === 'MARKET' ? 'market-orders' : 'orders'
  return `/courier/${base}/${target.id}/${action}`
}

/** Na porta do cliente o entregador não espera: sem resposta nesse tempo, a operação vai para a fila. */
const WRITE_TIMEOUT_MS = 8_000
/** A foto sobe em segundo plano — pode demorar mais no 4G do prédio. */
const PHOTO_TIMEOUT_MS = 45_000

/**
 * Faz a requisição com prazo. `network: true` = sem sinal (o aparelho está offline, a conexão
 * falhou ou passou do prazo) — nesse caso a operação vai para a fila.
 */
async function send(path: string, init: RequestInit, timeoutMs: number): Promise<{ res: Response } | { network: true }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { network: true }
  const ctrl = typeof AbortController === 'undefined' ? null : new AbortController()
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    return { res: await apiFetch(path, { ...init, ...(ctrl ? { signal: ctrl.signal } : {}) }) }
  } catch {
    return { network: true }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Identidade da operação: o mesmo `clientOpId` em toda tentativa (fila offline) e o horário real. */
export interface OpIdentity {
  clientOpId?: string
  occurredAt?: string
}

/** Resposta de confirmação/não entrega traduzida para o pop-up (E4). */
async function stopResult(r: { res: Response } | { network: true }, alreadyText: string): Promise<ConfirmResult> {
  if ('network' in r) return { kind: 'error', network: true }
  const { res } = r
  try {
    if (res.ok) return { kind: 'ok', summary: (await res.json()) as StopSummary }
    if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as { error?: string; summary?: StopSummary } | null
      return { kind: 'already', summary: body?.summary ?? null, message: body?.error ?? alreadyText }
    }
  } catch {
    return { kind: 'error', network: true }
  }
  if (res.status === 403) return { kind: 'other' }
  if (res.status === 404) return { kind: 'notfound' }
  return { kind: 'error', status: res.status }
}

/** Confirma a entrega de uma parada (pão, só-Cestinha ou só gancho). Nunca lança. */
export async function confirmStop(target: OpTarget, via: ConfirmVia, op: OpIdentity = {}): Promise<ConfirmResult> {
  const r = await send(
    stopPath(target, 'confirm'),
    { method: 'PATCH', body: JSON.stringify({ via, clientOpId: op.clientOpId ?? newClientOpId(), ...(op.occurredAt ? { occurredAt: op.occurredAt } : {}) }) },
    WRITE_TIMEOUT_MS,
  )
  return stopResult(r, 'Essa entrega já foi confirmada')
}

export interface LookupMatch {
  kind: 'BREAD' | 'MARKET'
  id: string
  summary: StopSummary
}

/** Busca as paradas de hoje pelo código do cupom (E3). null = falha de rede/servidor. */
export async function lookupStopCode(code: string): Promise<LookupMatch[] | null> {
  try {
    const res = await apiFetch(`/courier/stops/lookup?code=${encodeURIComponent(code)}`)
    if (res.status === 404 || res.status === 400) return []
    if (!res.ok) return null
    return ((await res.json()) as { matches: LookupMatch[] }).matches
  } catch {
    return null
  }
}

/** "38 min" · "1h28" */
export function fmtDuration(min: number): string {
  if (min < 60) return `${Math.max(0, Math.round(min))} min`
  return `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`
}

/** "06:42" no horário de Brasília. */
export function brtTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

// ── Não entrega e comprovante (Onda 3) ───────────────────────────────────────

export type Outcome = 'DELIVERED' | 'NOT_DELIVERED'

/** Marca a parada como não entregue com o motivo padronizado (E6). Nunca lança. */
export async function markStopNotDelivered(
  target: OpTarget,
  failureCode: string,
  reason: string | undefined,
  via: ConfirmVia,
  op: OpIdentity = {},
): Promise<ConfirmResult> {
  const r = await send(
    stopPath(target, 'not-delivered'),
    {
      method: 'PATCH',
      body: JSON.stringify({
        failureCode,
        reason: reason?.trim() || undefined,
        via,
        clientOpId: op.clientOpId ?? newClientOpId(),
        ...(op.occurredAt ? { occurredAt: op.occurredAt } : {}),
      }),
    },
    WRITE_TIMEOUT_MS,
  )
  return stopResult(r, 'Essa parada já foi resolvida')
}

/** Status de resposta → destino na fila: 2xx feito; 401/408/429/5xx tenta de novo; outro 4xx descarta. */
function outcomeOf(r: { res: Response } | { network: true }, on503: SendOutcome = { kind: 'retry', network: false }): SendOutcome {
  if ('network' in r) return { kind: 'retry', network: true }
  const { status, ok } = r.res
  if (ok) return { kind: 'done' }
  if (status === 503) return on503
  if (status === 401 || status === 408 || status === 429 || status >= 500) return { kind: 'retry', network: false }
  return { kind: 'discard', reason: 'invalid' }
}

/**
 * Envia a foto do comprovante (multipart). `key` = id do pão, de uma Cestinha ou do gancho (parada só
 * de gancho). Repetir
 * substitui a foto anterior (idempotente). 503 = armazenamento de fotos fora do ar no servidor.
 */
export async function uploadStopProof(key: string, outcome: Outcome, photo: Blob, clientOpId: string = newClientOpId()): Promise<SendOutcome> {
  const form = new FormData()
  form.append('file', photo, 'comprovante.jpg')
  const r = await send(
    `/courier/stops/${key}/proof?outcome=${outcome}&clientOpId=${encodeURIComponent(clientOpId)}`,
    { method: 'POST', body: form },
    PHOTO_TIMEOUT_MS,
  )
  return outcomeOf(r, { kind: 'discard', reason: 'unavailable' })
}

/** Seguir sem foto: `NONE` (exceção da obrigatória, com motivo) ou `SKIPPED` (opcional). */
export async function skipStopProof(
  key: string,
  outcome: Outcome,
  mode: 'NONE' | 'SKIPPED',
  reasonCode?: string,
  text?: string,
): Promise<SendOutcome> {
  const r = await send(
    `/courier/stops/${key}/proof/skip`,
    { method: 'POST', body: JSON.stringify({ outcome, mode, reasonCode, text: text?.trim() || undefined }) },
    WRITE_TIMEOUT_MS,
  )
  return outcomeOf(r)
}

/** Confirmação/não entrega → destino na fila. 409 do MESMO desfecho conta como feito. */
function stopOutcome(r: ConfirmResult, wanted: 'DELIVERED' | 'NOT_DELIVERED'): SendOutcome {
  if (r.kind === 'ok') return { kind: 'done' }
  if (r.kind === 'already') return r.summary?.status === wanted ? { kind: 'done' } : { kind: 'discard', reason: 'resolved' }
  if (r.kind === 'other' || r.kind === 'notfound') return { kind: 'discard', reason: 'invalid' }
  if (r.network) return { kind: 'retry', network: true }
  const status = r.status ?? 500
  if (status === 401 || status === 408 || status === 429 || status >= 500) return { kind: 'retry', network: false }
  return { kind: 'discard', reason: 'invalid' }
}

/** Envia uma operação guardada na fila offline, com o mesmo `clientOpId` e o horário real. */
export async function sendQueuedOp(op: QueuedOp): Promise<SendOutcome> {
  const identity = { clientOpId: op.id, occurredAt: op.occurredAt }
  switch (op.kind) {
    case 'confirm':
      return stopOutcome(await confirmStop(op.target, op.via, identity), 'DELIVERED')
    case 'notDelivered':
      return stopOutcome(await markStopNotDelivered(op.target, op.failureCode, op.reason, op.via, identity), 'NOT_DELIVERED')
    case 'proof':
      return uploadStopProof(op.key, op.outcome, new Blob([op.photo.data], { type: op.photo.type }), op.id)
    case 'proofSkip':
      return skipStopProof(op.key, op.outcome, op.mode, op.reasonCode, op.text)
    case 'message':
      return opsOutcome(await postMessage(op.key, op.template, op.id))
    case 'report': {
      let photoKey: string | null = null
      if (op.photo) {
        const up = await postReportPhoto(new Blob([op.photo.data], { type: op.photo.type }))
        if (up.kind === 'network') return { kind: 'retry', network: true }
        // Sem armazenamento (503) ou foto recusada: a ocorrência sai sem a foto — o texto é o que importa.
        if (up.kind === 'ok') photoKey = up.data.photoKey
        else if (up.status >= 500 && up.status !== 503) return { kind: 'retry', network: false }
      }
      return opsOutcome(await postReport({ ...op.report, ...(photoKey ? { photoKey } : {}) }, op.id))
    }
    case 'hookOutcome':
      return opsOutcome(await postHookOutcome(op.hookId, op.delivered))
  }
}

// ── Operação (Onda 8) ────────────────────────────────────────────────────────

/** Resultado das ações da operação: `network` vai para a fila; `error` traz o `code` do 409. */
export type OpsResult<T> = { kind: 'ok'; data: T } | { kind: 'network' } | { kind: 'error'; status: number; error: string; code?: string }

async function ops<T>(path: string, init: RequestInit, timeoutMs = WRITE_TIMEOUT_MS): Promise<OpsResult<T>> {
  const r = await send(path, init, timeoutMs)
  if ('network' in r) return { kind: 'network' }
  const body = (await r.res.json().catch(() => null)) as (T & { error?: string; code?: string }) | null
  if (r.res.ok) return { kind: 'ok', data: body as T }
  return { kind: 'error', status: r.res.status, error: body?.error ?? 'Não deu certo. Tente de novo.', code: body?.code }
}

function opsOutcome(r: OpsResult<unknown>): SendOutcome {
  if (r.kind === 'ok') return { kind: 'done' }
  if (r.kind === 'network') return { kind: 'retry', network: true }
  if (r.status === 401 || r.status === 408 || r.status === 429 || r.status >= 500) return { kind: 'retry', network: false }
  return { kind: 'discard', reason: 'invalid' }
}

/** E16: recado pronto. 409 `OPT_OUT` (cliente desligou) · `ALREADY` (já enviado hoje). */
export const postMessage = (stopKey: string, template: string, clientOpId: string) =>
  ops<{ sentAt: string }>('/courier/messages', { method: 'POST', body: JSON.stringify({ stopKey, template, clientOpId }) })

/** E11/E12: problema numa entrega realizada ou ocorrência. */
export const postReport = (
  body: { kind: 'STOP_ISSUE' | 'INCIDENT'; stopKey?: string; type: string; text?: string | null; photoKey?: string },
  clientOpId: string,
) => ops<{ id: string; createdAt: string }>('/courier/reports', { method: 'POST', body: JSON.stringify({ ...body, text: body.text?.trim() || undefined, clientOpId }) })

/** E12: foto da ocorrência (privada). */
export function postReportPhoto(photo: Blob) {
  const form = new FormData()
  form.append('file', photo, 'ocorrencia.jpg')
  return ops<{ photoKey: string }>('/courier/reports/photo', { method: 'POST', body: form }, PHOTO_TIMEOUT_MS)
}

/** E7: "Sugerir correção" do acesso do prédio. */
export const postAccessSuggestion = (condominiumId: string, field: string, text: string) =>
  ops<{ id: string }>(`/courier/condos/${condominiumId}/access-suggestions`, { method: 'POST', body: JSON.stringify({ field, text }) })

/** A7: "Deixou o gancho também?" — sim (entregue) ou ficou para outro dia (volta para a fila). */
export const postHookOutcome = (hookId: string, delivered: boolean) =>
  ops<{ status: 'DELIVERED' | 'QUEUE' }>(`/courier/hooks/${hookId}/outcome`, { method: 'POST', body: JSON.stringify({ delivered }) })

/** Acesso do prédio para o entregador (A6/E7). */
export interface CondoAccess {
  portaria: string | null
  temPorteiro: boolean | null
  portao: string | null
  parar: string | null
  obs: string | null
  fotoUrl: string | null
}

// ── Rota do dia (Onda 5) ─────────────────────────────────────────────────────

/** Rota de UM turno (GET /courier/orders/today → routes[]). slotId '' = paradas sem turno. */
export interface SlotRoute {
  slotId: string
  label: string
  emoji: string
  time: string
  /** Prédios na ordem do dia (inclui os já feitos). */
  condominiumIds: string[]
  route: { distanceKm: string; durationMin: number; geometry: Array<[number, number]> } | null
  state: 'pronta' | 'em_rota' | 'encerrada'
  run: { id: string; startedAt: string | null; endedAt: string | null; startMode: string | null } | null
  reorderedToday: boolean
  eta: Array<{ condominiumId: string; time: string | null }>
}

export interface RouteCondo {
  condominiumId: string
  condominiumName: string
  lat: number | null
  lng: number | null
}

export interface RouteBase {
  endereco: string
  lat: number
  lng: number
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number | null; error: string; body?: unknown }

async function call<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const res = await apiFetch(path, init)
    const body = res.status === 204 ? null : await res.json().catch(() => null)
    if (res.ok) return { ok: true, data: body as T }
    return { ok: false, status: res.status, error: (body as { error?: string } | null)?.error ?? 'Não deu certo. Tente de novo.', body }
  } catch {
    return { ok: false, status: null, error: 'Sem sinal agora. Confira a conexão e tente de novo.' }
  }
}

/** E8: inicia a rota do turno (base ou GPS). Os clientes recebem "Saiu para entrega". */
export function startRun(slotId: string, startMode: 'BASE' | 'GPS', pos?: { lat: number; lng: number }) {
  return call<{ run: { id: string }; notified: number }>('/courier/runs/start', {
    method: 'POST',
    body: JSON.stringify({ slotId, startMode, ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) }),
  })
}

/** D-5b: ordem do dia escolhida pelo entregador (vale só hoje). */
export function saveDayOrder(slotId: string, condominiumIds: string[]) {
  return call<{ id: string }>('/courier/runs/order', { method: 'PUT', body: JSON.stringify({ slotId, condominiumIds }) })
}

export function resetDayOrder(slotId: string) {
  return call<{ run: unknown }>(`/courier/runs/order?slotId=${encodeURIComponent(slotId)}`, { method: 'DELETE' })
}

export interface RunStopRef {
  key: string
  refId: string
  condominiumName: string
  clientName: string
  apartment: string
  block: string | null
  outcome?: string
}

export interface RunSummary {
  slotId: string
  label: string
  emoji: string
  time: string
  run: { id: string; status: string; startedAt: string | null; endedAt: string | null } | null
  pending: { stops: RunStopRef[]; noPhoto: RunStopRef[] }
  stats: { delivered: number; notDelivered: number; breads: number; cestinhas: number; ganchos: number; durationMin: number | null }
  km: number | null
  voltaBase: boolean
  fuel: { litros: number; custo: number; kmPorLitro: number; preco: number; combustivel: string } | null
  fuelReason: 'SEM_CONSUMO' | 'SEM_PRECO' | 'SEM_KM' | null
  /** O admin deixa ver km e combustível no Fim da rota (A5). Ausente/falso: esconde. */
  fuelVisible?: boolean
  next: { slotId: string; label: string; emoji: string; time: string; stops: number } | null
}

/** E10: pendências + resumo do turno. */
export function fetchRunSummary(slotId: string) {
  return call<RunSummary>(`/courier/runs/${encodeURIComponent(slotId)}/summary`)
}

/** E10: encerra. 422 traz as pendências em `body.pending`. */
export function endRun(runId: string) {
  return call<{ run: { id: string; endedAt: string | null }; summary: RunSummary }>(`/courier/runs/${runId}/end`, { method: 'POST' })
}

// ── Pessoas (Onda 6) ─────────────────────────────────────────────────────────

export interface CourierMe {
  name: string
  firstName: string
  phone: string | null
  since: string
  photoUrl: string | null
  cpfMasked: string | null
  vehicle: { tipo: string; modelo?: string | null; placa?: string | null; combustivel?: string | null; kmPorLitro?: number | null } | null
  rules: { fotoEntrega: boolean; fotoNaoEntrega: boolean; podeReordenar: boolean; podeRecados: boolean }
  badge: { number: string | null; validUntil: string | null; active: boolean; reason: 'ATIVO' | 'DESATIVADO' | 'VENCIDO' }
  today: { slots: Array<{ slotId: string; label: string; emoji: string }>; condos: string[] }
  deliveries30: number
  scheduleLabel: string
  nextTimeOff: { startDate: string; endDate: string } | null
  /** Alguma tela mostra combustível (switches do A5). Ausente/falso: esconde. */
  showFuel?: boolean
  /** Termo do Entregador Parceiro (plano-termos-legais §6): vigente × última aceita. */
  terms?: { version: string; acceptedVersion: string | null; acceptedAt: string | null }
}

export interface CourierStats {
  days: number
  deliveries: number
  failed: number
  successRate: number | null
  breads: number
  avgRouteMin: number | null
  /** O admin deixa ver km e combustível em Meus números (A5). Ausente/falso: esconde. */
  fuelVisible?: boolean
  km?: number | null
  fuel?: number | null
  perDay: Array<{ date: string; delivered: number; failed: number }>
  recent: Array<{ date: string; delivered: number; failed: number; slots: string[] }>
}

export interface ShiftRef {
  slotId: string
  label: string
  emoji: string
  time: string
}

export interface CourierSchedule {
  weekStart: string
  weekEnd: string
  slots: ShiftRef[]
  week: Array<{ date: string; weekday: string; today: boolean; off: 'FOLGA' | 'FORA_DA_ESCALA' | null; slots: ShiftRef[] }>
  todayOff: 'FOLGA' | 'FORA_DA_ESCALA' | null
  timeOffs: Array<{ startDate: string; endDate: string; reason: string | null }>
  nextShift: (ShiftRef & { date: string }) | null
  scheduleLabel: string
}

export const fetchMe = () => call<CourierMe>('/courier/me')
/** Aceite do Termo do Entregador Parceiro (versão vigente). 409 `OUTDATED` = texto novo. */
export const acceptCourierTerms = (version: string) =>
  call<{ version: string; acceptedAt: string }>('/courier/terms/accept', { method: 'POST', body: JSON.stringify({ version }) })

/** Turno de hoje oferecido ou aceito (plano-termos-legais §5). */
export interface ShiftOffer {
  id: string
  slotId: string
  label: string
  emoji: string
  time: string
  status: 'OFFERED' | 'ACCEPTED'
  stops: number
  offeredAt: string
}
export const fetchShifts = () => call<ShiftOffer[]>('/courier/shifts')
export const acceptShift = (id: string) => call<{ id: string; status: 'ACCEPTED' }>(`/courier/shifts/${id}/accept`, { method: 'POST' })
/** Recusa sem penalidade (motivo opcional). Precisa de sinal: não entra na fila offline (T-T3). */
export const declineShift = (id: string, reason: string | null) =>
  call<{ id: string; status: 'DECLINED'; released: number }>(`/courier/shifts/${id}/decline`, { method: 'POST', body: JSON.stringify({ reason }) })

/** Crachá v3 (Onda 11): segredo do QR (null = crachá inativo/vencido) e a hora do servidor. */
export const fetchBadgeKey = () => call<{ secret: string | null; serverTime: string }>('/courier/badge-key')
export const fetchStats = (days: 7 | 30) => call<CourierStats>(`/courier/stats?days=${days}`)
export const fetchSchedule = () => call<CourierSchedule>('/courier/schedule')

const WEEKDAY_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
/** "2026-10-01" → "Quarta, 01/10" */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${WEEKDAY_LONG[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}
/** "2026-10-12" → "12/10" */
export const ddmm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`
/** Intervalo de folga: "12/10" ou "12/10 a 13/10". */
export const rangeLabel = (a: string, b: string) => (a === b ? ddmm(a) : `${ddmm(a)} a ${ddmm(b)}`)

// ── Ganhos (Onda 7) ──────────────────────────────────────────────────────────

/** Base do combustível da proposta. `reason` = por que ficou fora (sem consumo, sem preço…). */
export interface PayoutFuelBasis {
  kmPorLitro: number | null
  preco: number | null
  combustivel: string | null
  reason: 'NAO_PAGA' | 'NAO_USA' | 'SEM_KM' | 'SEM_CONSUMO' | 'SEM_PRECO' | null
}

export interface CourierEarnings {
  pay: { modalidade: string | null; valor: number | null; pagaCombustivel: boolean } | null
  /** O admin deixa ver a conta do combustível (A5, padrão desligado). Ausente/falso: só o valor. */
  fuelDetailVisible?: boolean
  current: {
    weekStart: string
    weekEnd: string
    entregas: number
    rotas: number
    units: number
    remuneration: number
    /** null quando o admin esconde a conta. */
    km: number | null
    fuel: number
    fuelBasis: PayoutFuelBasis
    total: number
    openRuns: number
  }
  extrato: Array<{
    weekStart: string
    weekEnd: string
    status: 'EM_ANALISE' | 'PAGO' | 'A_PAGAR'
    remuneration: number
    fuel: number
    estimated: number
    final: number
    paidAt: string | null
    dueDate: string | null
  }>
}

/** E13: modalidade, semana em andamento (estimada) e o extrato. */
export const fetchEarnings = () => call<CourierEarnings>('/courier/earnings')

/** "~49,3 km ÷ 38 km/l × R$ 6,09" — no GNV, "km/m³" (Onda 11 · T-38). */
export function fuelFormula(km: number, b: Pick<PayoutFuelBasis, 'kmPorLitro' | 'preco'> & { combustivel?: string | null }): string {
  const n = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
  return `~${n(km)} km ÷ ${n(b.kmPorLitro ?? 0)} ${consumptionUnit(b.combustivel)} × R$ ${(b.preco ?? 0).toFixed(2).replace('.', ',')}`
}

/** Por que o combustível não entrou (texto para o entregador e o admin). */
export const FUEL_REASON_TEXT: Record<NonNullable<PayoutFuelBasis['reason']>, string> = {
  NAO_PAGA: 'O combustível não entra no seu pagamento (combinado com a operação).',
  NAO_USA: 'O veículo cadastrado não usa combustível.',
  SEM_KM: 'Sem rota encerrada na semana — sem km para calcular o combustível.',
  SEM_CONSUMO: 'Sem consumo do veículo cadastrado, o combustível não entra no cálculo.',
  SEM_PRECO: 'Sem preço do combustível cadastrado, o combustível não entra no cálculo.',
}
