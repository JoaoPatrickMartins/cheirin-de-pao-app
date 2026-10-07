/**
 * Motor de rota do entregador (T-8 do plano do entregador).
 *
 * - Matriz de duração/distância pelo OSRM `/table` entre a base e os prédios.
 * - Ordem: permutação EXATA até 8 prédios; acima disso, vizinho mais próximo + 2-opt.
 * - Encaixe (rota padrão): prédio novo entra no vão de menor desvio, sem reordenar o resto.
 * - A base é a origem (quando existe); a volta à base entra no custo e no km quando ligada.
 * - Métricas e traçado pelo OSRM `/route` na ordem escolhida (pernas em segundos → hora prevista).
 * - Cache em memória por conjunto de pontos: com a rota salva, as chamadas caem para poucas por dia.
 *
 * Nunca lança: OSRM fora do ar → ordem recebida e métricas nulas (a lista segue sem mapa, D-07).
 * Prédio sem coordenada fica no FIM da ordem e fora do traçado ("sem mapa").
 */

export interface GeoPoint {
  lat: number
  lng: number
}

export interface RouteStop {
  id: string
  lat: number | null
  lng: number | null
}

export interface RouteMetrics {
  /** km com 1 casa; null sem traçado. */
  km: number | null
  durationMin: number | null
  /** [lat, lng] para o Leaflet. */
  geometry: Array<[number, number]>
  /** Duração (s) de cada perna na ordem: base→1º (quando há base), 1º→2º, …, último→base (volta). */
  legSeconds: number[]
}

export interface RoutePlan extends RouteMetrics {
  /** Ids na ordem da rota (os sem coordenada no fim). */
  order: string[]
  /** false = OSRM fora do ar: a ordem é a recebida e não deve virar sugestão. */
  computed: boolean
}

const OSRM_URL = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '')
const OSRM_TIMEOUT_MS = 8_000
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_MAX = 300
/** Até aqui a permutação exata é barata (8! = 40.320). */
const EXACT_MAX = 8

const EMPTY: RouteMetrics = { km: null, durationMin: null, geometry: [], legSeconds: [] }

// ── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map<string, { at: number; value: unknown }>()

function cached<T>(key: string, now: number = Date.now()): T | undefined {
  const hit = cache.get(key)
  if (!hit) return undefined
  if (now - hit.at > CACHE_TTL_MS) {
    cache.delete(key)
    return undefined
  }
  return hit.value as T
}

function remember(key: string, value: unknown): void {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
  cache.set(key, { at: Date.now(), value })
}

/** Só para testes. */
export function clearRouteCache(): void {
  cache.clear()
}

const coordsOf = (pts: GeoPoint[]) => pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')

async function osrmJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), OSRM_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    const body = (await res.json()) as { code?: string } & T
    if (body.code && body.code !== 'Ok') return null
    return body
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Matriz de duração (s) entre todos os pontos. `null` = OSRM indisponível. */
export async function osrmTable(points: GeoPoint[]): Promise<number[][] | null> {
  if (points.length < 2) return null
  const key = `table:${coordsOf(points)}`
  const hit = cached<number[][]>(key)
  if (hit) return hit
  const body = await osrmJson<{ durations?: Array<Array<number | null>> }>(`${OSRM_URL}/table/v1/driving/${coordsOf(points)}?annotations=duration`)
  if (!body?.durations || body.durations.length !== points.length) return null
  // Par sem caminho (null) vira custo enorme: a ordem evita, sem quebrar a conta.
  const durations = body.durations.map((row) => row.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 1e9)))
  remember(key, durations)
  return durations
}

/** Traçado, distância e pernas na ordem dada. `null` = OSRM indisponível. */
export async function osrmRoute(points: GeoPoint[]): Promise<RouteMetrics | null> {
  if (points.length < 2) return null
  const key = `route:${coordsOf(points)}`
  const hit = cached<RouteMetrics>(key)
  if (hit) return hit
  const body = await osrmJson<{
    routes?: Array<{ distance: number; duration: number; geometry?: { coordinates: Array<[number, number]> }; legs?: Array<{ duration: number }> }>
  }>(`${OSRM_URL}/route/v1/driving/${coordsOf(points)}?overview=full&geometries=geojson`)
  const r = body?.routes?.[0]
  if (!r) return null
  const metrics: RouteMetrics = {
    km: Math.round(r.distance / 100) / 10,
    durationMin: Math.round(r.duration / 60),
    geometry: (r.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]),
    legSeconds: (r.legs ?? []).map((l) => l.duration),
  }
  remember(key, metrics)
  return metrics
}

// ── Ordem ────────────────────────────────────────────────────────────────────

/**
 * Custo de visitar `seq` (índices da matriz) a partir de `start` (ou do 1º da sequência, sem base),
 * voltando a `start` quando `returnToStart`.
 */
export function pathCost(cost: number[][], seq: number[], start: number | null, returnToStart: boolean): number {
  let total = 0
  let prev = start
  for (const n of seq) {
    if (prev !== null) total += cost[prev][n]
    prev = n
  }
  if (returnToStart && start !== null && prev !== null) total += cost[prev][start]
  return total
}

function permutations(items: number[]): number[][] {
  if (items.length <= 1) return [items.slice()]
  const out: number[][] = []
  items.forEach((item, i) => {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const p of permutations(rest)) out.push([item, ...p])
  })
  return out
}

/** 2-opt: inverte trechos enquanto o custo cair. */
function twoOpt(cost: number[][], seq: number[], start: number | null, returnToStart: boolean): number[] {
  let best = seq.slice()
  let bestCost = pathCost(cost, best, start, returnToStart)
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const cand = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)]
        const c = pathCost(cost, cand, start, returnToStart)
        if (c + 1e-6 < bestCost) {
          best = cand
          bestCost = c
          improved = true
        }
      }
    }
  }
  return best
}

function nearestNeighbor(cost: number[][], nodes: number[], first: number): number[] {
  const left = new Set(nodes.filter((n) => n !== first))
  const seq = [first]
  while (left.size > 0) {
    const last = seq[seq.length - 1]
    let pick = -1
    for (const n of left) if (pick === -1 || cost[last][n] < cost[last][pick]) pick = n
    seq.push(pick)
    left.delete(pick)
  }
  return seq
}

/**
 * Melhor ordem de visita de `nodes` (índices da matriz). Com `start` (a base), sai dela; sem base,
 * o primeiro prédio é livre. Exata até 8 prédios; acima, vizinho mais próximo + 2-opt.
 */
export function solveOrder(cost: number[][], nodes: number[], start: number | null, returnToStart: boolean): number[] {
  if (nodes.length <= 1) return nodes.slice()
  if (nodes.length <= EXACT_MAX) {
    let best = nodes
    let bestCost = Infinity
    for (const p of permutations(nodes)) {
      const c = pathCost(cost, p, start, returnToStart)
      if (c < bestCost) {
        bestCost = c
        best = p
      }
    }
    return best
  }
  if (start !== null) {
    const nearest = nodes.reduce((a, b) => (cost[start][b] < cost[start][a] ? b : a))
    return twoOpt(cost, nearestNeighbor(cost, nodes, nearest), start, returnToStart)
  }
  // Sem base: tenta cada prédio como primeiro e fica com o melhor.
  let best = nodes
  let bestCost = Infinity
  for (const first of nodes) {
    const seq = twoOpt(cost, nearestNeighbor(cost, nodes, first), null, false)
    const c = pathCost(cost, seq, null, false)
    if (c < bestCost) {
      bestCost = c
      best = seq
    }
  }
  return best
}

/**
 * Melhor vão para encaixar `node` em `seq` (índices da matriz) sem mexer no resto: o de menor desvio
 * `d(a,k) + d(k,b) − d(a,b)`. Com `start` (a base), o 1º vão sai dela e, com `returnToStart`, o
 * último volta a ela; sem base, encaixar antes do 1º ou depois do último custa só a perna nova.
 * `index` é a posição em `seq` (0 = antes do 1º). No empate, fica o vão mais cedo.
 */
export function cheapestInsertion(
  cost: number[][],
  seq: number[],
  node: number,
  start: number | null,
  returnToStart: boolean,
): { index: number; delta: number } {
  let best = { index: seq.length, delta: Infinity }
  for (let i = 0; i <= seq.length; i++) {
    const prev = i === 0 ? start : seq[i - 1]
    const next = i === seq.length ? (returnToStart && start !== null ? start : null) : seq[i]
    const delta =
      (prev !== null ? cost[prev][node] : 0) + (next !== null ? cost[node][next] : 0) - (prev !== null && next !== null ? cost[prev][next] : 0)
    if (delta < best.delta - 1e-6) best = { index: i, delta }
  }
  return best
}

// ── API do motor ─────────────────────────────────────────────────────────────

const located = (s: RouteStop): s is RouteStop & GeoPoint => s.lat !== null && s.lng !== null

/**
 * Métricas e traçado da rota na ORDEM dada (rota salva, ordem do dia, "Ajustar" do admin).
 * A volta à base entra quando `returnToBase` e há base.
 */
export async function routeMetrics(input: { base: GeoPoint | null; stops: RouteStop[]; returnToBase: boolean }): Promise<RouteMetrics> {
  const pts: GeoPoint[] = [
    ...(input.base ? [input.base] : []),
    ...input.stops.filter(located).map((s) => ({ lat: s.lat, lng: s.lng })),
    ...(input.base && input.returnToBase ? [input.base] : []),
  ]
  return (await osrmRoute(pts)) ?? EMPTY
}

/**
 * Melhor rota para os prédios (sugestão ao admin). OSRM fora → a ordem recebida, sem métricas.
 */
export async function planRoute(input: { base: GeoPoint | null; stops: RouteStop[]; returnToBase: boolean }): Promise<RoutePlan> {
  const withCoords = input.stops.filter(located)
  const noCoords = input.stops.filter((s) => !located(s)).map((s) => s.id)
  const pts: GeoPoint[] = [...(input.base ? [input.base] : []), ...withCoords.map((s) => ({ lat: s.lat, lng: s.lng }))]
  const offset = input.base ? 1 : 0
  let ordered = withCoords
  if (withCoords.length >= 2 || (input.base && withCoords.length >= 1)) {
    const matrix = await osrmTable(pts)
    if (!matrix) return { order: input.stops.map((s) => s.id), ...EMPTY, computed: false }
    const nodes = withCoords.map((_, i) => i + offset)
    const seq = solveOrder(matrix, nodes, input.base ? 0 : null, input.returnToBase && !!input.base)
    ordered = seq.map((n) => withCoords[n - offset])
  }
  const metrics = await routeMetrics({ base: input.base, stops: ordered, returnToBase: input.returnToBase })
  return { order: [...ordered.map((s) => s.id), ...noCoords], ...metrics, computed: true }
}

/**
 * Encaixa `add` em `order` sem reordenar o que já está lá: um prédio por vez, no vão de menor desvio
 * (rota padrão, D-3/D-11). Prédio sem coordenada não entra; os de `order` sem coordenada ficam no
 * fim. OSRM fora → `computed: false` e a ordem recebida.
 */
export async function insertStops(input: {
  base: GeoPoint | null
  order: RouteStop[]
  add: RouteStop[]
  returnToBase: boolean
}): Promise<{ order: string[]; computed: boolean }> {
  const kept = input.order.filter(located)
  const tail = input.order.filter((s) => !located(s)).map((s) => s.id)
  const add = input.add.filter(located).filter((s) => !kept.some((k) => k.id === s.id))
  if (add.length === 0) return { order: input.order.map((s) => s.id), computed: true }
  const offset = input.base ? 1 : 0
  if (offset + kept.length + add.length < 2) return { order: [...kept, ...add].map((s) => s.id).concat(tail), computed: true }

  const all = [...kept, ...add]
  const matrix = await osrmTable([...(input.base ? [input.base] : []), ...all.map((s) => ({ lat: s.lat, lng: s.lng }))])
  if (!matrix) return { order: input.order.map((s) => s.id), computed: false }
  const seq = kept.map((_, i) => i + offset)
  add.forEach((_, j) => {
    const node = kept.length + j + offset
    const { index } = cheapestInsertion(matrix, seq, node, input.base ? 0 : null, input.returnToBase && !!input.base)
    seq.splice(index, 0, node)
  })
  return { order: [...seq.map((n) => all[n - offset].id), ...tail], computed: true }
}

/**
 * Hora prevista (`HH:MM`, BRT) de cada prédio: trajeto pelas pernas + tempo por porta.
 * `startAt` = início da rota (ou agora). Prédios já atrasados empurram os seguintes para depois de
 * `now`. Sem perna conhecida (sem mapa), a hora fica nula.
 */
export function computeEtas(input: {
  order: string[]
  legSeconds: number[]
  hasBase: boolean
  /** Ids com coordenada (as pernas só existem entre eles). */
  locatedIds: Set<string>
  doorsByCondo: Map<string, number>
  minPerDoor: number
  startAt: Date
  now: Date
  doneIds: Set<string>
}): Map<string, string | null> {
  const out = new Map<string, string | null>()
  const fmt = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  let t = input.startAt.getTime()
  let leg = 0
  let first = true
  let shift = 0
  for (const id of input.order) {
    if (!input.locatedIds.has(id)) {
      out.set(id, null)
      continue
    }
    // Sem base, o 1º prédio é o ponto de partida (perna zero).
    if (!first || input.hasBase) {
      const sec = input.legSeconds[leg++]
      if (sec === undefined) {
        out.set(id, null)
        continue
      }
      t += sec * 1000
    }
    first = false
    if (!input.doneIds.has(id) && shift === 0 && t < input.now.getTime()) shift = input.now.getTime() - t
    out.set(id, fmt(t + (input.doneIds.has(id) ? 0 : shift)))
    t += (input.doorsByCondo.get(id) ?? 0) * input.minPerDoor * 60_000
  }
  return out
}
