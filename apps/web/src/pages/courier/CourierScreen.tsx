import { useState, useEffect, useCallback, useMemo, useRef, type ComponentProps } from 'react'
import { blockLabel, compareUnits, matchesStopCode, type FailureCode, type NoPhotoReason } from '@cheirin-de-pao/shared'
import { apiFetch } from '../../lib/apiFetch'
import { getGreeting } from '../../lib/greeting'
import { Icon } from '../../components/brand/Icon'
import { useAuth } from '../../hooks/useAuth'
import { ProgressCard } from '../../components/courier/ProgressCard'
import { SegmentedControl, CourierTab } from '../../components/courier/SegmentedControl'
import { CondoAccordion, CondoGroup } from '../../components/courier/CondoAccordion'
import { ConfirmSheet } from '../../components/courier/ConfirmSheet'
import { FailSheet } from '../../components/courier/FailSheet'
import { CourierCompletedList, CompletedCondo, type CompletedStop } from '../../components/courier/CourierCompletedList'
import { Stop, stopKey } from '../../components/courier/StopRow'
import { CourierRouteView } from './CourierRouteView'
import { CourierEndRun } from './CourierEndRun'
import { CourierProfile } from './CourierProfile'
import { CourierBadge } from './CourierBadge'
import { CourierNumbers } from './CourierNumbers'
import { CourierEarnings } from './CourierEarnings'
import { CourierOps } from './CourierOps'
import { RecadoSheet, ReportSheet, AccessSuggestSheet, type OpsSendResult } from '../../components/courier/OpsSheets'
import { NavAppSheet } from '../../components/courier/NavAppSheet'
import { getPreferredNavApp, navUrl } from '../../lib/navLinks'
import { CourierSchedule } from './CourierSchedule'
import { CourierNoDeliveries } from '../../components/courier/CourierWeek'
import { RouteTodayCard, type RouteLine } from '../../components/courier/RouteTodayCard'
import { StartRunSheet } from '../../components/courier/StartRunSheet'
import { useCourierPosition } from '../../hooks/useCourierPosition'
import { useWakeLock } from '../../hooks/useWakeLock'
import { PushNotificationToggle } from '../../components/PushNotificationToggle'
import { ScanScreen } from '../../components/courier/camera/ScanScreen'
import { ResultPopup, type ResultKind } from '../../components/courier/camera/ResultPopup'
import { CodeSheet, type CodeSubmitResult } from '../../components/courier/camera/CodeSheet'
import { NoPhotoSheet } from '../../components/courier/camera/NoPhotoSheet'
import { CourierDock, type DockMode } from '../../components/courier/CourierDock'
import { CRAvatar, CRBig, CRNote, CRSheet, CRSync, CRToast, type CRProofState } from '../../components/courier/kit'
import {
  brtTime,
  confirmStop,
  fetchMe,
  fetchBadgeKey,
  acceptCourierTerms,
  fetchShifts,
  acceptShift,
  declineShift,
  type ShiftOffer,
  fetchSchedule,
  postAccessSuggestion,
  postHookOutcome,
  postMessage,
  postReport,
  postReportPhoto,
  lookupStopCode,
  markStopNotDelivered,
  newClientOpId,
  type ConfirmResult,
  type ConfirmVia,
  type CourierMe,
  type CourierSchedule as Schedule,
  type LookupMatch,
  type Outcome,
  type RouteBase,
  type RouteCondo,
  type RunStopRef,
  type SlotRoute,
  type StopSummary,
  startRun,
} from '../../lib/courierApi'
import { loadRoute, pendingStops, photoForQueue, saveRoute, type OpTarget, type QueuedOp, type SendOutcome } from '../../lib/courierQueue'
import { clearBadgeCache, loadBadgeCache, saveBadgeCache } from '../../lib/courierBadgeCache'
import { TermsGate, CourierTermsBody } from '../../components/courier/TermsGate'
import { ShiftOfferCard, DeclineShiftSheet } from '../../components/courier/ShiftOffer'
import { CourierPage, CRCard } from '../../components/courier/CourierPage'
import type { ShiftDeclineReason } from '@cheirin-de-pao/shared'
import { useCourierSync } from '../../hooks/useCourierSync'
import { beep, unlockBeep } from '../../lib/beep'
import { warmUpQrDetector } from '../../lib/qrDetector'

interface SlotInfo {
  slotId: string
  label: string
  emoji: string
  time: string
}

interface TodayOrdersResponse {
  condos: CondoGroup[]
  totalStops: number
  totalBreads: number
  totalItems: number
  routes: SlotRoute[]
  slots: SlotInfo[]
  completed: Array<Omit<CompletedCondo, 'stops'> & { stops: Array<CompletedCondo['stops'][number] & { proofStatus?: string | null }> }>
  completedTotal: number
  /** Regras do entregador definidas pelo admin (foto obrigatória etc.). */
  rules?: { fotoEntrega: boolean; fotoNaoEntrega: boolean; podeReordenar: boolean; podeRecados: boolean }
  /** Base de saída (null = não definida). */
  base?: RouteBase | null
  /** Prédios de todas as rotas (inclusive os só concluídos), com coordenada. */
  routeCondos?: RouteCondo[]
}

/** Prédios na ordem da rota do turno (os que não estão nela, no fim, como vieram). */
function byRouteOrder<T extends { condominiumId: string }>(items: T[], order: string[] | undefined): T[] {
  if (!order?.length) return items
  const pos = new Map(order.map((id, i) => [id, i]))
  return [...items].sort((a, b) => (pos.get(a.condominiumId) ?? 1e6) - (pos.get(b.condominiumId) ?? 1e6))
}

// Ordena por bloco → complemento → apartamento — espelha a ordenação do backend
// (compareUnits) para a lista de concluídas mesclada.
const byBlockThenApartment = compareUnits

// Data por extenso (ex.: "Sexta-feira, 27 de junho") — deixa clara a data da entrega.
function getTodayLabel(): string {
  const now = new Date()
  const full = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(now)
  return full.charAt(0).toUpperCase() + full.slice(1)
}

/** Pop-up de resultado (E4) aberto: sobre a câmera (`dark`) ou sobre a lista. */
interface PopupState {
  kind: ResultKind
  summary?: StopSummary | null
  message?: string
  dark: boolean
}

type ConfirmTarget = OpTarget

/** Sheet aberto sobre a lista (E6): confirmar ou "não consegui entregar". */
type ListSheet = { kind: 'confirm' | 'fail'; stop: Stop; condominiumName: string } | null

/** Foto do comprovante em andamento (E5) — a câmera abre (ou fica) no modo foto. */
interface PhotoTask {
  /** Id que a API aceita em `/courier/stops/:key/proof` (pão ou uma Cestinha da parada). */
  key: string
  /** Chave da parada na tela (selo do comprovante). */
  localKey: string
  outcome: Outcome
  required: boolean
  caption: string
  /** Veio da lista: ao terminar, fecha a câmera em vez de voltar a ler. */
  fromList: boolean
}

/** Status do comprovante no servidor → selo da parada. */
const PROOF_FROM_SERVER: Record<string, CRProofState> = { PENDING: 'pendente', OK: 'ok', NONE: 'sem', SKIPPED: 'pulada' }

type ToastState = { text: string; icon?: ComponentProps<typeof CRToast>['icon']; tone?: 'good' | 'gold' }

/** Resultado de uma confirmação, incluindo a guardada na fila sem sinal (Onda 4). */
type AttemptResult = ConfirmResult | { kind: 'saved'; summary: StopSummary }

/** Falha que vale guardar e reenviar: sem sinal, prazo estourado ou erro do servidor. */
function retryable(r: ConfirmResult): boolean {
  if (r.kind !== 'error') return false
  if (r.network || r.status === undefined) return true
  return r.status >= 500 || r.status === 401 || r.status === 408 || r.status === 429
}

/** Ordem de criação estritamente crescente (a confirmação sempre antes da foto da mesma parada). */
let lastOrder = 0
function nextOrder(): number {
  lastOrder = Math.max(Date.now(), lastOrder + 1)
  return lastOrder
}

/** Resumo montado com o que o aparelho já sabe — sem sinal não há resposta do servidor. */
function localSummary(stop: Stop, condo: { condominiumId: string; condominiumName: string }, outcome: Outcome, proofRequired: boolean, at: string): StopSummary {
  return {
    kind: stop.hookId ? 'HOOK' : stop.orderId ? 'BREAD' : 'MARKET',
    orderId: stop.orderId || null,
    ...(stop.hookId ? { hookId: stop.hookId } : {}),
    marketOrderIds: stop.marketOrderIds?.length ? stop.marketOrderIds : stop.marketOrderId ? [stop.marketOrderId] : [],
    clientName: stop.clientName,
    condominiumId: condo.condominiumId,
    condominiumName: condo.condominiumName,
    block: stop.block,
    complement: stop.complement ?? null,
    apartment: stop.apartment,
    quantity: stop.quantity,
    marketItems: stop.marketItems ?? [],
    isFirstOrder: false,
    hasHook: false,
    hookToDeliver: stop.hookId ? null : stop.hookToDeliver ?? null,
    status: outcome,
    deliveredAt: outcome === 'DELIVERED' ? at : null,
    failedAt: outcome === 'NOT_DELIVERED' ? at : null,
    proofRequired,
  }
}

/** Ids que endereçam uma parada na tela (ativa ou concluída). */
type StopIds = { orderId: string; marketOrderId?: string; marketOrderIds?: string[]; hookId?: string }

/** O resumo da API se refere a esta parada? Pelo gancho (só gancho), pelo pão ou pelas Cestinhas. */
function sameStop(s: StopIds, summary: StopSummary): boolean {
  if (summary.hookId) return s.hookId === summary.hookId
  if (summary.orderId) return s.orderId === summary.orderId
  return (s.marketOrderIds ?? []).some((id) => summary.marketOrderIds.includes(id)) || (!!s.marketOrderId && summary.marketOrderIds.includes(s.marketOrderId))
}

/** "Foto da entrega · Apto 101 · Bloco 2" */
function photoCaption(outcome: Outcome, s: { apartment: string; block: string | null; clientName: string }): string {
  const head = outcome === 'DELIVERED' ? 'Foto da entrega' : 'Foto da não entrega'
  const where = [s.apartment ? `Apto ${s.apartment}` : s.clientName, s.block ? blockLabel(s.block) : null].filter(Boolean).join(' · ')
  return `${head} · ${where}`
}

/** Chaves das paradas ATIVAS — usadas para perceber entregas novas atribuídas durante o dia. */
function activeStopKeys(d: TodayOrdersResponse): string[] {
  return (d.condos ?? []).flatMap((c) => c.stops.map((s) => stopKey(s)))
}

/** Intervalo da atualização em segundo plano com a tela aberta (M-1). */
const BACKGROUND_REFRESH_MS = 60_000

export function CourierScreen() {
  const { user, logout } = useAuth()
  const courierId = user?.id ?? null
  const [data, setData] = useState<TodayOrdersResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Sem sinal ao abrir: a rota guardada neste aparelho (hora em que foi baixada).
  const [fromCache, setFromCache] = useState<string | null>(null)
  const [tab, setTab] = useState<CourierTab>('list')
  const [openAccordion, setOpenAccordion] = useState(0)
  // Resolvidas nesta sessão com resposta do servidor. As guardadas na fila entram pela fila.
  const [sessionConfirmed, setSessionConfirmed] = useState<Set<string>>(new Set())
  const [sessionNotDelivered, setSessionNotDelivered] = useState<Set<string>>(new Set())
  const [sheet, setSheet] = useState<ListSheet>(null)
  const [failError, setFailError] = useState<string | null>(null)
  // Não entrega guardada sem sinal: o FailSheet mostra "Guardado · seguir para a foto".
  const [failSaved, setFailSaved] = useState<StopSummary | null>(null)
  const [logoutOpen, setLogoutOpen] = useState(false)
  // Pessoas (Onda 6): perfil, crachá, números e escala abrem por cima da tela principal.
  const [page, setPage] = useState<'perfil' | 'cracha' | 'ganhos' | 'numeros' | 'escala' | 'operacao' | 'termo' | null>(null)
  // Turnos de hoje (plano-termos-legais §5): aceitar ou recusar, sem penalidade.
  const [shifts, setShifts] = useState<ShiftOffer[]>([])
  const [declineFor, setDeclineFor] = useState<ShiftOffer | null>(null)
  const [shiftBusy, setShiftBusy] = useState(false)
  const [me, setMe] = useState<CourierMe | null>(null)
  // Crachá v3 (Onda 11 · H-11): segredo do QR e diferença de relógio, guardados no aparelho.
  const [badgeKey, setBadgeKey] = useState<{ secret: string | null; offsetMs: number }>({ secret: null, offsetMs: 0 })
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  // Operação (Onda 8): recado, problema na entrega, sugestão de acesso, navegar até o prédio.
  const [recadoFor, setRecadoFor] = useState<Stop | null>(null)
  const [reportFor, setReportFor] = useState<CompletedStop | null>(null)
  const [accessFor, setAccessFor] = useState<CondoGroup | null>(null)
  const [navFor, setNavFor] = useState<CondoGroup | null>(null)
  const [reportedKeys, setReportedKeys] = useState<Set<string>>(new Set())
  // Rota do dia (E8–E10): sheet de iniciar e a tela de encerrar.
  const [startFor, setStartFor] = useState<string | null>(null)
  const [endFor, setEndFor] = useState<string | null>(null)
  // Comprovante (E5): foto em andamento, "sem foto" aberto e o selo de cada parada nesta sessão.
  const [photoTask, setPhotoTask] = useState<PhotoTask | null>(null)
  const [noPhotoOpen, setNoPhotoOpen] = useState(false)
  const [proofStates, setProofStates] = useState<Map<string, CRProofState>>(new Map())
  // Câmera contínua (E2–E4): scanner aberto, pop-up de resultado e "Digitar código".
  const [scanOpen, setScanOpen] = useState(false)
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [codeOpen, setCodeOpen] = useState(false)
  // Confirmando o cupom lido: a câmera fica congelada até o pop-up aparecer.
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  // Atualização (M-1): dados novos com entregas a mais esperam o "Atualizar" do entregador, para a
  // lista não mudar debaixo do dedo dele.
  const [pending, setPending] = useState<TodayOrdersResponse | null>(null)
  const [newCount, setNewCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const dataRef = useRef<TodayOrdersResponse | null>(null)
  dataRef.current = data
  const pullStartY = useRef<number | null>(null)

  const setProof = (key: string, state: CRProofState) => setProofStates((prev) => new Map(prev).set(key, state))

  /** Uma operação guardada subiu ou foi descartada (fila offline). */
  const onSyncResult = (op: QueuedOp, out: SendOutcome) => {
    if (op.kind === 'proof') {
      setProof(op.stopKey, out.kind === 'done' ? 'ok' : 'sem')
      return
    }
    if (op.kind === 'proofSkip') return
    if (out.kind === 'done') {
      // Sai da fila: passa a valer como resolvida na sessão.
      const add = (prev: Set<string>) => new Set([...prev, op.stopKey])
      if (op.kind === 'confirm') setSessionConfirmed(add)
      else setSessionNotDelivered(add)
      return
    }
    setToast(
      out.kind === 'discard' && out.reason === 'resolved'
        ? { text: 'Uma entrega guardada já tinha sido resolvida pela operação.', icon: 'alert', tone: 'gold' }
        : { text: 'Uma entrega guardada não pôde ser enviada. Fale com a operação.', icon: 'alert', tone: 'gold' },
    )
    void load('manual')
  }
  const sync = useCourierSync(courierId, onSyncResult)
  const pendingCount = pendingStops(sync.ops).size

  // Resolvidas na tela = sessão + guardadas na fila (inclusive as que sobreviveram a fechar o app).
  const confirmedIds = useMemo(
    () => new Set([...sessionConfirmed, ...sync.ops.filter((o) => o.kind === 'confirm').map((o) => o.stopKey)]),
    [sessionConfirmed, sync.ops],
  )
  const notDeliveredIds = useMemo(
    () => new Set([...sessionNotDelivered, ...sync.ops.filter((o) => o.kind === 'notDelivered').map((o) => o.stopKey)]),
    [sessionNotDelivered, sync.ops],
  )
  // Selo da foto: o que já se resolveu na sessão + o que ainda está na fila.
  const proofView = useMemo(() => {
    const m = new Map(proofStates)
    for (const op of sync.ops) {
      if (op.kind !== 'proof') continue
      m.set(op.stopKey, sync.offline ? 'pendente' : sync.sending ? 'enviando' : op.attempts > 0 ? 'falhou' : 'enviando')
    }
    return m
  }, [proofStates, sync.ops, sync.offline, sync.sending])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // Baixa o leitor de QR do iPhone enquanto há sinal (no Android/Chrome não faz nada).
  useEffect(() => {
    warmUpQrDetector()
  }, [])

  /**
   * Carrega a rota do dia. `background` (volta ao app, intervalo) segura dados com entregas NOVAS
   * para o banner "N entregas novas"; sem novidade, aplica direto.
   */
  const refreshShifts = useCallback(async () => {
    const r = await fetchShifts()
    if (r.ok && Array.isArray(r.data)) setShifts(r.data)
  }, [])

  const load = useCallback(async (mode: 'initial' | 'manual' | 'background') => {
    if (mode === 'manual') setRefreshing(true)
    void refreshShifts()
    try {
      const res = await apiFetch('/courier/orders/today')
      if (!res.ok) return
      const next = (await res.json()) as TodayOrdersResponse
      // Guarda a rota do dia para abrir o app sem sinal no corredor.
      if (courierId) void saveRoute(courierId, next).catch(() => {})
      setFromCache(null)
      const current = dataRef.current
      if (mode === 'background' && current) {
        const before = new Set(activeStopKeys(current))
        const added = activeStopKeys(next).filter((k) => !before.has(k)).length
        if (added > 0) {
          setPending(next)
          setNewCount(added)
          return
        }
      }
      setData(next)
      setPending(null)
      setNewCount(0)
    } catch {
      // Sem sinal: mantém o estado anterior. Abrindo agora, usa a rota guardada de hoje.
      if (!dataRef.current && courierId) {
        const cached = await loadRoute<TodayOrdersResponse>(courierId).catch(() => null)
        if (cached && !dataRef.current) {
          setData(cached.data)
          setFromCache(cached.savedAt)
        }
      }
    } finally {
      setIsLoading(false)
      if (mode === 'manual') setRefreshing(false)
    }
  }, [courierId])

  useEffect(() => {
    void load('initial')
  }, [load])

  /** Perfil + segredo do crachá: com sinal, atualiza e guarda no aparelho (T-27). */
  const refreshBadge = useCallback(async (): Promise<CourierMe | null> => {
    const [r, k] = await Promise.all([fetchMe(), fetchBadgeKey()])
    if (r.ok) {
      setMe(r.data)
      saveBadgeCache(courierId, { me: r.data })
    }
    if (k.ok) {
      const next = { secret: k.data.secret, offsetMs: Date.parse(k.data.serverTime) - Date.now() || 0 }
      setBadgeKey(next)
      saveBadgeCache(courierId, next)
    }
    return r.ok ? r.data : null
  }, [courierId])

  // Perfil (nome, foto, crachá) e escala — sem sinal, a tela segue com o crachá guardado no
  // aparelho (ou com o nome do login, se nunca abriu com sinal).
  useEffect(() => {
    let alive = true
    const cached = loadBadgeCache(courierId)
    if (cached) {
      if (cached.me) setMe((m) => m ?? cached.me)
      setBadgeKey({ secret: cached.secret, offsetMs: cached.offsetMs })
    }
    void refreshBadge()
    void fetchSchedule().then((r) => alive && r.ok && setSchedule(r.data))
    return () => {
      alive = false
    }
  }, [courierId, refreshBadge])

  /**
   * E15: abre na hora com o que já está no aparelho e atualiza o status e o segredo por trás. Sem
   * sinal e sem nada guardado, avisa.
   */
  const openBadge = async () => {
    if (me) setPage('cracha')
    const fresh = await refreshBadge()
    if (fresh) setPage('cracha')
    else if (!me) setToast({ text: 'Sem sinal: abra o app com sinal uma vez para guardar o crachá neste aparelho.', icon: 'cloudOff', tone: 'gold' })
  }

  // Volta ao app (inclusive pelo push "Novas entregas") e de minuto em minuto com a tela aberta.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load('background')
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load('background')
    }, BACKGROUND_REFRESH_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [load])

  const applyPending = () => {
    if (pending) setData(pending)
    setPending(null)
    setNewCount(0)
  }

  // ── Câmera contínua ────────────────────────────────────────────────────────

  /** Paradas carregadas (ativas + concluídas) — para achar o cupom sem ir ao servidor. */
  const knownStops = (): StopIds[] => [
    ...(data?.condos ?? []).flatMap((c) => c.stops),
    ...(data?.completed ?? []).flatMap((c) => c.stops),
  ]

  /** Alvo da confirmação a partir do texto do QR (o id do pedido ou da Cestinha). */
  const targetFromQr = (text: string): ConfirmTarget | null => {
    const code = text.trim()
    const stop = knownStops().find((s) => s.orderId === code || s.marketOrderId === code || (s.marketOrderIds ?? []).includes(code))
    if (!stop) return null
    // Parada combinada confirma pelo pão; só-Cestinha, pela Cestinha.
    return stop.orderId ? { kind: 'BREAD', id: stop.orderId } : { kind: 'MARKET', id: stop.marketOrderId ?? code }
  }

  /** Marca a parada como entregue na tela (sem refazer a rota). Parada fora da lista → recarrega. */
  const markDelivered = (summary: StopSummary) => {
    const stops = (data?.condos ?? []).flatMap((c) => c.stops)
    const stop = stops.find((s) => sameStop(s, summary))
    if (stop) setSessionConfirmed((prev) => new Set([...prev, stopKey(stop)]))
    else void load('manual')
  }

  /** Chave da parada na tela a que um resumo da API se refere (ativa ou concluída). */
  const localKeyOf = (summary: StopSummary): string => {
    const found = knownStops().find((s) => sameStop(s, summary))
    return found ? found.orderId || found.marketOrderId || found.hookId || '' : summary.orderId ?? summary.marketOrderIds[0] ?? summary.hookId ?? ''
  }

  /** E5: abre a foto do comprovante da parada recém-resolvida, na mesma câmera. */
  const startPhoto = (summary: StopSummary, outcome: Outcome, fromList: boolean) => {
    // A API acha a parada pelo pão, por uma Cestinha ou, na parada só de gancho, pelo gancho.
    const key = summary.orderId ?? summary.marketOrderIds[0] ?? summary.hookId
    if (!key) return
    const localKey = localKeyOf(summary)
    setProof(localKey, 'pendente')
    setPhotoTask({ key, localKey, outcome, required: summary.proofRequired, caption: photoCaption(outcome, summary), fromList })
    if (fromList) setScanOpen(true)
  }

  /** Fim da foto (enviada, pulada ou sem foto): volta a ler ou, vindo da lista, fecha a câmera. */
  const finishPhoto = (task: PhotoTask, next?: ToastState) => {
    setPhotoTask(null)
    setNoPhotoOpen(false)
    if (task.fromList) setScanOpen(false)
    if (next) setToast(next)
  }

  /** Base comum das operações guardadas na fila. */
  const opBase = (localKey: string, id: string = newClientOpId(), occurredAt: string = new Date().toISOString()) => ({
    id,
    courierId: courierId ?? '',
    stopKey: localKey,
    occurredAt,
    createdAt: nextOrder(),
    attempts: 0,
  })

  /**
   * A foto SEMPRE passa pela fila (guardada no aparelho) e sobe em segundo plano — o entregador já
   * segue para a próxima parada, e fechar o app não perde a foto.
   */
  const queuePhoto = async (task: PhotoTask, blob: Blob) => {
    if (!courierId) return
    await sync.enqueue({ ...opBase(task.localKey), kind: 'proof', key: task.key, outcome: task.outcome, photo: await photoForQueue(blob) })
  }

  /** "Pular" (opcional) ou "sem foto" com motivo (obrigatória) — também pela fila. */
  const queueSkip = (task: PhotoTask, mode: 'NONE' | 'SKIPPED', reasonCode?: string, text?: string) => {
    if (!courierId) return Promise.resolve()
    return sync.enqueue({ ...opBase(task.localKey), kind: 'proofSkip', key: task.key, outcome: task.outcome, mode, reasonCode, text })
  }

  // ── Operação (Onda 8) ──────────────────────────────────────────────────────

  /** E16: recado pronto. Sem sinal, fica guardado e sai sozinho. */
  const sendRecado = async (stop: Stop, template: string): Promise<OpsSendResult> => {
    const key = stopKey(stop)
    const id = newClientOpId()
    const r = await postMessage(key, template, id)
    if (r.kind === 'ok') return { kind: 'sent', at: r.data.sentAt }
    if (r.kind === 'network' && courierId) {
      await sync.enqueue({ ...opBase(key, id), kind: 'message', key, template })
      return { kind: 'saved' }
    }
    return r.kind === 'error' ? { kind: 'error', error: r.error, code: r.code } : { kind: 'error', error: 'Sem sinal agora. Tente de novo.' }
  }

  /** E11: problema numa entrega realizada → operação. A entrega não é desfeita. */
  const sendReport = async (stop: CompletedStop, type: string, text: string): Promise<OpsSendResult> => {
    const key = stop.orderId || stop.marketOrderId || ''
    const id = newClientOpId()
    const report = { kind: 'STOP_ISSUE' as const, stopKey: key, type, text }
    const r = await postReport(report, id)
    if (r.kind === 'error') return { kind: 'error', error: r.error }
    if (r.kind === 'network') {
      if (!courierId) return { kind: 'error', error: 'Sem sinal agora. Tente de novo.' }
      await sync.enqueue({ ...opBase(`report:${key}`, id), kind: 'report', report })
    }
    setReportedKeys((prev) => new Set(prev).add(key))
    setReportFor(null)
    setToast(r.kind === 'ok' ? { text: 'Enviado para a operação', icon: 'check' } : { text: 'Sem sinal: guardado, enviamos sozinhos', icon: 'cloudOff', tone: 'gold' })
    return r.kind === 'ok' ? { kind: 'sent' } : { kind: 'saved' }
  }

  /** E12: ocorrência (com foto opcional). Sem sinal, guarda tudo (inclusive a foto) e envia depois. */
  const sendIncident = async (type: string, text: string, photo: Blob | null): Promise<OpsSendResult> => {
    const id = newClientOpId()
    const report = { kind: 'INCIDENT' as const, type, text }
    const queue = async () => {
      if (!courierId) return { kind: 'error' as const, error: 'Sem sinal agora. Tente de novo.' }
      await sync.enqueue({ ...opBase(`incident:${id}`, id), kind: 'report', report, ...(photo ? { photo: await photoForQueue(photo) } : {}) })
      return { kind: 'saved' as const }
    }
    let photoKey: string | undefined
    if (photo) {
      const up = await postReportPhoto(photo)
      if (up.kind === 'network') return queue()
      if (up.kind === 'ok') photoKey = up.data.photoKey
    }
    const r = await postReport({ ...report, ...(photoKey ? { photoKey } : {}) }, id)
    if (r.kind === 'ok') return { kind: 'sent', at: r.data.createdAt }
    if (r.kind === 'network') return queue()
    return { kind: 'error', error: r.error }
  }

  /** E7: sugestão de acesso (precisa de sinal — não é urgente). */
  const sendAccess = async (condo: CondoGroup, field: string, text: string): Promise<OpsSendResult> => {
    const r = await postAccessSuggestion(condo.condominiumId, field, text)
    if (r.kind === 'ok') return { kind: 'sent' }
    return { kind: 'error', error: r.kind === 'network' ? 'Sem sinal agora. Tente de novo quando o sinal voltar.' : r.error }
  }

  /** E7: navegar até o prédio pelo app de mapas preferido (ou perguntar qual). */
  const navigateTo = (condo: CondoGroup) => {
    const app = getPreferredNavApp()
    if (!app) return setNavFor(condo)
    window.open(navUrl(app, { lat: condo.lat, lng: condo.lng, address: condo.address }), '_blank', 'noopener')
  }

  /** A7: "Deixou o gancho também?" — responde e segue para a foto. */
  const answerHook = async (delivered: boolean) => {
    const hookId = popup?.summary?.hookToDeliver?.id
    if (hookId) {
      const r = await postHookOutcome(hookId, delivered)
      if (r.kind === 'network' && courierId) {
        const key = popup?.summary?.orderId || popup?.summary?.marketOrderIds?.[0] || hookId
        await sync.enqueue({ ...opBase(`hook:${key}`), kind: 'hookOutcome', hookId, delivered })
      }
      setToast(delivered ? { text: 'Gancho entregue 🪝', icon: 'check' } : { text: 'Gancho volta para a fila', icon: 'refresh', tone: 'gold' })
    }
    popupNext()
  }

  const photoProps = photoTask
    ? {
        caption: photoTask.caption,
        hint: photoTask.outcome === 'DELIVERED' ? 'Mostre o saquinho na porta ou no gancho' : 'Mostre a porta ou a portaria',
        required: photoTask.required,
        onCapture: (blob: Blob) => {
          void queuePhoto(photoTask, blob)
          finishPhoto(photoTask, { text: photoTask.fromList ? 'Foto salva' : 'Foto salva · escaneie o próximo' })
        },
        onSkip: () => {
          void queueSkip(photoTask, 'SKIPPED')
          setProof(photoTask.localKey, 'pulada')
          finishPhoto(photoTask)
        },
        onCantShoot: () => setNoPhotoOpen(true),
      }
    : undefined

  /** "Não consigo tirar a foto" (obrigatória): o motivo vai pela fila e a parada fica "sem foto". */
  async function confirmNoPhoto(reason: NoPhotoReason, text?: string) {
    if (!photoTask) return
    await queueSkip(photoTask, 'NONE', reason, text)
    setProof(photoTask.localKey, 'sem')
    finishPhoto(photoTask)
  }

  /** Fechar a câmera no meio da foto: a parada fica com a foto pendente. */
  const closeScanner = () => {
    setScanOpen(false)
    setPopup(null)
    setPhotoTask(null)
    setNoPhotoOpen(false)
  }

  /** Parada ativa (com o prédio) a que um alvo de confirmação se refere. */
  const activeStopOf = (target: ConfirmTarget): { stop: Stop; condo: CondoGroup } | null => {
    for (const condo of data?.condos ?? []) {
      for (const stop of condo.stops) {
        const hit =
          target.kind === 'HOOK'
            ? stop.hookId === target.id
            : target.kind === 'BREAD'
              ? stop.orderId === target.id
              : stop.marketOrderId === target.id || (stop.marketOrderIds ?? []).includes(target.id)
        if (hit) return { stop, condo }
      }
    }
    return null
  }

  /**
   * Confirma no servidor; sem sinal (ou erro do servidor), GUARDA na fila com o mesmo `clientOpId`
   * e o horário real, e devolve `saved` com o resumo montado no aparelho.
   */
  async function attemptConfirm(target: ConfirmTarget, via: ConfirmVia): Promise<AttemptResult> {
    const local = activeStopOf(target)
    const key = local ? stopKey(local.stop) : null
    const proofRequired = data?.rules?.fotoEntrega ?? true
    // Já guardada na fila: não guarda de novo.
    const queued = key ? sync.ops.find((o) => o.kind === 'confirm' && o.stopKey === key) : undefined
    if (local && queued) {
      return { kind: 'already', summary: localSummary(local.stop, local.condo, 'DELIVERED', proofRequired, queued.occurredAt), message: 'Essa entrega já foi confirmada' }
    }
    const identity = { clientOpId: newClientOpId(), occurredAt: new Date().toISOString() }
    const r = await confirmStop(target, via, identity)
    if (local && key && courierId && retryable(r)) {
      await sync.enqueue({ ...opBase(key, identity.clientOpId, identity.occurredAt), kind: 'confirm', target, via })
      return { kind: 'saved', summary: localSummary(local.stop, local.condo, 'DELIVERED', proofRequired, identity.occurredAt) }
    }
    return r
  }

  /** Mostra o desfecho de uma confirmação no pop-up E4. */
  const showResult = (r: AttemptResult, dark: boolean) => {
    if (r.kind === 'ok') {
      markDelivered(r.summary)
      setPopup({ kind: 'ok', summary: r.summary, dark })
      return
    }
    if (r.kind === 'saved') {
      setPopup({ kind: 'offline', summary: r.summary, dark })
      return
    }
    beep('error')
    if (r.kind === 'already') setPopup({ kind: 'already', summary: r.summary, message: r.message, dark })
    else setPopup({ kind: r.kind, dark })
  }

  const openScanner = () => {
    unlockBeep() // o toque libera o áudio no iPhone
    setScanOpen(true)
  }

  async function handleDetect(text: string) {
    beep('ok')
    setConfirming(true)
    const code = text.trim()
    const target = targetFromQr(code)
    let result: AttemptResult
    if (target) {
      result = await attemptConfirm(target, 'SCAN')
    } else if (/^[0-9a-f]{24}$/i.test(code)) {
      // Cupom fora da lista carregada (dados velhos): pode ser pão ou Cestinha.
      result = await confirmStop({ kind: 'BREAD', id: code }, 'SCAN')
      if (result.kind === 'notfound') result = await confirmStop({ kind: 'MARKET', id: code }, 'SCAN')
    } else {
      result = { kind: 'notfound' }
    }
    showResult(result, true)
    setConfirming(false)
  }

  /** E3: acha a parada pelo código (na lista; senão no servidor) e confirma. */
  async function handleCodeSubmit(code: string, pick?: LookupMatch): Promise<CodeSubmitResult> {
    let target: ConfirmTarget | null = pick ? { kind: pick.kind, id: pick.id } : null
    if (!target) {
      const local = knownStops().filter((s) => (s.orderId && matchesStopCode(code, s.orderId)) || (s.marketOrderIds ?? []).some((id) => matchesStopCode(code, id)))
      if (local.length === 1) {
        const s = local[0]
        target = s.orderId ? { kind: 'BREAD', id: s.orderId } : { kind: 'MARKET', id: s.marketOrderId ?? '' }
      } else {
        const matches = await lookupStopCode(code)
        if (matches === null) return { kind: 'error' }
        if (matches.length === 0) return { kind: 'notfound' }
        if (matches.length > 1) return { kind: 'choices', matches }
        target = { kind: matches[0].kind, id: matches[0].id }
      }
    }
    const result = await attemptConfirm(target, 'CODE')
    if (result.kind === 'ok' || result.kind === 'saved') {
      setCodeOpen(false)
      showResult(result, scanOpen)
      return { kind: 'ok' }
    }
    if (result.kind === 'already') return { kind: 'already', summary: result.summary }
    if (result.kind === 'error') return { kind: 'error' }
    return { kind: 'notfound' }
  }

  const closePopup = () => setPopup(null)

  /** Fim da contagem do pop-up: entrega confirmada segue para a foto (E4 → E5). */
  const popupNext = () => {
    const p = popup
    setPopup(null)
    if ((p?.kind === 'ok' || p?.kind === 'offline') && p.summary) startPhoto(p.summary, 'DELIVERED', !p.dark)
  }

  // ── Pela lista (E6) ────────────────────────────────────────────────────────

  const targetOfStop = (stop: Stop): ConfirmTarget =>
    stop.hookId
      ? { kind: 'HOOK', id: stop.hookId }
      : stop.orderId
        ? { kind: 'BREAD', id: stop.orderId }
        : { kind: 'MARKET', id: stop.marketOrderId ?? stop.marketOrderIds?.[0] ?? '' }

  const openStop = (stop: Stop, condominiumName: string) => {
    setFailError(null)
    setFailSaved(null)
    setSheet({ kind: 'confirm', stop, condominiumName })
  }

  async function confirmFromList(stop: Stop) {
    const result = await attemptConfirm(targetOfStop(stop), 'LIST')
    setSheet(null)
    showResult(result, false)
  }

  async function submitFail(stop: Stop, code: FailureCode, reason?: string) {
    setFailError(null)
    const target = targetOfStop(stop)
    const identity = { clientOpId: newClientOpId(), occurredAt: new Date().toISOString() }
    const r = await markStopNotDelivered(target, code, reason, 'LIST', identity)
    if (r.kind === 'ok') {
      setSessionNotDelivered((prev) => new Set([...prev, stopKey(stop)]))
      setSheet(null)
      startPhoto(r.summary, 'NOT_DELIVERED', true)
      return
    }
    const local = activeStopOf(target)
    if (retryable(r) && local && courierId) {
      // Sem sinal: guarda a não entrega; o sheet mostra "Guardado · seguir para a foto".
      await sync.enqueue({
        ...opBase(stopKey(stop), identity.clientOpId, identity.occurredAt),
        kind: 'notDelivered',
        target,
        failureCode: code,
        reason: reason?.trim() || undefined,
        via: 'LIST',
      })
      setFailSaved(localSummary(local.stop, local.condo, 'NOT_DELIVERED', data?.rules?.fotoNaoEntrega ?? true, identity.occurredAt))
      return
    }
    if (r.kind === 'error') {
      setFailError('Não conseguimos enviar. Fale com a operação.')
      return
    }
    setSheet(null)
    showResult(r, false)
  }

  /** Não entrega guardada: segue para a foto da porta. */
  const continueSavedFail = () => {
    const saved = failSaved
    setSheet(null)
    setFailSaved(null)
    if (saved) startPhoto(saved, 'NOT_DELIVERED', true)
  }

  // ── Sair (E14): envios guardados se perdem ao sair sem sinal ───────────────

  const askLogout = () => setLogoutOpen(true)

  // ── Termo do Entregador Parceiro (plano-termos-legais §6): bloqueia até aceitar a versão vigente ──
  const termsPending = !!me?.terms && me.terms.acceptedVersion !== me.terms.version
  const acceptTerms = async (): Promise<string | null> => {
    if (!me?.terms) return null
    const r = await acceptCourierTerms(me.terms.version)
    if (!r.ok) {
      if (r.status === null) return 'Sem sinal agora. Para aceitar, abra o app com sinal.'
      if (r.status === 409) void refreshBadge()
      return r.error
    }
    const next = { ...me, terms: { ...me.terms, acceptedVersion: r.data.version, acceptedAt: r.data.acceptedAt } }
    setMe(next)
    saveBadgeCache(courierId, { me: next })
    return null
  }

  // ── Turno oferecido (plano-termos-legais §5) ─────────────────────────────
  const onAcceptShift = async (s: ShiftOffer) => {
    setShiftBusy(true)
    const r = await acceptShift(s.id)
    setShiftBusy(false)
    if (r.ok) setShifts((list) => list.map((x) => (x.id === s.id ? { ...x, status: 'ACCEPTED' } : x)))
    else setToast({ text: r.status === null ? 'Sem sinal agora. Sem resposta, o turno já fica com você.' : r.error, icon: 'cloudOff', tone: 'gold' })
  }
  const onDeclineShift = async (reason: ShiftDeclineReason | null): Promise<string | null> => {
    if (!declineFor) return null
    const r = await declineShift(declineFor.id, reason)
    // 409: o turno não está mais para recusar (rota começou, já passou, retirado) — fecha e atualiza.
    if (!r.ok && r.status === 409) {
      setDeclineFor(null)
      setShifts((list) => list.filter((x) => x.id !== declineFor.id))
      setToast({ text: r.error, icon: 'alert', tone: 'gold' })
      void load('manual')
      return null
    }
    if (!r.ok) return r.status === null ? 'offline' : r.error
    setDeclineFor(null)
    setShifts((list) => list.filter((x) => x.id !== declineFor.id))
    setToast({ text: 'Turno recusado. A operação foi avisada.', icon: 'check' })
    void load('background')
    return null
  }
  /** Tenta enviar o que está guardado antes; o que não subir se perde. */
  const logoutAnyway = async () => {
    if (pendingCount > 0) {
      await sync.flush()
      await sync.clear()
    }
    setLogoutOpen(false)
    clearBadgeCache()
    logout()
  }

  const confirmedCount = confirmedIds.size
  // "7/12" do dock e do scanner: paradas do dia já resolvidas / todas as paradas do dia.
  const dayTotal = (data?.totalStops ?? 0) + (data?.completedTotal ?? 0)
  const dayDone = (data?.completedTotal ?? 0) + confirmedIds.size + notDeliveredIds.size
  const noDeliveries = !isLoading && !!data && dayTotal === 0
  const counter = `${Math.min(dayDone, dayTotal)}/${dayTotal}`
  const confirmedBreads = data
    ? (data.condos ?? []).flatMap((c) => c.stops).filter((s) => confirmedIds.has(stopKey(s))).reduce((sum, s) => sum + s.quantity, 0)
    : 0

  // Quando o dia mistura turnos (manhã + tarde), a aba Lista é dividida em seções por
  // turno, cada uma com seu próprio progresso. Dia de turno único mantém a lista única.
  const isMultiSlot = (data?.slots.length ?? 0) > 1
  const slotSections = (() => {
    if (!data || !isMultiSlot) return []
    // Ordem: turnos conhecidos (já ordenados por horário) + qualquer slotId órfão
    // presente nos pedidos (legado sem turno) — assim nenhuma entrega some da lista.
    const orderedSlotIds = data.slots.map((s) => s.slotId)
    for (const sid of new Set((data.condos ?? []).flatMap((c) => c.stops).map((s) => s.slotId ?? ''))) {
      if (!orderedSlotIds.includes(sid)) orderedSlotIds.push(sid)
    }

    let index = 0 // índice global do acordeão (único entre seções)
    const sections: Array<{
      slotId: string
      label: string
      condos: Array<{ condo: CondoGroup; index: number }>
      total: number
      confirmed: number
      totalBreads: number
      confirmedBreads: number
    }> = []

    for (const slotId of orderedSlotIds) {
      const slotOrder = data.routes?.find((r) => r.slotId === slotId)?.condominiumIds
      const condos = byRouteOrder(data.condos ?? [], slotOrder)
        .map((c) => ({ ...c, stops: c.stops.filter((s) => (s.slotId ?? '') === slotId) }))
        .filter((c) => c.stops.length > 0)
        .map((condo) => ({ condo, index: index++ }))
      if (condos.length === 0) continue
      const stops = condos.flatMap((x) => x.condo.stops)
      const confirmed = stops.filter((s) => confirmedIds.has(stopKey(s)))
      const meta = data.slots.find((s) => s.slotId === slotId)
      const label = meta
        ? `${meta.emoji ? `${meta.emoji} ` : ''}${meta.label}${meta.time ? ` · ${meta.time}` : ''}`
        : stops[0]?.slotLabel || 'Sem turno'
      sections.push({
        slotId,
        label,
        condos,
        total: stops.length,
        confirmed: confirmed.length,
        totalBreads: stops.reduce((sum, s) => sum + s.quantity, 0),
        confirmedBreads: confirmed.reduce((sum, s) => sum + s.quantity, 0),
      })
    }
    return sections
  })()

  // Concluídas do dia = persistidas do backend + as confirmadas/não entregues nesta
  // sessão (que ainda constam como ativas em data.condos até um novo carregamento).
  // Assim a aba "Realizadas" reflete o progresso imediato sem refazer rota/OSRM.
  const completedView: CompletedCondo[] = (() => {
    if (!data) return []
    const map = new Map<string, CompletedCondo>()
    const seen = new Set<string>()
    for (const c of data.completed ?? []) {
      map.set(c.condominiumId, {
        ...c,
        stops: c.stops.map(({ proofStatus, ...s }) => {
          const key = s.orderId || s.marketOrderId || s.hookId || ''
          return { ...s, reported: !!s.reported || reportedKeys.has(key), proof: proofView.get(key) ?? (proofStatus ? PROOF_FROM_SERVER[proofStatus] ?? null : null) }
        }),
      })
      c.stops.forEach((s) => seen.add(s.orderId || s.marketOrderId || s.hookId || ''))
    }
    for (const condo of data.condos ?? []) {
      for (const stop of condo.stops) {
        const key = stopKey(stop)
        const isConf = confirmedIds.has(key)
        const isND = notDeliveredIds.has(key)
        if ((!isConf && !isND) || seen.has(key)) continue
        seen.add(key)
        let target = map.get(condo.condominiumId)
        if (!target) {
          target = { condominiumId: condo.condominiumId, condominiumName: condo.condominiumName, stops: [] }
          map.set(condo.condominiumId, target)
        }
        target.stops.push({
          orderId: stop.orderId,
          apartment: stop.apartment,
          block: stop.block,
          complement: stop.complement,
          clientName: stop.clientName,
          quantity: stop.quantity,
          status: isConf ? 'DELIVERED' : 'NOT_DELIVERED',
          slotId: stop.slotId,
          slotLabel: stop.slotLabel,
          completedAt: null, // confirmado nesta sessão — sem timestamp do servidor ainda
          marketOrderId: stop.marketOrderId,
          marketOrderIds: stop.marketOrderIds,
          marketItems: stop.marketItems,
          marketItemCount: stop.marketItemCount,
          hookId: stop.hookId,
          proof: proofView.get(key) ?? null,
          reported: reportedKeys.has(key),
        })
      }
    }
    return [...map.values()]
      .map((c) => ({ ...c, stops: [...c.stops].sort(byBlockThenApartment) }))
      .sort((a, b) => a.condominiumName.localeCompare(b.condominiumName, 'pt-BR'))
  })()
  const completedCount = completedView.reduce((n, c) => n + c.stops.length, 0)

  // Lista de turno único: os prédios na ordem da rota (rota salva / ordem do dia).
  const listCondos = byRouteOrder(data?.condos ?? [], data?.routes?.[0]?.condominiumIds)

  // ── Rota do dia ──────────────────────────────────────────────────────────
  const routeLines: RouteLine[] = (data?.routes ?? []).map((route) => {
    const active = (data?.condos ?? []).flatMap((c) => c.stops).filter((st) => (st.slotId ?? '') === route.slotId)
    const completedN = (data?.completed ?? []).flatMap((c) => c.stops).filter((st) => (st.slotId ?? '') === route.slotId).length
    const resolvedActive = active.filter((st) => confirmedIds.has(stopKey(st)) || notDeliveredIds.has(stopKey(st))).length
    return { route, total: active.length + completedN, done: completedN + resolvedActive }
  })
  // O cartão do turno some quando a rota daquele turno começa ou a 1ª parada dele é resolvida — na
  // tela, na fila offline ou no servidor (D-T5): aí não dá mais para recusar.
  const visibleShifts = shifts.filter((s) => {
    const line = routeLines.find((l) => l.route.slotId === s.slotId)
    return !line || (line.route.state === 'pronta' && line.done === 0)
  })
  const enRouteLine = routeLines.find((l) => l.route.state === 'em_rota')
  const readyLine = routeLines.find((l) => l.route.state === 'pronta' && l.route.slotId !== '' && l.done < l.total)
  const dock: { mode: DockMode; line?: RouteLine } = !data || dayTotal === 0
    ? { mode: 'none' }
    : enRouteLine
      ? { mode: enRouteLine.done >= enRouteLine.total ? 'end' : 'scan', line: enRouteLine }
      : readyLine
        ? { mode: 'start', line: readyLine }
        : { mode: dayDone < dayTotal ? 'scan' : 'none' }
  // Posição e tela acesa só com a rota INICIADA (T-9, M-10).
  const activeRun = enRouteLine?.route.run ?? null
  const { position, status: positionStatus } = useCourierPosition({ active: !!activeRun, runId: activeRun?.id ?? null })
  useWakeLock(!!activeRun)

  /** E8: inicia a rota; devolve a mensagem de erro (ou null). */
  async function doStart(slotId: string, mode: 'BASE' | 'GPS', pos?: { lat: number; lng: number }): Promise<string | null> {
    const r = await startRun(slotId, mode, pos)
    if (!r.ok) return r.error
    setStartFor(null)
    const n = r.data.notified
    setToast({ text: n > 0 ? `Rota iniciada · ${n === 1 ? '1 cliente avisado' : `${n} clientes avisados`}` : 'Rota iniciada' })
    void load('manual')
    return null
  }

  /** "Lista do prédio" (aba Rota): volta para a Lista com o prédio aberto. */
  const openCondoInList = (condominiumId: string, slotId: string) => {
    setTab('list')
    if (isMultiSlot) {
      const sec = slotSections.find((x) => x.slotId === slotId)
      const hit = sec?.condos.find((x) => x.condo.condominiumId === condominiumId)
      if (hit) setOpenAccordion(hit.index)
    } else {
      const i = listCondos.findIndex((c) => c.condominiumId === condominiumId)
      if (i >= 0) setOpenAccordion(i)
    }
  }

  /** "Tirar foto" do encerrar: a foto obrigatória que ficou pendente. */
  const photoForPending = (p: RunStopRef) => {
    const stop = (data?.completed ?? [])
      .flatMap((c) => c.stops.map((st) => ({ st, c })))
      .find(({ st }) => (st.orderId || st.marketOrderId || st.hookId) === p.refId)
    const outcome: Outcome = p.outcome === 'NOT_DELIVERED' ? 'NOT_DELIVERED' : 'DELIVERED'
    // Fora da lista carregada, o `refId` vai como chave da foto: a API acha pão, Cestinha ou gancho.
    const summary: StopSummary = {
      kind: stop?.st.hookId ? 'HOOK' : stop?.st.orderId ? 'BREAD' : 'MARKET',
      orderId: stop?.st.orderId || (stop ? null : p.refId),
      ...(stop?.st.hookId ? { hookId: stop.st.hookId } : {}),
      marketOrderIds: stop?.st.marketOrderIds ?? [],
      clientName: p.clientName,
      condominiumId: stop?.c.condominiumId ?? null,
      condominiumName: p.condominiumName,
      block: p.block,
      complement: stop?.st.complement ?? null,
      apartment: p.apartment,
      quantity: stop?.st.quantity ?? 0,
      marketItems: stop?.st.marketItems ?? [],
      isFirstOrder: false,
      hasHook: false,
      hookToDeliver: null,
      status: outcome,
      deliveredAt: null,
      failedAt: null,
      proofRequired: true,
    }
    setEndFor(null)
    startPhoto(summary, outcome, true)
  }

  const todayLabel = getTodayLabel()
  const greeting = getGreeting()
  const courierName = me?.name ?? user?.name ?? 'Entregador'
  const firstName = me?.firstName ?? courierName.split(' ')[0]

  return (
    <div
      // Puxar para atualizar: arrastar para baixo a partir do topo da tela (M-1).
      onTouchStart={(e) => {
        pullStartY.current = window.scrollY <= 0 ? e.touches[0].clientY : null
      }}
      onTouchEnd={(e) => {
        const start = pullStartY.current
        pullStartY.current = null
        if (start !== null && e.changedTouches[0].clientY - start > 90) void load('manual')
      }}
      style={{
        background: 'var(--color-app-bg)',
        minHeight: '100vh',
        // Espaço para o dock fixo do rodapé não cobrir a última parada.
        paddingBottom: 120,
      }}
    >
      {/* Header — saudação */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          // Respiro maior acima do header + área segura (notch). Espelha o header do cliente.
          padding: 'calc(20px + env(safe-area-inset-top)) 20px 16px',
        }}
      >
        {/* Avatar + saudação → Perfil (E14) */}
        <button
          type="button"
          onClick={() => setPage('perfil')}
          aria-label="Abrir perfil"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0, textAlign: 'left', fontFamily: 'var(--font-body)' }}
        >
          <CRAvatar name={courierName} photoUrl={me?.photoUrl} size={46} radius={15} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-ter)' }}>{greeting},</span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{firstName}</span>
              <Icon name="chevR" size={15} color="var(--color-text-ter)" stroke={2.4} aria-hidden="true" />
            </span>
          </span>
        </button>

        {/* Crachá digital (E15) */}
        <button
          type="button"
          onClick={() => void openBadge()}
          style={{
            height: 44,
            padding: '0 13px',
            borderRadius: 14,
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontWeight: 800,
            fontSize: 13.5,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="badge" size={19} color="var(--color-accent)" stroke={2.1} aria-hidden="true" />
          Crachá
        </button>
      </div>

      {/* Ativar notificações push neste aparelho */}
      <div style={{ margin: '0 20px 14px' }}>
        <PushNotificationToggle description="Receba avisos de novas entregas e lembretes de turno." />
      </div>

      {/* Fila offline (Onda 4): o que está guardado neste aparelho e ainda não subiu. */}
      {pendingCount > 0 && (
        <div style={{ margin: '0 20px 14px' }}>
          <CRSync kind={sync.offline ? 'offline' : 'sending'} count={pendingCount} />
        </div>
      )}
      {fromCache && (
        <div style={{ margin: '0 20px 14px' }}>
          <CRNote icon="cloudOff" tone="gold">
            Sem sinal. Mostrando a rota guardada neste aparelho{brtTime(fromCache) ? ` às ${brtTime(fromCache)}` : ''}.
          </CRNote>
        </div>
      )}

      {/* Entregas atribuídas depois de a tela abrir (M-1). Só entram ao tocar em Atualizar. */}
      {newCount > 0 && (
        <div style={{ margin: '0 20px 14px' }}>
          <div
            role="status"
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-espresso)', color: 'var(--color-app-bg)', borderRadius: 16, padding: '8px 8px 8px 14px' }}
          >
            <Icon name="bell" size={18} color="var(--color-gold)" />
            <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700 }}>
              {newCount === 1 ? '1 entrega nova na sua rota' : `${newCount} entregas novas na sua rota`}
            </span>
            <button
              type="button"
              onClick={applyPending}
              style={{ height: 44, padding: '0 14px', borderRadius: 12, border: 'none', background: 'var(--color-gold)', color: 'var(--color-espresso)', fontWeight: 800, fontSize: 14, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <Icon name="refresh" size={16} stroke={2.4} />
              Atualizar
            </button>
          </div>
        </div>
      )}

      {/* E1 sem entregas hoje: folga (escala/folga marcada) ou dia vazio, com o próximo turno. */}
      {noDeliveries && (
        <div style={{ margin: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CourierNoDeliveries schedule={schedule} onOpenSchedule={() => setPage('escala')} />
        </div>
      )}

      {!noDeliveries && (
        <>
          {/* Turno oferecido (plano-termos-legais §5): Aceitar / Recusar até iniciar a rota ou resolver a 1ª parada. */}
          {visibleShifts.map((s) => (
            <div key={s.id} style={{ margin: '0 20px 12px' }}>
              <ShiftOfferCard shift={s} busy={shiftBusy} onAccept={() => void onAcceptShift(s)} onDecline={() => setDeclineFor(s)} />
            </div>
          ))}

          {/* Rota de hoje — data, Além do Pãozin e o estado de cada turno, com Iniciar (E1). */}
          <div style={{ margin: '0 20px 14px' }}>
            <RouteTodayCard
              dateLabel={todayLabel}
              extraLine={data && (data.totalItems ?? 0) > 0 ? `🧺 ${data.totalBreads} 🥖 + ${data.totalItems} ${data.totalItems === 1 ? 'item' : 'itens'} do Além do Pãozin` : null}
              lines={routeLines}
              onStart={(slotId) => setStartFor(slotId)}
            />
          </div>

          {/* Segmented control */}
          <div style={{ margin: '0 20px 12px' }}>
            <SegmentedControl value={tab} onChange={setTab} />
          </div>
        </>
      )}

      {/* Card de progresso (combinado) — no dia com vários turnos, a aba Lista usa
          progresso por turno; aqui só aparece em turno único ou na aba Rota (mapa). */}
      {data && !noDeliveries && tab !== 'done' && (!isMultiSlot || tab === 'route') && (
        <div style={{ margin: '0 20px' }}>
          <ProgressCard
            confirmed={confirmedCount}
            total={data.totalStops}
            totalBreads={data.totalBreads}
            confirmedBreads={confirmedBreads}
          />
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '40px 20px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--color-text-sec)',
            }}
          >
            Carregando entregas...
          </p>
        </div>
      )}

      {/* Sem sinal e sem rota guardada de hoje (1º acesso do dia já no corredor). */}
      {!isLoading && !data && (
        <div style={{ margin: '12px 20px 0' }}>
          <CRNote icon="cloudOff" tone="gold">
            <b>Sem sinal.</b> Abra o app com sinal uma vez para baixar a rota de hoje. Depois ela fica guardada
            neste aparelho.
          </CRNote>
        </div>
      )}

      {/* Aba Lista */}
      {!isLoading && data && !noDeliveries && tab === 'list' && (
        <div
          style={{
            padding: '12px 20px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: isMultiSlot ? 22 : 12,
          }}
        >
          {(data.condos ?? []).length === 0 ? (
            <div
              style={{
                padding: '40px 0',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  margin: '0 0 8px',
                }}
              >
                Sem entregas hoje
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  color: 'var(--color-text-sec)',
                  margin: 0,
                }}
              >
                Não há pedidos atribuídos a você para hoje.
              </p>
            </div>
          ) : isMultiSlot ? (
            // Dia com manhã + tarde: uma seção por turno, com progresso próprio
            slotSections.map((sec) => {
              const pct = sec.total > 0 ? Math.round((sec.confirmed / sec.total) * 100) : 0
              const done = sec.total > 0 && sec.confirmed >= sec.total
              return (
                <div key={sec.slotId}>
                  {/* Cabeçalho do turno + progresso */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontFamily: 'var(--font-body)',
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--color-espresso)',
                          background: 'var(--color-gold-soft)',
                          borderRadius: 99,
                          padding: '5px 12px',
                        }}
                      >
                        {sec.label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-text-ter)' }}>
                        {sec.confirmed}/{sec.total} {sec.total === 1 ? 'parada' : 'paradas'} · {sec.confirmedBreads}/{sec.totalBreads} 🥖
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 99, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: done ? 'var(--color-good)' : 'var(--color-accent)', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                  {/* Prédios do turno */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {sec.condos.map(({ condo, index }, pos) => (
                      <CondoAccordion
                        key={`${sec.slotId}:${condo.condominiumId}`}
                        condo={condo}
                        order={pos + 1}
                        isOpen={openAccordion === index}
                        onToggle={() => setOpenAccordion(openAccordion === index ? -1 : index)}
                        confirmedIds={confirmedIds}
                        notDeliveredIds={notDeliveredIds}
                        proofStates={proofView}
                        showSlot={false}
                        onConfirm={(stop) => openStop(stop, condo.condominiumName)}
                        onRecado={data.rules?.podeRecados ? setRecadoFor : undefined}
                        onSuggestAccess={setAccessFor}
                        onNavigate={navigateTo}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            // Turno único: lista direta de prédios
            listCondos.map((condo, index) => (
              <CondoAccordion
                key={condo.condominiumId}
                condo={condo}
                order={index + 1}
                isOpen={openAccordion === index}
                onToggle={() =>
                  setOpenAccordion(openAccordion === index ? -1 : index)
                }
                confirmedIds={confirmedIds}
                notDeliveredIds={notDeliveredIds}
                proofStates={proofView}
                showSlot={false}
                onConfirm={(stop) => openStop(stop, condo.condominiumName)}
                onRecado={data.rules?.podeRecados ? setRecadoFor : undefined}
                onSuggestAccess={setAccessFor}
                onNavigate={navigateTo}
              />
            ))
          )}
        </div>
      )}

      {/* Atualizar a lista à mão (além do puxar para atualizar). */}
      {!isLoading && data && !noDeliveries && tab === 'list' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 20px 0' }}>
          <button
            type="button"
            onClick={() => void load('manual')}
            disabled={refreshing}
            style={{ minHeight: 44, padding: '0 16px', border: 'none', background: 'transparent', color: 'var(--color-text-ter)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <Icon name="refresh" size={14} />
            {refreshing ? 'Atualizando…' : 'Puxe para atualizar · ou toque aqui'}
          </button>
        </div>
      )}

      {/* Aba Rota */}
      {!isLoading && data && !noDeliveries && tab === 'route' && (
        <div style={{ padding: '12px 20px 0' }}>
          <CourierRouteView
            condos={data.condos ?? []}
            routes={data.routes ?? []}
            routeCondos={data.routeCondos ?? []}
            base={data.base ?? null}
            slots={data.slots}
            resolvedKeys={new Set([...confirmedIds, ...notDeliveredIds])}
            canReorder={data.rules?.podeReordenar ?? false}
            me={position}
            positionStatus={positionStatus}
            onOpenCondo={openCondoInList}
            onEnd={(slotId) => setEndFor(slotId)}
            onReordered={() => void load('manual')}
          />
        </div>
      )}

      {/* Aba Realizadas — entregas concluídas do dia (entregues + não entregues) */}
      {!isLoading && data && !noDeliveries && tab === 'done' && (
        <div style={{ padding: '12px 20px 0' }}>
          {completedCount > 0 && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--color-text-ter)',
                textTransform: 'uppercase',
                margin: '0 0 10px',
              }}
            >
              {completedCount} {completedCount === 1 ? 'entrega concluída' : 'entregas concluídas'} hoje
            </p>
          )}
          <CourierCompletedList condos={completedView} onReport={setReportFor} />
        </div>
      )}

      {/* Pela lista (E6): confirmar ou "não consegui entregar". */}
      {sheet?.kind === 'confirm' && (
        <ConfirmSheet
          stop={sheet.stop}
          condominiumName={sheet.condominiumName}
          onConfirm={() => confirmFromList(sheet.stop)}
          onFail={() => setSheet({ ...sheet, kind: 'fail' })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'fail' && (
        <FailSheet
          stop={sheet.stop}
          photoRequired={data?.rules?.fotoNaoEntrega ?? true}
          error={failError}
          saved={!!failSaved}
          onContinue={continueSavedFail}
          onRecado={data?.rules?.podeRecados ? () => setRecadoFor(sheet.stop) : undefined}
          onSubmit={(code, reason) => submitFail(sheet.stop, code, reason)}
          onClose={() => {
            setSheet(null)
            setFailSaved(null)
          }}
        />
      )}

      {/* Dock do rodapé: a ação do momento na área do polegar (E1) — iniciar, escanear, encerrar. */}
      {!scanOpen && !endFor && (
        <CourierDock
          mode={dock.mode}
          counter={counter}
          turno={dock.line ? { emoji: dock.line.route.emoji, label: dock.line.route.label } : undefined}
          onScan={openScanner}
          onTypeCode={() => setCodeOpen(true)}
          onStart={() => dock.line && setStartFor(dock.line.route.slotId)}
          onEnd={() => dock.line && setEndFor(dock.line.route.slotId)}
        />
      )}

      {/* E8: iniciar a rota do turno. */}
      {startFor !== null &&
        (() => {
          const line = routeLines.find((l) => l.route.slotId === startFor)
          return line ? (
            <StartRunSheet
              route={line.route}
              stops={line.total - line.done}
              base={data?.base ?? null}
              onStart={(mode, pos) => doStart(startFor, mode, pos)}
              onClose={() => setStartFor(null)}
            />
          ) : null
        })()}

      {/* E10: encerrar a rota (pendências + resumo + rota concluída). */}
      {endFor !== null && (
        <CourierEndRun
          slotId={endFor}
          pendingSends={pendingCount}
          sending={sync.sending}
          onFlush={() => void sync.flush()}
          onResolve={() => {
            setEndFor(null)
            setTab('list')
          }}
          onTakePhoto={photoForPending}
          onClose={() => setEndFor(null)}
          onEnded={() => void load('manual')}
        />
      )}

      {/* Câmera contínua (E2): o pop-up fica por cima, com a câmera aberta embaixo. */}
      {scanOpen && (
        <ScanScreen
          counter={counter}
          paused={confirming || !!popup || codeOpen}
          onDetect={(text) => void handleDetect(text)}
          onClose={closeScanner}
          onTypeCode={() => setCodeOpen(true)}
          mode={photoProps ? 'photo' : 'scan'}
          photo={photoProps}
          overlay={
            noPhotoOpen ? (
              <NoPhotoSheet onConfirm={confirmNoPhoto} onClose={() => setNoPhotoOpen(false)} />
            ) : popup?.dark ? (
              <ResultPopup
                kind={popup.kind}
                summary={popup.summary}
                message={popup.message}
                dark
                nextHint="Foto da entrega"
                onNext={popupNext}
                onHook={(d) => void answerHook(d)}
                onClose={closePopup}
                onTypeCode={() => {
                  setPopup(null)
                  setCodeOpen(true)
                }}
              />
            ) : null
          }
        />
      )}

      {/* Pop-up sobre a lista (confirmação manual ou por código sem a câmera). */}
      {popup && !popup.dark && (
        <ResultPopup
          kind={popup.kind}
          summary={popup.summary}
          message={popup.message}
          dark={false}
          nextHint="Foto da entrega"
          onNext={popupNext}
          onHook={(d) => void answerHook(d)}
          onClose={closePopup}
          onTypeCode={() => {
            setPopup(null)
            setCodeOpen(true)
          }}
        />
      )}

      {codeOpen && <CodeSheet onSubmit={handleCodeSubmit} onClose={() => setCodeOpen(false)} />}

      {/* Pessoas (Onda 6): perfil, crachá, números e escala por cima da tela principal. */}
      {page === 'perfil' && (
        <CourierProfile
          me={me}
          fallbackName={courierName}
          onClose={() => setPage(null)}
          onOpenBadge={() => void openBadge()}
          onOpenEarnings={() => setPage('ganhos')}
          onOpenOps={() => setPage('operacao')}
          onOpenNumbers={() => setPage('numeros')}
          onOpenSchedule={() => setPage('escala')}
          onOpenTerms={() => setPage('termo')}
          onLogout={askLogout}
        />
      )}
      {page === 'cracha' && me && <CourierBadge me={me} courierId={courierId} secret={badgeKey.secret} offsetMs={badgeKey.offsetMs} onClose={() => setPage('perfil')} />}
      {page === 'ganhos' && <CourierEarnings onClose={() => setPage('perfil')} />}
      {page === 'numeros' && <CourierNumbers firstName={firstName} onClose={() => setPage('perfil')} />}
      {page === 'operacao' && <CourierOps onClose={() => setPage('perfil')} onSend={sendIncident} />}
      {page === 'escala' && <CourierSchedule initial={schedule} onClose={() => setPage(noDeliveries ? null : 'perfil')} />}
      {page === 'termo' && (
        <CourierPage title="Termo do entregador" onBack={() => setPage('perfil')}>
          <CRCard pad={16}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)' }}>
              {me?.terms?.acceptedAt
                ? `Você aceitou a versão ${me.terms.acceptedVersion} em ${new Date(me.terms.acceptedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`
                : 'Aceite pendente.'}
            </div>
          </CRCard>
          <CourierTermsBody />
        </CourierPage>
      )}
      {termsPending && !logoutOpen && <TermsGate updated={!!me?.terms?.acceptedVersion} onAccept={acceptTerms} onLogout={askLogout} />}
      {declineFor && <DeclineShiftSheet shift={declineFor} onConfirm={onDeclineShift} onClose={() => setDeclineFor(null)} />}

      {/* Operação (Onda 8): recado, problema, sugestão de acesso, app de mapas. */}
      {recadoFor && <RecadoSheet stop={recadoFor} onSend={(t) => sendRecado(recadoFor, t)} onClose={() => setRecadoFor(null)} />}
      {reportFor && (
        <ReportSheet
          stop={{ ...reportFor, time: brtTime(reportFor.completedAt) }}
          onSend={(type, text) => sendReport(reportFor, type, text)}
          onClose={() => setReportFor(null)}
        />
      )}
      {accessFor && <AccessSuggestSheet condoName={accessFor.condominiumName} onSend={(f, t) => sendAccess(accessFor, f, t)} onClose={() => setAccessFor(null)} />}
      {navFor && (
        <NavAppSheet
          onClose={() => setNavFor(null)}
          onOpen={(app) => {
            window.open(navUrl(app, { lat: navFor.lat, lng: navFor.lng, address: navFor.address }), '_blank', 'noopener')
            setNavFor(null)
          }}
        />
      )}

      {/* Sair (E14). Com envios guardados, avisa: sem sinal, eles se perdem. */}
      {logoutOpen && (
        <CRSheet title="Sair do app?" sub={pendingCount === 0 ? 'As entregas guardadas sem sinal são enviadas antes.' : undefined} onClose={() => setLogoutOpen(false)}>
          {pendingCount > 0 && (
            <CRNote icon="cloudOff" tone="danger" style={{ marginBottom: 14 }}>
              <b>{pendingCount === 1 ? '1 entrega ainda não subiu.' : `${pendingCount} entregas ainda não subiram.`}</b> Se sair sem sinal, elas se
              perdem. Espere o sinal voltar ou fale com a operação.
            </CRNote>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <CRBig variant={pendingCount > 0 ? 'danger' : 'dangerFill'} icon="logout" onClick={() => void logoutAnyway()}>
              {pendingCount > 0 ? 'Sair mesmo assim' : 'Sair'}
            </CRBig>
            <CRBig
              variant="ghost"
              onClick={() => {
                setLogoutOpen(false)
                if (pendingCount > 0) void sync.flush()
              }}
            >
              {pendingCount > 0 ? 'Esperar o envio' : 'Cancelar'}
            </CRBig>
          </div>
        </CRSheet>
      )}

      {toast && (
        <CRToast icon={toast.icon} tone={toast.tone} top={scanOpen}>
          {toast.text}
        </CRToast>
      )}
    </div>
  )
}
