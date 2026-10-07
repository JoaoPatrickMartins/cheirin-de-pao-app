import type { FastifyInstance } from 'fastify'
import { FAILURE_LABELS, isFailureCode } from '@cheirin-de-pao/shared'
import { brtDateStr, brtDayRange } from '../../lib/cutoff.js'
import { getRouteConfig } from '../../lib/route-config.js'
import { getGlobalDeliverySlots } from '../../lib/delivery-slots.js'
import { pendingHookOnlyStops, resolvedHookOnlyStops } from '../../lib/hook-stops.js'
import { defaultRouteView, getDefaultRoute, reviewDefaultRoute, saveDefaultRoute, suggestDefaultRoute } from '../../lib/default-route.js'
import { acceptSuggestion, adoptRun, dayOrderFrom, keepCurrent, metricsForOrder, readSuggestion, resetToDefault, saveOrder } from '../courier/courier-plan.js'

/**
 * Rotas dos entregadores no admin (plano do entregador):
 * - A4 · rota salva × sugestão, ajustar e adotar a ordem que o entregador usou;
 * - A2 · mapa ao vivo e progresso das rotas de hoje;
 * - rota padrão (plano-rota-padrao): ver, sugerir, salvar e revisar os encaixes; no A4, quem segue a
 *   padrão e o "Voltar à rota padrão".
 */

const DAY_MS = 24 * 60 * 60 * 1000

const hhmm = (d: Date | null | undefined) =>
  d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : null

/** Posição mais velha que isso aparece esmaecida ("última posição há N min"). */
export const STALE_POSITION_MS = 10 * 60 * 1000

/** "Trocou Bela Vista ↔ Aurora" ou "Mudou a ordem de 3 prédios". */
export function describeChange(saved: string[], used: string[], names: Map<string, string>): string {
  const common = used.filter((id) => saved.includes(id))
  const base = saved.filter((id) => common.includes(id))
  const diff = common.map((id, i) => (base[i] !== id ? i : -1)).filter((i) => i !== -1)
  if (diff.length === 0) return 'Mesma ordem da rota salva'
  if (diff.length === 2 && base[diff[0]] === common[diff[1]] && base[diff[1]] === common[diff[0]]) {
    // Na ordem da rota salva: "Trocou <o que vinha antes> ↔ <o que vinha depois>".
    return `Trocou ${names.get(base[diff[0]]) ?? 'prédio'} ↔ ${names.get(base[diff[1]]) ?? 'prédio'}`
  }
  return `Mudou a ordem de ${diff.length} prédios`
}

export class AdminCourierRoutesService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /** A4: rota salva + sugestão pendente + alterações do entregador (30 dias). @throws 404 */
  async getRoute(courierId: string, slotId: string, now: Date = new Date()) {
    const [courier, template, slots, cfg] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: courierId }, select: { id: true, name: true, role: true } }),
      this.prisma.courierRouteTemplate.findUnique({ where: { courierId_slotId: { courierId, slotId } } }),
      getGlobalDeliverySlots(this.prisma),
      getRouteConfig(this.prisma),
    ])
    if (!courier || courier.role !== 'COURIER') throw { statusCode: 404, message: 'Entregador não encontrado' }
    const slot = slots.find((s) => s.slotId === slotId)
    if (!slot) throw { statusCode: 404, message: 'Turno não encontrado' }

    const since = brtDateStr(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
    const runs = await this.prisma.courierRun.findMany({
      where: { courierId, slotId, reordered: true, date: { gte: since } },
      orderBy: { date: 'desc' },
      take: 10,
    })
    const savedIds = template?.acceptedAt ? template.condominiumIds : []
    const defaultIds = (await getDefaultRoute(this.prisma))?.condominiumIds ?? null
    const followsDefault = !!defaultIds && !template?.acceptedAt
    // Quem segue a padrão não tem sugestão (uma 1ª sugestão antiga fica ignorada).
    const suggestion = followsDefault ? null : readSuggestion(template?.suggestion)
    // A padrão com os prédios deste entregador/turno (os dos últimos 30 dias + os da rota própria).
    const defaultIdsHere = defaultIds ? dayOrderFrom([...new Set([...(await this.recentCondos(courierId, slotId, now)), ...savedIds])], defaultIds, null) : []
    const ids = [...new Set([...savedIds, ...(suggestion?.condominiumIds ?? []), ...runs.flatMap((r) => r.condominiumIds), ...defaultIdsHere])]
    const condos = ids.length
      ? await this.prisma.condominium.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, lat: true, lng: true } })
      : []
    const known = condos.map((c) => ({ id: c.id, name: c.name, lat: c.lat ?? null, lng: c.lng ?? null }))
    const names = new Map(condos.map((c) => [c.id, c.name]))

    const savedMetrics = savedIds.length ? await metricsForOrder(this.prisma, savedIds, known, cfg) : null
    const sugMetrics = suggestion ? await metricsForOrder(this.prisma, suggestion.condominiumIds, known, cfg) : null
    const defMetrics = defaultIdsHere.length ? await metricsForOrder(this.prisma, defaultIdsHere, known, cfg) : null
    const savedKm = template?.km ?? savedMetrics?.km ?? null
    const sugKm = suggestion?.km ?? sugMetrics?.km ?? null

    return {
      courier: { id: courier.id, name: courier.name },
      slot: { slotId, label: slot.label, emoji: slot.emoji ?? '', time: slot.time },
      base: cfg.base,
      condos: known,
      saved: template?.acceptedAt
        ? {
            condominiumIds: savedIds,
            km: savedKm,
            durationMin: template.durationMin ?? savedMetrics?.durationMin ?? null,
            geometry: savedMetrics?.geometry ?? [],
            acceptedAt: template.acceptedAt.toISOString(),
          }
        : null,
      suggestion: suggestion
        ? {
            condominiumIds: suggestion.condominiumIds,
            km: sugKm,
            durationMin: suggestion.durationMin ?? sugMetrics?.durationMin ?? null,
            geometry: sugMetrics?.geometry ?? [],
            reason: suggestion.reason,
            newIds: suggestion.newIds,
            createdAt: suggestion.createdAt,
            deltaKm: savedKm !== null && sugKm !== null ? Math.round((sugKm - savedKm) * 10) / 10 : null,
          }
        : null,
      followsDefault,
      defaultOrder: defaultIds
        ? { condominiumIds: defaultIdsHere, km: defMetrics?.km ?? null, durationMin: defMetrics?.durationMin ?? null, geometry: defMetrics?.geometry ?? [] }
        : null,
      changes: runs.map((r) => ({
        runId: r.id,
        date: r.date,
        condominiumIds: r.condominiumIds,
        km: r.plannedKm ?? null,
        description: describeChange(followsDefault ? defaultIdsHere : savedIds, r.condominiumIds, names),
      })),
    }
  }

  async accept(courierId: string, slotId: string, adminId: string) {
    await acceptSuggestion(this.prisma, courierId, slotId, adminId)
    return this.getRoute(courierId, slotId)
  }

  async keep(courierId: string, slotId: string, adminId: string) {
    await keepCurrent(this.prisma, courierId, slotId, adminId)
    return this.getRoute(courierId, slotId)
  }

  async save(courierId: string, slotId: string, ids: string[], adminId: string) {
    await saveOrder(this.prisma, courierId, slotId, ids, adminId)
    return this.getRoute(courierId, slotId)
  }

  async adopt(courierId: string, slotId: string, runId: string, adminId: string) {
    await adoptRun(this.prisma, courierId, slotId, runId, adminId)
    return this.getRoute(courierId, slotId)
  }

  /** "Voltar à rota padrão": a rota própria sai e o turno segue a padrão. @throws 400 sem padrão */
  async reset(courierId: string, slotId: string) {
    await resetToDefault(this.prisma, courierId, slotId)
    return this.getRoute(courierId, slotId)
  }

  /** Prédios que o entregador atendeu no turno: dos últimos 30 dias até amanhã. */
  private async recentCondos(courierId: string, slotId: string, now: Date): Promise<string[]> {
    const where = {
      courierId,
      slotId,
      scheduledDate: { gte: brtDayRange(new Date(now.getTime() - 30 * DAY_MS)).start, lte: brtDayRange(new Date(now.getTime() + DAY_MS)).end },
    }
    const [orders, markets] = await Promise.all([
      this.prisma.order.findMany({ where, select: { condominiumId: true } }),
      this.prisma.marketOrder.findMany({ where, select: { condominiumId: true } }),
    ])
    return [...new Set([...orders, ...markets].map((o) => o.condominiumId).filter((id): id is string => !!id))]
  }

  // ── Rota padrão ────────────────────────────────────────────────────────────

  defaultRoute() {
    return defaultRouteView(this.fastify)
  }

  suggestDefault() {
    return suggestDefaultRoute(this.prisma)
  }

  async saveDefault(ids: string[], adminId: string) {
    await saveDefaultRoute(this.fastify, ids, adminId)
    return defaultRouteView(this.fastify)
  }

  async reviewDefault() {
    await reviewDefaultRoute(this.prisma)
    return defaultRouteView(this.fastify)
  }

  /** "Ajustar": km/tempo da ordem arrastada (recalcula ao soltar). */
  async preview(ids: string[]) {
    const m = await metricsForOrder(this.prisma, ids)
    return { km: m.km, durationMin: m.durationMin, geometry: m.geometry }
  }

  /**
   * A2: rotas de hoje com estado, progresso, última posição, término previsto, "sem foto" e "ordem
   * alterada"; as paradas (para os filtros Todas · Pendentes · Sem foto) e os prédios do mapa.
   */
  async live(now: Date = new Date()) {
    const date = brtDateStr(now)
    const { start, end } = brtDayRange(now)
    const statuses = ['OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED'] as const
    const [orders, markets, runs, proofs, slots, cfg, hooksPending, hooksDone] = await Promise.all([
      this.prisma.order.findMany({
        where: { courierId: { not: null }, scheduledDate: { gte: start, lte: end }, status: { in: [...statuses] } },
        select: { userId: true, courierId: true, slotId: true, status: true, condominiumId: true, deliveredAt: true, failedAt: true, failureCode: true },
      }),
      this.prisma.marketOrder.findMany({
        where: { courierId: { not: null }, scheduledDate: { gte: start, lte: end }, status: { in: [...statuses] } },
        select: { userId: true, courierId: true, slotId: true, status: true, condominiumId: true, deliveredAt: true, failedAt: true, failureCode: true },
      }),
      this.prisma.courierRun.findMany({ where: { date } }),
      this.prisma.deliveryProof.findMany({ where: { date }, select: { courierId: true, userId: true, slotId: true, outcome: true, status: true, required: true, note: true } }),
      getGlobalDeliverySlots(this.prisma),
      getRouteConfig(this.prisma),
      pendingHookOnlyStops(this.prisma, { date }),
      resolvedHookOnlyStops(this.prisma, null, date, date),
    ])

    type Stop = {
      key: string
      courierId: string
      slotId: string
      userId: string
      condominiumId: string | null
      statuses: string[]
      at: Date | null
      failureCode: string | null
    }
    const stops = new Map<string, Stop>()
    for (const o of [...orders, ...markets]) {
      if (!o.courierId) continue
      const slotId = o.slotId ?? ''
      const key = `${o.courierId}|${o.userId}|${slotId}`
      const s = stops.get(key) ?? { key, courierId: o.courierId, slotId, userId: o.userId, condominiumId: o.condominiumId ?? null, statuses: [], at: null, failureCode: null }
      s.statuses.push(o.status)
      const at = o.deliveredAt ?? o.failedAt ?? null
      if (at && (!s.at || at > s.at)) s.at = at
      s.failureCode ??= o.failureCode ?? null
      s.condominiumId ??= o.condominiumId ?? null
      stops.set(key, s)
    }
    // Paradas só de gancho (plano-gancho-sozinho-na-rota): a pendente vence a já resolvida; cliente
    // com parada de pão no turno não ganha uma segunda.
    const breadKeys = new Set(stops.keys())
    const hookStops = [
      ...hooksDone.map((h) => ({ ...h, status: h.outcome as string, at: h.at as Date | null })),
      ...hooksPending.map((h) => ({ ...h, condominiumId: null as string | null, status: 'OUT_FOR_DELIVERY', at: null as Date | null })),
    ]
    for (const h of hookStops) {
      const key = `${h.courierId}|${h.userId}|${h.slotId}`
      if (breadKeys.has(key)) continue
      stops.set(key, { key, courierId: h.courierId, slotId: h.slotId, userId: h.userId, condominiumId: h.condominiumId, statuses: [h.status], at: h.at, failureCode: null })
    }
    const userIds = [...new Set([...stops.values()].map((s) => s.userId))]
    const courierIds = [...new Set([...stops.values()].map((s) => s.courierId))]
    const [users, couriers] = await Promise.all([
      userIds.length ? this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, apartment: true, block: true, condominiumId: true } }) : [],
      courierIds.length ? this.prisma.user.findMany({ where: { id: { in: courierIds } }, select: { id: true, name: true } }) : [],
    ])
    const userById = new Map(users.map((u) => [u.id, u]))
    const courierName = new Map(couriers.map((c) => [c.id, c.name]))
    const condoIds = [...new Set([...stops.values()].map((s) => userById.get(s.userId)?.condominiumId ?? s.condominiumId).filter((x): x is string => !!x))]
    const condos = condoIds.length
      ? await this.prisma.condominium.findMany({ where: { id: { in: condoIds } }, select: { id: true, name: true, lat: true, lng: true } })
      : []
    const condoById = new Map(condos.map((c) => [c.id, c]))
    const proofOf = new Map(proofs.map((p) => [`${p.courierId}|${p.userId}|${p.slotId}|${p.outcome}`, p]))

    const stopRows = [...stops.values()].map((s) => {
      const u = userById.get(s.userId)
      const condoId = u?.condominiumId ?? s.condominiumId
      const pending = s.statuses.includes('OUT_FOR_DELIVERY')
      const outcome = s.statuses.includes('DELIVERED') ? 'DELIVERED' : 'NOT_DELIVERED'
      const proof = pending ? undefined : proofOf.get(`${s.courierId}|${s.userId}|${s.slotId}|${outcome}`)
      const proofState = !proof ? null : proof.status === 'OK' ? 'ok' : proof.status === 'NONE' ? 'sem' : proof.status === 'SKIPPED' ? 'pulada' : 'pendente'
      const noPhoto = !!proof && (proof.status === 'NONE' || (proof.status === 'PENDING' && proof.required))
      return {
        key: s.key,
        courierId: s.courierId,
        slotId: s.slotId,
        condominiumId: condoId ?? null,
        condominiumName: (condoId && condoById.get(condoId)?.name) || 'Condomínio',
        clientName: u?.name ?? 'Cliente',
        apartment: u?.apartment ?? '',
        block: u?.block ?? null,
        status: pending ? 'pendente' : outcome === 'DELIVERED' ? 'entregue' : 'nao_entregue',
        time: pending ? null : hhmm(s.at),
        failureLabel: !pending && outcome === 'NOT_DELIVERED' && isFailureCode(s.failureCode) ? FAILURE_LABELS[s.failureCode] : null,
        proof: proofState,
        noPhoto,
        noPhotoNote: proof?.status === 'NONE' ? proof.note ?? null : null,
      }
    })

    const groups = new Map<string, typeof stopRows>()
    for (const r of stopRows) {
      const k = `${r.courierId}|${r.slotId}`
      groups.set(k, [...(groups.get(k) ?? []), r])
    }
    const runByKey = new Map(runs.map((r) => [`${r.courierId}|${r.slotId}`, r]))
    const routeRows = [...groups.entries()].map(([k, list]) => {
      const [courierId, slotId] = k.split('|')
      const run = runByKey.get(k)
      const slot = slots.find((s) => s.slotId === slotId)
      const done = list.filter((r) => r.status !== 'pendente').length
      const pendingDoors = list.length - done
      const state = run?.status === 'STARTED' ? 'em_rota' : run?.status === 'ENDED' ? 'encerrada' : 'pronta'
      let etaEnd: string | null = null
      if (state === 'em_rota' && run?.startedAt) {
        const planned = (run.plannedMin ?? 0) * 60_000 + list.length * cfg.minPorPorta * 60_000
        etaEnd = hhmm(new Date(Math.max(run.startedAt.getTime() + planned, now.getTime() + pendingDoors * cfg.minPorPorta * 60_000)))
      }
      const lastPos =
        run?.lastLat != null && run?.lastLng != null && run.lastPosAt
          ? { lat: run.lastLat, lng: run.lastLng, at: run.lastPosAt.toISOString(), stale: now.getTime() - run.lastPosAt.getTime() > STALE_POSITION_MS }
          : null
      return {
        courierId,
        courierName: courierName.get(courierId) ?? 'Entregador',
        slotId,
        slotLabel: slot?.label ?? slotId,
        slotEmoji: slot?.emoji ?? '',
        state,
        startedAt: run?.startedAt?.toISOString() ?? null,
        endedAt: run?.endedAt?.toISOString() ?? null,
        etaEnd,
        done,
        total: list.length,
        noPhoto: list.filter((r) => r.noPhoto).length,
        reordered: run?.reordered ?? false,
        lastPos: state === 'em_rota' ? lastPos : null,
      }
    })
    routeRows.sort((a, b) => (slots.find((s) => s.slotId === a.slotId)?.time ?? '').localeCompare(slots.find((s) => s.slotId === b.slotId)?.time ?? '') || a.courierName.localeCompare(b.courierName, 'pt-BR'))

    const condoRows = condos.map((c) => {
      const here = stopRows.filter((r) => r.condominiumId === c.id)
      return { id: c.id, name: c.name, lat: c.lat ?? null, lng: c.lng ?? null, done: here.length > 0 && here.every((r) => r.status !== 'pendente') }
    })

    return { date, base: cfg.base, routes: routeRows, stops: stopRows, condos: condoRows }
  }
}
