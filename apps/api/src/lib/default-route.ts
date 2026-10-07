import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { NotificationType } from '@prisma/client'
import { brtDateStr } from './cutoff.js'
import { getRouteConfig, type RouteConfig } from './route-config.js'
import { insertStops, planRoute, routeMetrics, type GeoPoint, type RouteStop } from './route-engine.js'
import { NotificationsService } from '../modules/notifications/notifications.service.js'

/**
 * Rota padrão (plano-rota-padrao): uma ordem só com os condomínios ativos com localização, para
 * todos os turnos (D-1/D-6) — a base das rotas dos entregadores sem rota própria (D-2).
 *
 * - "Sugerir rota" é efêmera: calcula a melhor ordem e não grava nada (D-5).
 * - Prédio novo, reativado ou que mudou de lugar encaixa sozinho no vão de menor desvio e fica
 *   marcado até o admin revisar (D-3/D-11): `syncDefaultRoute`, idempotente, nunca lança.
 * - Sem registro = não há rota padrão, e o fluxo da 1ª sugestão por entregador continua valendo.
 */

type Db = PrismaClient

export const DEFAULT_ROUTE_KEY = 'global'

export type AutoPlacedKind = 'NOVO' | 'REENCAIXADO'
export interface AutoPlaced {
  id: string
  kind: AutoPlacedKind
  at: string
  /** km que o encaixe somou à rota (negativo = encurtou). null sem traçado. */
  kmAdded: number | null
}

/** Encaixes ainda não revisados. Ignora o que não tem o formato. */
export function readAutoPlaced(json: unknown): AutoPlaced[] {
  if (!Array.isArray(json)) return []
  return json.flatMap((e) => {
    if (!e || typeof e !== 'object') return []
    const x = e as Partial<AutoPlaced>
    if (typeof x.id !== 'string' || (x.kind !== 'NOVO' && x.kind !== 'REENCAIXADO')) return []
    return [{ id: x.id, kind: x.kind, at: typeof x.at === 'string' ? x.at : new Date(0).toISOString(), kmAdded: typeof x.kmAdded === 'number' ? x.kmAdded : null }]
  })
}

export interface RouteCondo {
  id: string
  name: string
  lat: number | null
  lng: number | null
  approxLocation: boolean
}
type LocatedCondo = RouteCondo & { lat: number; lng: number }

const isLocated = (c: RouteCondo): c is LocatedCondo => c.lat !== null && c.lng !== null

/**
 * Condomínios ativos, por nome. A coordenada nula é separada em código: no Mongo, `where: { lat: null }`
 * não encontra o documento sem a chave.
 */
async function activeCondos(prisma: Pick<Db, 'condominium'>): Promise<{ located: LocatedCondo[]; outside: RouteCondo[] }> {
  const rows = await prisma.condominium.findMany({
    where: { isActive: true },
    select: { id: true, name: true, lat: true, lng: true, approxLocation: true },
    orderBy: { name: 'asc' },
  })
  const all: RouteCondo[] = rows.map((r) => ({ id: r.id, name: r.name, lat: r.lat ?? null, lng: r.lng ?? null, approxLocation: r.approxLocation ?? false }))
  return { located: all.filter(isLocated), outside: all.filter((c) => !isLocated(c)) }
}

export function getDefaultRoute(prisma: Pick<Db, 'defaultRoute'>) {
  return prisma.defaultRoute.findUnique({ where: { key: DEFAULT_ROUTE_KEY } })
}

/** Ordem da rota padrão para a rota do dia. null = não há (ou não deu para ler). Nunca lança. */
export async function defaultRouteOrder(fastify: FastifyInstance): Promise<string[] | null> {
  try {
    const route = await getDefaultRoute(fastify.prisma)
    return route ? route.condominiumIds : null
  } catch (err) {
    fastify.log.warn({ err }, '[default-route] falha ao ler a rota padrão — segue sem ela')
    return null
  }
}

const baseOf = (cfg: RouteConfig): GeoPoint | null => (cfg.base ? { lat: cfg.base.lat, lng: cfg.base.lng } : null)
const stopsOf = (ids: string[], byId: Map<string, RouteCondo>): RouteStop[] =>
  ids.map((id) => ({ id, lat: byId.get(id)?.lat ?? null, lng: byId.get(id)?.lng ?? null }))
const round1 = (n: number) => Math.round(n * 10) / 10

// ── Sugerir ──────────────────────────────────────────────────────────────────

export interface DefaultRouteSuggestion {
  condominiumIds: string[]
  km: number | null
  durationMin: number | null
  geometry: Array<[number, number]>
  /** false = OSRM fora do ar: não há sugestão para mostrar. */
  computed: boolean
  /** km da sugestão − km da rota salva (mesma base e volta). null sem rota salva ou sem traçado. */
  deltaKm: number | null
}

/** "Sugerir rota" (D-5/D-10): a melhor ordem para todos os ativos com localização. Não grava. */
export async function suggestDefaultRoute(prisma: Db): Promise<DefaultRouteSuggestion> {
  const [cfg, { located }, saved] = await Promise.all([getRouteConfig(prisma), activeCondos(prisma), getDefaultRoute(prisma)])
  if (located.length === 0) return { condominiumIds: [], km: null, durationMin: null, geometry: [], computed: true, deltaKm: null }
  const base = baseOf(cfg)
  const plan = await planRoute({ base, stops: located.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng })), returnToBase: cfg.voltaBase })
  if (!plan.computed) return { condominiumIds: plan.order, km: null, durationMin: null, geometry: [], computed: false, deltaKm: null }

  let deltaKm: number | null = null
  if (saved && plan.km !== null) {
    const byId = new Map<string, RouteCondo>(located.map((c) => [c.id, c]))
    const ids = saved.condominiumIds.filter((id) => byId.has(id))
    const current = ids.length > 0 ? await routeMetrics({ base, stops: stopsOf(ids, byId), returnToBase: cfg.voltaBase }) : null
    if (current?.km != null) deltaKm = round1(plan.km - current.km)
  }
  return { condominiumIds: plan.order, km: plan.km, durationMin: plan.durationMin, geometry: plan.geometry, computed: true, deltaKm }
}

// ── Salvar ───────────────────────────────────────────────────────────────────

/**
 * Com rota padrão, quem não tem rota própria segue a padrão (D-2): as 1ªs sugestões pendentes caem.
 * Filtra em código — o template da 1ª sugestão nasce sem a chave `acceptedAt` no Mongo.
 */
async function releaseFirstSuggestions(prisma: Db): Promise<void> {
  const templates = await prisma.courierRouteTemplate.findMany({ select: { id: true, acceptedAt: true, suggestion: true } })
  const ids = templates.filter((t) => !t.acceptedAt && t.suggestion != null).map((t) => t.id)
  if (ids.length > 0) await prisma.courierRouteTemplate.updateMany({ where: { id: { in: ids } }, data: { suggestion: null } })
}

/**
 * Grava a ordem do admin (§3.6): ignora o prédio que deixou de entrar no meio do caminho (inativo,
 * sem localização, apagado), limpa os selos de encaixe e encaixa o que faltar.
 * @throws 400 lista vazia, repetida ou sem nenhum prédio válido
 */
export async function saveDefaultRoute(fastify: FastifyInstance, ids: string[], adminId: string, now: Date = new Date()): Promise<void> {
  if (ids.length === 0 || new Set(ids).size !== ids.length) throw { statusCode: 400, message: 'Ordem inválida' }
  const prisma = fastify.prisma
  const [cfg, { located }] = await Promise.all([getRouteConfig(prisma), activeCondos(prisma)])
  const byId = new Map<string, RouteCondo>(located.map((c) => [c.id, c]))
  const valid = ids.filter((id) => byId.has(id))
  if (valid.length === 0) throw { statusCode: 400, message: 'Nenhum condomínio ativo com localização na ordem' }
  const m = await routeMetrics({ base: baseOf(cfg), stops: stopsOf(valid, byId), returnToBase: cfg.voltaBase })
  const data = { condominiumIds: valid, km: m.km, durationMin: m.durationMin, autoPlaced: [] as object[], savedAt: now, savedById: adminId }
  await prisma.defaultRoute.upsert({ where: { key: DEFAULT_ROUTE_KEY }, create: { key: DEFAULT_ROUTE_KEY, ...data }, update: data })
  await releaseFirstSuggestions(prisma)
  await syncDefaultRoute(fastify, { now })
}

/** "Está bom assim": os encaixes ficam como estão e os selos somem. @throws 404 sem rota padrão */
export async function reviewDefaultRoute(prisma: Pick<Db, 'defaultRoute'>): Promise<void> {
  if (!(await getDefaultRoute(prisma))) throw { statusCode: 404, message: 'Ainda não há rota padrão' }
  await prisma.defaultRoute.update({ where: { key: DEFAULT_ROUTE_KEY }, data: { autoPlaced: [] } })
}

// ── Encaixe automático ───────────────────────────────────────────────────────

/**
 * Deixa a rota padrão coerente com os condomínios (§3.5): tira os inativos, apagados e sem
 * localização; reencaixa os `moved` (a localização mudou) e encaixa os que faltam, um por vez, no
 * vão de menor desvio; avisa o admin de cada encaixe. OSRM fora: só as remoções — o que mudou de
 * lugar fica onde estava e o novo fica de fora até a próxima chamada.
 * Devolve true quando gravou alguma mudança. Nunca lança.
 */
export async function syncDefaultRoute(fastify: FastifyInstance, opts: { moved?: string[]; now?: Date } = {}): Promise<boolean> {
  try {
    return await syncOnce(fastify, opts, false)
  } catch (err) {
    fastify.log.warn({ err }, '[default-route] falha ao sincronizar a rota padrão — ignorado')
    return false
  }
}

async function syncOnce(fastify: FastifyInstance, opts: { moved?: string[]; now?: Date }, retried: boolean): Promise<boolean> {
  const prisma = fastify.prisma
  const route = await getDefaultRoute(prisma)
  if (!route) return false
  const { located } = await activeCondos(prisma)
  const byId = new Map<string, RouteCondo>(located.map((c) => [c.id, c]))

  let order = route.condominiumIds.filter((id) => byId.has(id))
  const removed = order.length !== route.condominiumIds.length
  const moved = [...new Set(opts.moved ?? [])].filter((id) => order.includes(id))
  const toPlace: Array<{ id: string; kind: AutoPlacedKind }> = [
    ...moved.map((id) => ({ id, kind: 'REENCAIXADO' as const })),
    ...located.filter((c) => !order.includes(c.id)).map((c) => ({ id: c.id, kind: 'NOVO' as const })),
  ]
  const flags = readAutoPlaced(route.autoPlaced)
  const keptFlags = flags.filter((f) => byId.has(f.id))
  if (!removed && toPlace.length === 0 && keptFlags.length === flags.length) return false

  const now = opts.now ?? new Date()
  let km = route.km
  let durationMin = route.durationMin
  const placed: AutoPlaced[] = []
  if (removed || toPlace.length > 0) {
    const cfg = await getRouteConfig(prisma)
    const base = baseOf(cfg)
    const metricsOf = (ids: string[]) => routeMetrics({ base, stops: stopsOf(ids, byId), returnToBase: cfg.voltaBase })
    let current = await metricsOf(order)
    for (const p of toPlace) {
      const rest = order.filter((id) => id !== p.id)
      const res = await insertStops({ base, order: stopsOf(rest, byId), add: stopsOf([p.id], byId), returnToBase: cfg.voltaBase })
      if (!res.computed) break
      const after = await metricsOf(res.order)
      placed.push({ id: p.id, kind: p.kind, at: now.toISOString(), kmAdded: after.km !== null && current.km !== null ? round1(after.km - current.km) : null })
      order = res.order
      current = after
    }
    // Sem traçado (OSRM fora), fica o km guardado: melhor um número antigo do que nenhum.
    km = current.km ?? km
    durationMin = current.durationMin ?? durationMin
  }

  const autoPlaced = [...keptFlags.filter((f) => !placed.some((p) => p.id === f.id)), ...placed]
  // Gravação condicionada: dois cadastros ao mesmo tempo não se atropelam (R-5).
  const { count } = await prisma.defaultRoute.updateMany({
    where: { key: DEFAULT_ROUTE_KEY, updatedAt: route.updatedAt },
    data: { condominiumIds: order, km, durationMin, autoPlaced: autoPlaced as unknown as object[] },
  })
  if (count === 0) return retried ? false : syncOnce(fastify, opts, true)
  await notifyPlaced(fastify, placed, order, byId)
  return true
}

const fmtKm = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

async function notifyPlaced(fastify: FastifyInstance, placed: AutoPlaced[], order: string[], byId: Map<string, RouteCondo>): Promise<void> {
  if (placed.length === 0) return
  try {
    const notifications = new NotificationsService(fastify)
    for (const p of placed) {
      const name = byId.get(p.id)?.name ?? 'Condomínio'
      const km = p.kmAdded === null ? '' : ` (${p.kmAdded < 0 ? '−' : '+'}${fmtKm(Math.abs(p.kmAdded))} km)`
      const what = p.kind === 'NOVO' ? 'entrou na' : 'mudou de endereço e foi para a'
      await notifications.notifyAdmins({
        type: NotificationType.ADMIN_ROUTE_SUGGESTION,
        title: 'Rota padrão',
        body: `${name} ${what} posição ${order.indexOf(p.id) + 1}${km}. Revise em Rotas e comprovante.`,
        actionRoute: '/admin',
        dedupeKey: `default-route:${p.id}:${p.kind}:${brtDateStr(new Date(p.at))}`,
      })
    }
  } catch (err) {
    fastify.log.warn({ err }, '[default-route] falha ao avisar o encaixe — ignorado')
  }
}

/** Base ou volta mudaram na A5: recalcula o km e o tempo guardados (o resumo da A5). Nunca lança. */
export async function refreshDefaultRouteMetrics(fastify: FastifyInstance): Promise<void> {
  try {
    const prisma = fastify.prisma
    const route = await getDefaultRoute(prisma)
    if (!route) return
    const [cfg, { located }] = await Promise.all([getRouteConfig(prisma), activeCondos(prisma)])
    const byId = new Map<string, RouteCondo>(located.map((c) => [c.id, c]))
    const ids = route.condominiumIds.filter((id) => byId.has(id))
    const m = await routeMetrics({ base: baseOf(cfg), stops: stopsOf(ids, byId), returnToBase: cfg.voltaBase })
    if (m.km !== null) await prisma.defaultRoute.update({ where: { key: DEFAULT_ROUTE_KEY }, data: { km: m.km, durationMin: m.durationMin } })
  } catch (err) {
    fastify.log.warn({ err }, '[default-route] falha ao recalcular o km da rota padrão — ignorado')
  }
}

// ── Visões do admin ──────────────────────────────────────────────────────────

export interface DefaultRouteView {
  base: RouteConfig['base']
  voltaBase: boolean
  saved: {
    condominiumIds: string[]
    km: number | null
    durationMin: number | null
    geometry: Array<[number, number]>
    savedAt: string
    savedByName: string | null
  } | null
  /** Ativos com localização (os que entram), com o selo do encaixe pendente. */
  condos: Array<RouteCondo & { flag: AutoPlacedKind | null; kmAdded: number | null }>
  /** Ativos sem localização: "fora do mapa" (D-6). */
  outside: Array<{ id: string; name: string }>
}

/** Tela da rota padrão: sincroniza antes, para o admin ver o que vale. */
export async function defaultRouteView(fastify: FastifyInstance): Promise<DefaultRouteView> {
  await syncDefaultRoute(fastify)
  const prisma = fastify.prisma
  const [route, cfg, { located, outside }] = await Promise.all([getDefaultRoute(prisma), getRouteConfig(prisma), activeCondos(prisma)])
  const byId = new Map<string, RouteCondo>(located.map((c) => [c.id, c]))
  const flagOf = new Map(readAutoPlaced(route?.autoPlaced).map((f) => [f.id, f]))

  let saved: DefaultRouteView['saved'] = null
  if (route) {
    const ids = route.condominiumIds.filter((id) => byId.has(id))
    const [m, by] = await Promise.all([
      routeMetrics({ base: baseOf(cfg), stops: stopsOf(ids, byId), returnToBase: cfg.voltaBase }),
      route.savedById ? prisma.user.findUnique({ where: { id: route.savedById }, select: { name: true } }) : null,
    ])
    saved = {
      condominiumIds: ids,
      km: m.km ?? route.km ?? null,
      durationMin: m.durationMin ?? route.durationMin ?? null,
      geometry: m.geometry,
      savedAt: (route.savedAt ?? route.updatedAt).toISOString(),
      savedByName: by?.name ?? null,
    }
  }
  return {
    base: cfg.base,
    voltaBase: cfg.voltaBase,
    saved,
    condos: located.map((c) => ({ ...c, flag: flagOf.get(c.id)?.kind ?? null, kmAdded: flagOf.get(c.id)?.kmAdded ?? null })),
    outside: outside.map((c) => ({ id: c.id, name: c.name })),
  }
}

export interface DefaultRouteSummary {
  count: number
  km: number | null
  durationMin: number | null
  savedAt: string
  /** Encaixes automáticos à espera de revisão. */
  toReview: number
  /** Ativos sem localização. */
  outside: number
}

/** Card da A5. null = ainda não há rota padrão. Não chama o OSRM (usa o km guardado). */
export async function defaultRouteSummary(prisma: Db): Promise<DefaultRouteSummary | null> {
  const [route, { located, outside }] = await Promise.all([getDefaultRoute(prisma), activeCondos(prisma)])
  if (!route) return null
  const ids = new Set(located.map((c) => c.id))
  return {
    count: route.condominiumIds.filter((id) => ids.has(id)).length,
    km: route.km ?? null,
    durationMin: route.durationMin ?? null,
    savedAt: (route.savedAt ?? route.updatedAt).toISOString(),
    toReview: readAutoPlaced(route.autoPlaced).filter((f) => ids.has(f.id)).length,
    outside: outside.length,
  }
}
