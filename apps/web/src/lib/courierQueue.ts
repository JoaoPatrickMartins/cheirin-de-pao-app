/**
 * Fila offline do entregador (T-7 do plano do entregador).
 *
 * O corredor sem sinal é o cenário normal: confirmação, não entrega, foto e "pular a foto" que não
 * chegam ao servidor ficam guardados NESTE aparelho (IndexedDB) e sobem sozinhos quando o sinal
 * volta. Cada operação leva um `clientOpId` (o `id`), o mesmo em toda tentativa, e o horário real
 * da ação (`occurredAt`) — o servidor é idempotente e limita o horário ao dia.
 *
 * - IndexedDB com wrapper próprio (sem dependência). Sem IndexedDB (modo privado antigo, testes),
 *   cai numa fila em memória: funciona com o app aberto, só não sobrevive a fechar o app.
 * - A foto é guardada como bytes (`ArrayBuffer`), não como `Blob`: Blob no IndexedDB já teve bug no
 *   Safari do iPhone.
 * - Envio em ordem de criação. Sem rede → para tudo e tenta depois. Erro do servidor (5xx) → a
 *   parada espera, as outras seguem. Recusa definitiva (4xx) → descarta, e um desfecho descartado
 *   leva junto a foto/"pular" da mesma parada.
 */
import type { ConfirmVia, Outcome } from './courierApi'

/** Alvo do desfecho: o pão da parada, a Cestinha (parada só-Cestinha) ou o gancho (parada só de gancho). */
export type OpTarget = { kind: 'BREAD' | 'MARKET' | 'HOOK'; id: string }

interface OpBase {
  /** `clientOpId` — o mesmo em todas as tentativas (idempotência no servidor). */
  id: string
  /** Dono da operação: outro entregador no mesmo aparelho não envia o que não é dele. */
  courierId: string
  /** Chave da parada na tela (`stopKey`). */
  stopKey: string
  /** Quando aconteceu de verdade (ISO) — vira `deliveredAt`/`failedAt`. */
  occurredAt: string
  /** Ordem de envio. */
  createdAt: number
  attempts: number
}

export type QueuedOp = OpBase &
  (
    | { kind: 'confirm'; target: OpTarget; via: ConfirmVia }
    | { kind: 'notDelivered'; target: OpTarget; failureCode: string; reason?: string; via: ConfirmVia }
    | { kind: 'proof'; key: string; outcome: Outcome; photo: { data: ArrayBuffer; type: string } }
    | { kind: 'proofSkip'; key: string; outcome: Outcome; mode: 'NONE' | 'SKIPPED'; reasonCode?: string; text?: string }
    // Onda 8 — operação: recado (E16), problema/ocorrência (E11/E12) e o gancho na rota (A7).
    | { kind: 'message'; key: string; template: string }
    | {
        kind: 'report'
        report: { kind: 'STOP_ISSUE' | 'INCIDENT'; stopKey?: string; type: string; text?: string | null }
        photo?: { data: ArrayBuffer; type: string }
      }
    | { kind: 'hookOutcome'; hookId: string; delivered: boolean }
  )

/** Operações que são entrega (contam na faixa "N entregas guardadas"). */
const DELIVERY_KINDS = new Set(['confirm', 'notDelivered', 'proof', 'proofSkip'])

/** Resultado do envio de uma operação. */
export type SendOutcome =
  | { kind: 'done' }
  /** `resolved` = a operação/admin já deu outro desfecho; `invalid` = recusa definitiva; `unavailable` = sem armazenamento de fotos. */
  | { kind: 'discard'; reason: 'resolved' | 'invalid' | 'unavailable' }
  /** `network` = sem sinal (para a fila toda); senão, erro do servidor (só a parada espera). */
  | { kind: 'retry'; network: boolean }

// ── Armazenamento ────────────────────────────────────────────────────────────

interface Store {
  all(): Promise<QueuedOp[]>
  put(op: QueuedOp): Promise<void>
  remove(id: string): Promise<void>
  cacheGet(key: string): Promise<unknown>
  cacheSet(key: string, value: unknown): Promise<void>
}

const DB_NAME = 'cdp-courier'
const DB_VERSION = 1
const OPS = 'ops'
const CACHE = 'cache'

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function idbStore(factory: IDBFactory): Store {
  let dbPromise: Promise<IDBDatabase> | null = null
  const open = () => {
    if (!dbPromise) {
      dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const r = factory.open(DB_NAME, DB_VERSION)
        r.onupgradeneeded = () => {
          const db = r.result
          if (!db.objectStoreNames.contains(OPS)) db.createObjectStore(OPS, { keyPath: 'id' })
          if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE)
        }
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      }).catch((err) => {
        dbPromise = null
        throw err
      })
    }
    return dbPromise
  }
  const tx = async (name: string, mode: IDBTransactionMode) => (await open()).transaction(name, mode).objectStore(name)
  return {
    all: async () => (await req((await tx(OPS, 'readonly')).getAll())) as QueuedOp[],
    put: async (op) => {
      await req((await tx(OPS, 'readwrite')).put(op))
    },
    remove: async (id) => {
      await req((await tx(OPS, 'readwrite')).delete(id))
    },
    cacheGet: async (key) => req((await tx(CACHE, 'readonly')).get(key)),
    cacheSet: async (key, value) => {
      await req((await tx(CACHE, 'readwrite')).put(value, key))
    },
  }
}

function memoryStore(): Store {
  const ops = new Map<string, QueuedOp>()
  const cache = new Map<string, unknown>()
  return {
    all: async () => [...ops.values()],
    put: async (op) => {
      ops.set(op.id, op)
    },
    remove: async (id) => {
      ops.delete(id)
    },
    cacheGet: async (key) => cache.get(key),
    cacheSet: async (key, value) => {
      cache.set(key, value)
    },
  }
}

let store: Store | null = null
let fallback: Store | null = null

function getStore(): Store {
  if (!store) {
    let factory: IDBFactory | undefined
    try {
      factory = typeof indexedDB === 'undefined' ? undefined : indexedDB
    } catch {
      factory = undefined
    }
    store = factory ? idbStore(factory) : memoryStore()
  }
  return store
}

/** IndexedDB falhou na hora (cota, modo privado): segue em memória até o app fechar. */
async function safe<T>(run: (s: Store) => Promise<T>): Promise<T> {
  try {
    return await run(getStore())
  } catch {
    fallback ??= memoryStore()
    store = fallback
    return run(fallback)
  }
}

/** Só para testes: zera a fila e reabre o armazenamento. */
export function resetCourierQueue(): void {
  store = null
  fallback = null
}

// ── Operações ────────────────────────────────────────────────────────────────

const byCreation = (a: QueuedOp, b: QueuedOp) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)

export async function listOps(courierId: string): Promise<QueuedOp[]> {
  const all = await safe((s) => s.all())
  return all.filter((op) => op.courierId === courierId).sort(byCreation)
}

export async function enqueueOp(op: QueuedOp): Promise<void> {
  await safe((s) => s.put(op))
}

export async function removeOp(id: string): Promise<void> {
  await safe((s) => s.remove(id))
}

/** Descarta tudo o que é do entregador (sair do app mesmo com envios pendentes). */
export async function clearOps(courierId: string): Promise<void> {
  for (const op of await listOps(courierId)) await removeOp(op.id)
}

/** Foto para guardar na fila. */
export async function photoForQueue(blob: Blob): Promise<{ data: ArrayBuffer; type: string }> {
  const data =
    typeof blob.arrayBuffer === 'function'
      ? await blob.arrayBuffer()
      : await new Promise<ArrayBuffer>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result as ArrayBuffer)
          r.onerror = () => reject(r.error)
          r.readAsArrayBuffer(blob)
        })
  return { data, type: blob.type || 'image/jpeg' }
}

/** Paradas com algo ainda guardado (a faixa conta paradas, não operações). */
export function pendingStops(ops: QueuedOp[]): Set<string> {
  return new Set(ops.filter((op) => DELIVERY_KINDS.has(op.kind)).map((op) => op.stopKey))
}

/**
 * Envia o que está guardado, em ordem. Devolve `offline: true` quando parou por falta de sinal.
 * `onResult` avisa cada operação concluída ou descartada (a tela atualiza selos e avisos).
 */
export async function flushOps(
  courierId: string,
  send: (op: QueuedOp) => Promise<SendOutcome>,
  onResult?: (op: QueuedOp, outcome: SendOutcome) => void,
): Promise<{ offline: boolean }> {
  const ops = await listOps(courierId)
  const waiting = new Set<string>() // paradas com erro do servidor nesta rodada
  const dropped = new Set<string>() // ids descartados junto com o desfecho
  for (const op of ops) {
    if (waiting.has(op.stopKey) || dropped.has(op.id)) continue
    const out = await send(op)
    if (out.kind === 'retry') {
      await enqueueOp({ ...op, attempts: op.attempts + 1 })
      if (out.network) return { offline: true }
      waiting.add(op.stopKey)
      continue
    }
    await removeOp(op.id)
    onResult?.(op, out)
    // O desfecho não valeu (já resolvido por outro caminho, ou recusado): a foto e o "pular" da
    // mesma parada perderam o sentido.
    if (out.kind === 'discard' && (op.kind === 'confirm' || op.kind === 'notDelivered')) {
      for (const later of ops) {
        if (later.stopKey !== op.stopKey || later.id === op.id || byCreation(later, op) < 0) continue
        // Só a foto e o "pular" dependem do desfecho; recado e reporte seguem valendo.
        if (later.kind !== 'proof' && later.kind !== 'proofSkip') continue
        dropped.add(later.id)
        await removeOp(later.id)
        onResult?.(later, { kind: 'discard', reason: out.reason })
      }
    }
  }
  return { offline: false }
}

// ── Rota do dia guardada (abrir o app sem sinal) ─────────────────────────────

interface CachedRoute<T> {
  courierId: string
  /** Dia (BRT, YYYY-MM-DD) em que a rota foi baixada. */
  date: string
  savedAt: string
  data: T
}

const ROUTE_KEY = 'today'

/** "2026-10-02" no horário de Brasília. */
export function brtDay(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export async function saveRoute<T>(courierId: string, data: T, now: Date = new Date()): Promise<void> {
  const value: CachedRoute<T> = { courierId, date: brtDay(now), savedAt: now.toISOString(), data }
  await safe((s) => s.cacheSet(ROUTE_KEY, value))
}

/** A rota guardada, só se for do mesmo entregador e de hoje. */
export async function loadRoute<T>(courierId: string, now: Date = new Date()): Promise<{ data: T; savedAt: string } | null> {
  const value = (await safe((s) => s.cacheGet(ROUTE_KEY))) as CachedRoute<T> | undefined
  if (!value || value.courierId !== courierId || value.date !== brtDay(now)) return null
  return { data: value.data, savedAt: value.savedAt }
}
