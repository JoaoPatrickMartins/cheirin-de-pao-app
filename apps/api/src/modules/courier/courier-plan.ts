import type { PrismaClient, CourierRouteTemplate, CourierRun } from '@prisma/client'
import { NotificationType } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { getRouteConfig, type RouteConfig } from '../../lib/route-config.js'
import { planRoute, routeMetrics, type RouteMetrics, type RouteStop } from '../../lib/route-engine.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import { brtDateStr } from '../../lib/cutoff.js'
import { defaultRouteOrder, getDefaultRoute, syncDefaultRoute } from '../../lib/default-route.js'

/**
 * Rota do entregador num turno (D-5 do plano do entregador).
 *
 * - Com ROTA PADRÃO (plano-rota-padrao, D-2), quem não tem rota própria segue a padrão só com os
 *   prédios do dia — sem 1ª sugestão a aprovar. A rota própria vale por cima.
 * - O sistema SUGERE a melhor rota; o admin aceita e ela vira a ROTA SALVA do entregador/turno.
 * - Prédio novo (que não está na rota salva) gera uma sugestão nova para o admin. Prédio que não
 *   tem entrega no dia só é pulado — não gera sugestão.
 * - Enquanto o admin não decide, o dia usa a rota salva com o prédio novo na posição sugerida
 *   (D-5c). Sem rota salva nenhuma (1ª vez), o dia usa a própria sugestão.
 * - A ordem do entregador (reordenar, D-5b) e a ordem do início da rota ficam no `CourierRun` e
 *   valem só naquele dia.
 */

type Db = PrismaClient

export interface PlanCondo {
  id: string
  name?: string
  lat: number | null
  lng: number | null
}

export interface RouteSuggestion {
  condominiumIds: string[]
  km: number | null
  durationMin: number | null
  /** FIRST = ainda não há rota salva; NEW_CONDO = prédio novo entrou na rota. */
  reason: 'FIRST' | 'NEW_CONDO'
  newIds: string[]
  removedIds: string[]
  createdAt: string
}

export function readSuggestion(json: unknown): RouteSuggestion | null {
  if (!json || typeof json !== 'object') return null
  const s = json as Partial<RouteSuggestion>
  if (!Array.isArray(s.condominiumIds)) return null
  return {
    condominiumIds: s.condominiumIds.filter((x): x is string => typeof x === 'string'),
    km: typeof s.km === 'number' ? s.km : null,
    durationMin: typeof s.durationMin === 'number' ? s.durationMin : null,
    reason: s.reason === 'NEW_CONDO' ? 'NEW_CONDO' : 'FIRST',
    newIds: Array.isArray(s.newIds) ? s.newIds.filter((x): x is string => typeof x === 'string') : [],
    removedIds: Array.isArray(s.removedIds) ? s.removedIds.filter((x): x is string => typeof x === 'string') : [],
    createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date(0).toISOString(),
  }
}

/**
 * Ordem do dia (pura). Parte da ordem `primary` (rota salva / ordem do entregador), só com os prédios
 * de hoje; cada prédio de hoje que não está nela entra logo depois do vizinho que o precede em
 * `secondary` (a sugestão) — ou no começo, se for o primeiro de lá; sem posição sugerida, no fim.
 */
export function dayOrderFrom(presentIds: string[], primary: string[] | null, secondary: string[] | null): string[] {
  const present = new Set(presentIds)
  if (!primary || primary.length === 0) {
    if (!secondary) return [...presentIds]
    const fromSecondary = secondary.filter((id) => present.has(id))
    return [...fromSecondary, ...presentIds.filter((id) => !fromSecondary.includes(id))]
  }
  const order = primary.filter((id) => present.has(id))
  const missing = presentIds.filter((id) => !order.includes(id))
  const placed = (secondary ?? []).filter((id) => missing.includes(id))
  for (const id of placed) {
    const pos = secondary!.indexOf(id)
    let anchor = -1
    for (let i = pos - 1; i >= 0; i--) {
      anchor = order.indexOf(secondary![i])
      if (anchor !== -1) break
    }
    order.splice(anchor + 1, 0, id)
  }
  for (const id of missing) if (!order.includes(id)) order.push(id)
  return order
}

const unique = (ids: string[]) => [...new Set(ids)]

/** Coordenadas dos prédios (as que vieram na tela + as do banco para os que faltam). */
async function stopsFor(prisma: Db, ids: string[], known: PlanCondo[] = []): Promise<RouteStop[]> {
  const byId = new Map(known.map((c) => [c.id, c]))
  const missing = ids.filter((id) => !byId.has(id))
  if (missing.length > 0) {
    const rows = await prisma.condominium.findMany({ where: { id: { in: missing } }, select: { id: true, name: true, lat: true, lng: true } })
    for (const r of rows) byId.set(r.id, { id: r.id, name: r.name, lat: r.lat ?? null, lng: r.lng ?? null })
  }
  return ids.map((id) => ({ id, lat: byId.get(id)?.lat ?? null, lng: byId.get(id)?.lng ?? null }))
}

const baseOf = (cfg: RouteConfig) => (cfg.base ? { lat: cfg.base.lat, lng: cfg.base.lng } : null)

/** km/tempo/traçado de uma ordem qualquer (rota salva, ordem do dia, "Ajustar"). */
export async function metricsForOrder(prisma: Db, ids: string[], known: PlanCondo[] = [], cfg?: RouteConfig): Promise<RouteMetrics> {
  const config = cfg ?? (await getRouteConfig(prisma))
  return routeMetrics({ base: baseOf(config), stops: await stopsFor(prisma, ids, known), returnToBase: config.voltaBase })
}

/**
 * Garante a sugestão para o conjunto de prédios do turno: sem rota salva, a 1ª sugestão; com rota
 * salva, uma sugestão nova quando entra prédio que ela não tem. Não recalcula se a sugestão
 * pendente já cobre o conjunto. Avisa o admin (`ADMIN_ROUTE_SUGGESTION`). Nunca lança.
 * Com rota padrão e sem rota salva, não sugere: o turno segue a padrão (D-2 da rota padrão).
 */
export async function ensureSuggestion(
  fastify: FastifyInstance,
  input: {
    courierId: string
    slotId: string
    condos: PlanCondo[]
    template?: CourierRouteTemplate | null
    slotLabel?: string
    now?: Date
    /** Ordem da rota padrão já lida (null = não há). Ausente: lê aqui. */
    defaultIds?: string[] | null
  },
): Promise<CourierRouteTemplate | null> {
  const prisma = fastify.prisma
  try {
    const template =
      input.template !== undefined
        ? input.template
        : await prisma.courierRouteTemplate.findUnique({ where: { courierId_slotId: { courierId: input.courierId, slotId: input.slotId } } })
    const present = input.condos.map((c) => c.id)
    if (present.length === 0) return template
    if (!template?.acceptedAt) {
      const defaultIds = input.defaultIds !== undefined ? input.defaultIds : await defaultRouteOrder(fastify)
      if (defaultIds) return template
    }
    const saved = template?.acceptedAt ? template.condominiumIds : []
    const newIds = present.filter((id) => !saved.includes(id))
    if (template?.acceptedAt && newIds.length === 0) return template
    const universe = unique([...saved, ...present])
    const pending = readSuggestion(template?.suggestion)
    if (pending && universe.every((id) => pending.condominiumIds.includes(id))) return template

    const cfg = await getRouteConfig(prisma)
    const plan = await planRoute({ base: baseOf(cfg), stops: await stopsFor(prisma, universe, input.condos), returnToBase: cfg.voltaBase })
    if (!plan.computed) return template // OSRM fora: tenta de novo na próxima vez
    const first = !template?.acceptedAt
    const suggestion: RouteSuggestion = {
      condominiumIds: plan.order,
      km: plan.km,
      durationMin: plan.durationMin,
      reason: first ? 'FIRST' : 'NEW_CONDO',
      newIds: first ? [] : newIds,
      removedIds: [],
      createdAt: (input.now ?? new Date()).toISOString(),
    }
    const saved2 = await prisma.courierRouteTemplate.upsert({
      where: { courierId_slotId: { courierId: input.courierId, slotId: input.slotId } },
      create: { courierId: input.courierId, slotId: input.slotId, condominiumIds: [], suggestion: suggestion as object },
      update: { suggestion: suggestion as object },
    })
    await notifySuggestion(fastify, input.courierId, input.slotLabel ?? input.slotId, suggestion, universe)
    return saved2
  } catch (err) {
    fastify.log.warn({ err, courierId: input.courierId, slotId: input.slotId }, '[courier-plan] falha ao sugerir rota — ignorado')
    return input.template ?? null
  }
}

async function notifySuggestion(fastify: FastifyInstance, courierId: string, slotLabel: string, s: RouteSuggestion, universe: string[]): Promise<void> {
  try {
    const courier = await fastify.prisma.user.findUnique({ where: { id: courierId }, select: { name: true } })
    const who = courier?.name?.split(' ')[0] ?? 'Entregador'
    const body =
      s.reason === 'FIRST'
        ? `${who} · ${slotLabel}: a primeira rota está pronta para você aprovar.`
        : `${who} · ${slotLabel}: ${s.newIds.length === 1 ? '1 prédio novo' : `${s.newIds.length} prédios novos`} na rota. Veja a sugestão.`
    await new NotificationsService(fastify).notifyAdmins({
      type: NotificationType.ADMIN_ROUTE_SUGGESTION,
      title: 'Sugestão de rota',
      body,
      actionRoute: '/admin',
      dedupeKey: `route-sug:${courierId}:${slotLabel}:${[...universe].sort().join(',')}`,
    })
  } catch (err) {
    fastify.log.warn({ err, courierId }, '[courier-plan] falha ao avisar a sugestão de rota — ignorado')
  }
}

export interface DayRoute {
  /** Prédios do turno na ordem do dia. */
  order: string[]
  metrics: RouteMetrics
  /** DEFAULT = segue a rota padrão (sem rota própria). */
  source: 'RUN' | 'TEMPLATE' | 'DEFAULT' | 'SUGGESTION' | 'NONE'
  run: CourierRun | null
  template: CourierRouteTemplate | null
  pendingSuggestion: boolean
  reorderedToday: boolean
}

/**
 * Ordem do dia de um turno e o traçado dela: ordem do entregador no dia → rota própria → rota padrão
 * → sugestão pendente. `ignoreRun` = a ordem padrão do turno (o "Voltar à rota padrão" do
 * entregador).
 */
export async function resolveDayRoute(
  fastify: FastifyInstance,
  input: {
    courierId: string
    slotId: string
    date: string
    condos: PlanCondo[]
    /**
     * Prédios que contam para a rota salva. Sem ele, todos. O prédio que só tem gancho no turno fica
     * de fora: um gancho avulso não deve gerar sugestão de mudar a rota fixa do entregador.
     */
    suggestFrom?: PlanCondo[]
    slotLabel?: string
    config?: RouteConfig
    ignoreRun?: boolean
  },
): Promise<DayRoute> {
  const prisma = fastify.prisma
  const [run, found] = await Promise.all([
    prisma.courierRun.findUnique({ where: { courierId_date_slotId: { courierId: input.courierId, date: input.date, slotId: input.slotId } } }),
    prisma.courierRouteTemplate.findUnique({ where: { courierId_slotId: { courierId: input.courierId, slotId: input.slotId } } }),
  ])
  let defaultIds = found?.acceptedAt ? null : await defaultRouteOrder(fastify)
  // Prédio do dia com localização que ainda não está na padrão: tenta encaixar antes (best-effort).
  if (defaultIds && input.condos.some((c) => c.lat !== null && c.lng !== null && !defaultIds!.includes(c.id))) {
    if (await syncDefaultRoute(fastify)) defaultIds = (await defaultRouteOrder(fastify)) ?? defaultIds
  }
  const template = await ensureSuggestion(fastify, {
    courierId: input.courierId,
    slotId: input.slotId,
    condos: input.suggestFrom ?? input.condos,
    template: found,
    slotLabel: input.slotLabel,
    defaultIds,
  })
  const present = input.condos.map((c) => c.id)
  const saved = template?.acceptedAt ? template.condominiumIds : null
  const followsDefault = !saved && !!defaultIds
  // Quem segue a padrão não tem sugestão (uma 1ª sugestão antiga fica ignorada).
  const suggestion = followsDefault ? null : readSuggestion(template?.suggestion)
  let order = dayOrderFrom(present, saved ?? (followsDefault ? defaultIds : null), suggestion?.condominiumIds ?? null)
  let source: DayRoute['source'] = saved ? 'TEMPLATE' : followsDefault ? 'DEFAULT' : suggestion ? 'SUGGESTION' : 'NONE'
  if (run && !input.ignoreRun && run.condominiumIds.length > 0) {
    order = dayOrderFrom(present, run.condominiumIds, order)
    source = 'RUN'
  }
  const cfg = input.config ?? (await getRouteConfig(prisma))
  const metrics = await metricsForOrder(prisma, order, input.condos, cfg)
  return {
    order,
    metrics,
    source,
    run,
    template,
    pendingSuggestion: !!suggestion,
    reorderedToday: !input.ignoreRun && (run?.reordered ?? false),
  }
}

// ── Ações do admin (A4) ──────────────────────────────────────────────────────

async function findTemplate(prisma: Db, courierId: string, slotId: string) {
  return prisma.courierRouteTemplate.findUnique({ where: { courierId_slotId: { courierId, slotId } } })
}

export type RouteChangeKind = 'ACCEPT' | 'KEEP' | 'ADJUST' | 'ADOPT'
export interface RouteChange {
  at: string
  date: string
  kind: RouteChangeKind
  km: number | null
  kmAlt: number | null
}
const ACCEPT_LOG_MAX = 50

/** Histórico das mudanças da rota salva (A9). Ignora o que não tem o formato. */
export function readAcceptLog(json: unknown): RouteChange[] {
  if (!Array.isArray(json)) return []
  return json.flatMap((e) => {
    if (!e || typeof e !== 'object') return []
    const x = e as Partial<RouteChange>
    if (typeof x.date !== 'string' || !['ACCEPT', 'KEEP', 'ADJUST', 'ADOPT'].includes(x.kind as string)) return []
    return [{ at: typeof x.at === 'string' ? x.at : x.date, date: x.date, kind: x.kind as RouteChangeKind, km: typeof x.km === 'number' ? x.km : null, kmAlt: typeof x.kmAlt === 'number' ? x.kmAlt : null }]
  })
}

async function saveAccepted(
  prisma: Db,
  courierId: string,
  slotId: string,
  ids: string[],
  adminId: string,
  change: { kind: RouteChangeKind; kmAlt?: number | null; previous?: CourierRouteTemplate | null },
) {
  const m = await metricsForOrder(prisma, ids)
  const now = new Date()
  const entry: RouteChange = { at: now.toISOString(), date: brtDateStr(now), kind: change.kind, km: m.km, kmAlt: change.kmAlt ?? null }
  const acceptLog = [...readAcceptLog(change.previous?.acceptLog), entry].slice(-ACCEPT_LOG_MAX) as object[]
  const data = { condominiumIds: ids, km: m.km, durationMin: m.durationMin, acceptedAt: now, acceptedById: adminId, suggestion: null, acceptLog }
  return prisma.courierRouteTemplate.upsert({
    where: { courierId_slotId: { courierId, slotId } },
    create: { courierId, slotId, ...data },
    update: data,
  })
}

/** "Usar sugestão". @throws 404 sem sugestão pendente */
export async function acceptSuggestion(prisma: Db, courierId: string, slotId: string, adminId: string) {
  const template = await findTemplate(prisma, courierId, slotId)
  const s = readSuggestion(template?.suggestion)
  if (!s) throw { statusCode: 404, message: 'Não há sugestão pendente para esta rota' }
  // A economia (A9) compara com a alternativa evitada: a rota salva com os prédios novos.
  let kmAlt: number | null = null
  if (template?.acceptedAt && template.condominiumIds.length > 0) {
    const alt = dayOrderFrom(unique([...template.condominiumIds, ...s.condominiumIds]), template.condominiumIds, s.condominiumIds)
    kmAlt = (await metricsForOrder(prisma, alt)).km
  }
  return saveAccepted(prisma, courierId, slotId, s.condominiumIds, adminId, { kind: 'ACCEPT', kmAlt, previous: template })
}

/**
 * "Manter a atual": a ordem salva continua; os prédios novos entram na posição sugerida (a mesma
 * ordem que o dia já usava), para a sugestão não voltar a cada aprovação.
 * @throws 400 sem rota salva (1ª sugestão) · 404 sem sugestão
 */
export async function keepCurrent(prisma: Db, courierId: string, slotId: string, adminId: string) {
  const template = await findTemplate(prisma, courierId, slotId)
  const s = readSuggestion(template?.suggestion)
  if (!s) throw { statusCode: 404, message: 'Não há sugestão pendente para esta rota' }
  if (!template?.acceptedAt) throw { statusCode: 400, message: 'Ainda não há rota salva para manter — use ou ajuste a sugestão' }
  const ids = dayOrderFrom(unique([...template.condominiumIds, ...s.condominiumIds]), template.condominiumIds, s.condominiumIds)
  return saveAccepted(prisma, courierId, slotId, ids, adminId, { kind: 'KEEP', previous: template })
}

/** "Ajustar" → "Salvar rota". @throws 400 lista vazia ou repetida */
export async function saveOrder(prisma: Db, courierId: string, slotId: string, ids: string[], adminId: string) {
  if (ids.length === 0 || unique(ids).length !== ids.length) throw { statusCode: 400, message: 'Ordem inválida' }
  return saveAccepted(prisma, courierId, slotId, ids, adminId, { kind: 'ADJUST', previous: await findTemplate(prisma, courierId, slotId) })
}

/** "Adotar como rota padrão" a ordem que o entregador usou num dia. @throws 404 */
export async function adoptRun(prisma: Db, courierId: string, slotId: string, runId: string, adminId: string) {
  const run = await prisma.courierRun.findUnique({ where: { id: runId } })
  if (!run || run.courierId !== courierId || run.slotId !== slotId) throw { statusCode: 404, message: 'Rota do dia não encontrada' }
  const template = await findTemplate(prisma, courierId, slotId)
  const others = (template?.condominiumIds ?? []).filter((id) => !run.condominiumIds.includes(id))
  const ids = dayOrderFrom(unique([...run.condominiumIds, ...others]), run.condominiumIds, template?.condominiumIds ?? null)
  return saveAccepted(prisma, courierId, slotId, ids, adminId, { kind: 'ADOPT', previous: template })
}

/**
 * "Voltar à rota padrão" (D-7 da rota padrão): apaga a rota própria do entregador/turno, que passa a
 * seguir a padrão. O `acceptLog` fica — a economia das rotas (A9) não perde histórico.
 * @throws 400 sem rota padrão
 */
export async function resetToDefault(prisma: Db, courierId: string, slotId: string) {
  if (!(await getDefaultRoute(prisma))) throw { statusCode: 400, message: 'Ainda não há rota padrão para seguir' }
  const template = await findTemplate(prisma, courierId, slotId)
  if (!template) return null
  return prisma.courierRouteTemplate.update({
    where: { id: template.id },
    data: { condominiumIds: [], km: null, durationMin: null, acceptedAt: null, acceptedById: null, suggestion: null },
  })
}
