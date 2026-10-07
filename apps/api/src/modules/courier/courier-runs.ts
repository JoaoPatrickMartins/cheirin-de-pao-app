import type { FastifyInstance } from 'fastify'
import type { CourierRun } from '@prisma/client'
import { NotificationType } from '@prisma/client'
import { estimateFuel, fuelPriceFor, vehicleUsesFuel } from '@cheirin-de-pao/shared'
import { brtDateStr, brtDayRange } from '../../lib/cutoff.js'
import { getRouteConfig } from '../../lib/route-config.js'
import { getGlobalDeliverySlots } from '../../lib/delivery-slots.js'
import { resolveCourierRules } from '../../lib/courier-profile.js'
import { RUN_POSITION_CLEARED } from '../../lib/courier-position-cleanup.js'
import { pendingHookOnlyStops, resolvedHookOnlyStops } from '../../lib/hook-stops.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import { metricsForOrder, resolveDayRoute, type PlanCondo } from './courier-plan.js'

/**
 * A rota de um turno no dia (`CourierRun`, E8–E10 do plano do entregador).
 *
 * - Iniciar (base ou GPS) avisa cada cliente do turno: "Saiu para entrega" (H-1), uma vez só.
 * - A primeira confirmação de um turno não iniciado inicia a rota sozinha (modo `AUTO`) — o cliente
 *   não fica sem o "a caminho" porque o entregador esqueceu o botão.
 * - Posição: só a última, só com a rota iniciada (T-9).
 * - Reordenar vale só no dia e só com `podeReordenar` (D-5b).
 * - Encerrar exige todas as paradas com desfecho e nenhuma foto obrigatória pendente.
 */

export interface SlotStop {
  key: string
  /** Id que endereça a parada nas rotas do entregador (o pão; sem pão, a 1ª Cestinha; só gancho, o gancho). */
  refId: string
  userId: string
  condominiumId: string
  condominiumName: string
  clientName: string
  apartment: string
  block: string | null
  complement: string | null
  status: 'PENDING' | 'DELIVERED' | 'NOT_DELIVERED'
  breads: number
  marketCount: number
  /** Parada só de gancho (sem pão nem Cestinha): não recebe o "Saiu para entrega" nem mexe na rota salva. */
  hookOnly: boolean
}

export interface RunSummary {
  slotId: string
  label: string
  emoji: string
  time: string
  run: { id: string; status: string; startedAt: string | null; endedAt: string | null } | null
  pending: {
    stops: Array<Pick<SlotStop, 'key' | 'refId' | 'condominiumName' | 'clientName' | 'apartment' | 'block'>>
    noPhoto: Array<Pick<SlotStop, 'key' | 'refId' | 'condominiumName' | 'clientName' | 'apartment' | 'block'> & { outcome: string }>
  }
  stats: { delivered: number; notDelivered: number; breads: number; cestinhas: number; ganchos: number; durationMin: number | null }
  km: number | null
  voltaBase: boolean
  fuel: { litros: number; custo: number; kmPorLitro: number; preco: number; combustivel: string } | null
  /** Por que não há combustível: sem consumo cadastrado (ou veículo sem combustível) ou sem preço. */
  fuelReason: 'SEM_CONSUMO' | 'SEM_PRECO' | 'SEM_KM' | null
  /** O admin deixa o entregador ver km e combustível no Fim da rota (A5 · H-6). Padrão: não. */
  fuelVisible: boolean
  /**
   * Combustível do veículo (GASOLINA · ETANOL · FLEX · GNV), mesmo sem cálculo. Fica no `summary` da
   * rota encerrada para o A9 separar litros de m³ (Onda 11 · T-37). Não está no JSON schema da
   * resposta ao entregador — o fast-json-stringify descarta.
   */
  vehicleFuel: string | null
  next: { slotId: string; label: string; emoji: string; time: string; stops: number } | null
}

/**
 * O resumo como sai para o entregador (T-20): sem o switch "Fim da rota", km e combustível não vão
 * ao aparelho. O serviço continua calculando — o encerramento congela o combustível na rota (A9).
 */
export function courierRunSummary(s: RunSummary): RunSummary {
  return s.fuelVisible ? s : { ...s, km: null, fuel: null, fuelReason: null }
}

const runView = (r: CourierRun | null) =>
  r ? { id: r.id, status: r.status, startedAt: r.startedAt?.toISOString() ?? null, endedAt: r.endedAt?.toISOString() ?? null } : null

export class CourierRunService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Paradas do entregador num turno hoje (pão + Cestinha do mesmo cliente = 1 parada), mais as
   * paradas só de gancho, pendentes e resolvidas.
   */
  async slotStops(courierId: string, slotId: string, now: Date = new Date()): Promise<SlotStop[]> {
    const { start, end } = brtDayRange(now)
    const date = brtDateStr(now)
    const active = ['OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED'] as const
    const [orders, markets, hooksPending, hooksDone] = await Promise.all([
      this.prisma.order.findMany({
        where: { courierId, slotId, scheduledDate: { gte: start, lte: end }, status: { in: [...active] } },
        select: { id: true, userId: true, quantity: true, status: true, condominiumId: true },
      }),
      this.prisma.marketOrder.findMany({
        where: { courierId, slotId, scheduledDate: { gte: start, lte: end }, status: { in: [...active] } },
        select: { id: true, userId: true, breadQty: true, status: true, condominiumId: true },
      }),
      pendingHookOnlyStops(this.prisma, { courierIds: [courierId], date, slotId }),
      resolvedHookOnlyStops(this.prisma, [courierId], date, date, slotId),
    ])
    type Agg = {
      condo: string | null
      breads: number
      marketCount: number
      statuses: string[]
      hasBread: boolean
      breadStatus?: string
      orderId?: string
      marketId?: string
      hookId?: string
    }
    const byUser = new Map<string, Agg>()
    for (const o of orders) {
      const s: Agg = byUser.get(o.userId) ?? { condo: o.condominiumId ?? null, breads: 0, marketCount: 0, statuses: [], hasBread: false }
      s.orderId ??= o.id
      s.breads += o.quantity
      s.statuses.push(o.status)
      s.hasBread = true
      s.breadStatus = o.status
      s.condo ??= o.condominiumId ?? null
      byUser.set(o.userId, s)
    }
    for (const m of markets) {
      const s: Agg = byUser.get(m.userId) ?? { condo: m.condominiumId, breads: 0, marketCount: 0, statuses: [], hasBread: false }
      s.marketId ??= m.id
      s.breads += m.breadQty
      s.marketCount += 1
      s.statuses.push(m.status)
      s.condo ??= m.condominiumId
      byUser.set(m.userId, s)
    }
    // Só de gancho: a pendente vence a já resolvida (o gancho que não foi entregue e voltou na mesma
    // rota). Cliente que já tem parada de pão no turno não vira uma segunda parada.
    const breadUsers = new Set(byUser.keys())
    const hookStops = [
      ...hooksDone.map((h) => ({ userId: h.userId, hookId: h.hookId, condo: h.condominiumId, status: h.outcome as string })),
      ...hooksPending.map((h) => ({ userId: h.userId, hookId: h.hookId, condo: null, status: 'OUT_FOR_DELIVERY' })),
    ]
    for (const h of hookStops) {
      if (breadUsers.has(h.userId)) continue
      byUser.set(h.userId, { condo: h.condo, breads: 0, marketCount: 0, statuses: [h.status], hasBread: false, hookId: h.hookId })
    }
    if (byUser.size === 0) return []
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...byUser.keys()] } },
      select: { id: true, name: true, apartment: true, block: true, complement: true, condominiumId: true },
    })
    const userById = new Map(users.map((u) => [u.id, u]))
    const condoIds = [...new Set([...byUser.entries()].map(([id, s]) => userById.get(id)?.condominiumId ?? s.condo).filter((x): x is string => !!x))]
    const condos = condoIds.length ? await this.prisma.condominium.findMany({ where: { id: { in: condoIds } }, select: { id: true, name: true } }) : []
    const condoName = new Map(condos.map((c) => [c.id, c.name]))
    return [...byUser.entries()].map(([userId, s]) => {
      const u = userById.get(userId)
      const condominiumId = u?.condominiumId ?? s.condo ?? 'unknown'
      const pending = s.statuses.some((st) => st === 'OUT_FOR_DELIVERY')
      const outcome = (s.breadStatus ?? s.statuses[0]) === 'DELIVERED' ? 'DELIVERED' : 'NOT_DELIVERED'
      return {
        key: `${userId}|${slotId}`,
        refId: s.orderId ?? s.marketId ?? s.hookId ?? '',
        userId,
        condominiumId,
        condominiumName: condoName.get(condominiumId) ?? 'Condomínio',
        clientName: u?.name ?? 'Cliente',
        apartment: u?.apartment ?? '',
        block: u?.block ?? null,
        complement: u?.complement ?? null,
        status: pending ? 'PENDING' : outcome,
        breads: s.breads,
        marketCount: s.marketCount,
        hookOnly: !!s.hookId,
      }
    })
  }

  private async planCondos(stops: SlotStop[]): Promise<PlanCondo[]> {
    const ids = [...new Set(stops.map((s) => s.condominiumId))].filter((id) => id !== 'unknown')
    const rows = ids.length ? await this.prisma.condominium.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, lat: true, lng: true } }) : []
    return rows.map((r) => ({ id: r.id, name: r.name, lat: r.lat ?? null, lng: r.lng ?? null }))
  }

  /** Prédios do turno para a rota do dia + os que contam para a rota salva (sem os só de gancho). */
  private async dayCondos(stops: SlotStop[]): Promise<{ condos: PlanCondo[]; suggestFrom: PlanCondo[] }> {
    const condos = await this.planCondos(stops)
    const withBread = new Set(stops.filter((s) => !s.hookOnly).map((s) => s.condominiumId))
    return { condos, suggestFrom: condos.filter((c) => withBread.has(c.id)) }
  }

  private async slotMeta(slotId: string) {
    const slots = await getGlobalDeliverySlots(this.prisma)
    const s = slots.find((x) => x.slotId === slotId)
    return { slots, label: s?.label ?? slotId, emoji: s?.emoji ?? '', time: s?.time ?? '' }
  }

  private findRun(courierId: string, date: string, slotId: string) {
    return this.prisma.courierRun.findUnique({ where: { courierId_date_slotId: { courierId, date, slotId } } })
  }

  /**
   * Inicia a rota do turno. Já iniciada → devolve a mesma (o aviso não sai de novo).
   * @throws 404 sem entregas no turno · 409 rota já encerrada
   */
  async start(
    courierId: string,
    input: { slotId: string; startMode: 'BASE' | 'GPS' | 'AUTO'; lat?: number; lng?: number },
    now: Date = new Date(),
  ): Promise<{ run: CourierRun; notified: number }> {
    const date = brtDateStr(now)
    const existing = await this.findRun(courierId, date, input.slotId)
    if (existing?.status === 'STARTED') return { run: existing, notified: 0 }
    if (existing?.status === 'ENDED') throw { statusCode: 409, message: 'Essa rota já foi encerrada' }
    const stops = await this.slotStops(courierId, input.slotId, now)
    if (stops.length === 0) throw { statusCode: 404, message: 'Sem entregas neste turno hoje' }

    const meta = await this.slotMeta(input.slotId)
    const day = await resolveDayRoute(this.fastify, { courierId, slotId: input.slotId, date, ...(await this.dayCondos(stops)), slotLabel: meta.label })
    const gps = input.startMode === 'GPS' && Number.isFinite(input.lat) && Number.isFinite(input.lng)
    const data = {
      status: 'STARTED',
      startedAt: now,
      startMode: gps ? 'GPS' : input.startMode === 'AUTO' ? 'AUTO' : 'BASE',
      startLat: gps ? input.lat! : null,
      startLng: gps ? input.lng! : null,
      condominiumIds: day.order,
      plannedKm: day.metrics.km,
      plannedMin: day.metrics.durationMin,
      ...(gps ? { lastLat: input.lat!, lastLng: input.lng!, lastPosAt: now } : {}),
    }
    const run = await this.prisma.courierRun.upsert({
      where: { courierId_date_slotId: { courierId, date, slotId: input.slotId } },
      create: { courierId, date, slotId: input.slotId, ...data },
      update: data,
    })
    // Só de gancho não recebe "Saiu para entrega": o texto fala de pão e Cestinha (D-11).
    const notified = await this.notifyOut(courierId, stops.filter((s) => s.status === 'PENDING' && !s.hookOnly))
    // Iniciar a rota é aceitar o turno (plano-termos-legais §5): some o "Recusar".
    try {
      await this.prisma.courierShiftOffer.updateMany({ where: { courierId, date, slotId: input.slotId, status: 'OFFERED' }, data: { status: 'ACCEPTED', respondedAt: now, via: 'START' } })
    } catch (err) {
      this.fastify.log.warn({ err, courierId }, '[courier-runs] falha ao marcar o turno como aceito — ignorado')
    }
    return { run, notified }
  }

  /** "Saiu para entrega" para cada cliente com parada pendente no turno (H-1). Best-effort. */
  private async notifyOut(courierId: string, stops: SlotStop[]): Promise<number> {
    const courier = await this.prisma.user.findUnique({ where: { id: courierId }, select: { name: true } })
    const firstName = courier?.name?.trim().split(/\s+/)[0] || 'Seu entregador'
    const notifications = new NotificationsService(this.fastify)
    let sent = 0
    for (const s of stops) {
      const what = s.breads > 0 ? `com ${s.breads === 1 ? 'seu pãozinho' : `seus ${s.breads} pãezinhos`}` : 'com a sua Cestinha'
      try {
        await notifications.notifyUser(s.userId, {
          type: NotificationType.DELIVERY_OUT,
          title: 'Saiu para entrega',
          body: `${firstName} está a caminho ${what}.`,
          actionRoute: '/client/pedidos',
        })
        sent += 1
      } catch (err) {
        this.fastify.log.warn({ err, userId: s.userId }, '[courier-runs] falha no aviso "saiu para entrega" — ignorado')
      }
    }
    return sent
  }

  /** Primeira confirmação de um turno não iniciado: inicia sozinha. Nunca lança. */
  async ensureStarted(courierId: string, slotId: string | null | undefined, now: Date = new Date()): Promise<void> {
    if (!slotId) return
    try {
      const run = await this.findRun(courierId, brtDateStr(now), slotId)
      if (run?.status === 'STARTED' || run?.status === 'ENDED') return
      await this.start(courierId, { slotId, startMode: 'AUTO' }, now)
    } catch (err) {
      this.fastify.log.warn({ err, courierId, slotId }, '[courier-runs] falha ao iniciar a rota sozinha — ignorado')
    }
  }

  /** Última posição (T-9). @throws 404 rota de outro/inexistente · 409 rota não iniciada */
  async position(courierId: string, runId: string, pos: { lat: number; lng: number }, now: Date = new Date()): Promise<void> {
    const run = await this.prisma.courierRun.findUnique({ where: { id: runId } })
    if (!run || run.courierId !== courierId) throw { statusCode: 404, message: 'Rota não encontrada' }
    if (run.status !== 'STARTED') throw { statusCode: 409, message: 'A posição só é compartilhada com a rota iniciada' }
    await this.prisma.courierRun.update({ where: { id: runId }, data: { lastLat: pos.lat, lastLng: pos.lng, lastPosAt: now } })
  }

  /**
   * Ordem do dia escolhida pelo entregador (D-5b). Prédios que faltarem entram no fim.
   * @throws 403 sem permissão · 400 prédio fora da rota · 409 rota encerrada
   */
  async reorder(courierId: string, input: { slotId: string; condominiumIds: string[] }, now: Date = new Date()): Promise<CourierRun> {
    const courier = await this.prisma.user.findUnique({ where: { id: courierId }, select: { courierRules: true } })
    if (!resolveCourierRules(courier?.courierRules).podeReordenar) throw { statusCode: 403, message: 'A operação não liberou reordenar a sua rota' }
    const date = brtDateStr(now)
    const existing = await this.findRun(courierId, date, input.slotId)
    if (existing?.status === 'ENDED') throw { statusCode: 409, message: 'Essa rota já foi encerrada' }
    const condos = [...new Set((await this.slotStops(courierId, input.slotId, now)).map((s) => s.condominiumId))]
    const ids = [...new Set(input.condominiumIds)]
    if (ids.some((id) => !condos.includes(id))) throw { statusCode: 400, message: 'Um dos prédios não é desta rota' }
    const order = [...ids, ...condos.filter((id) => !ids.includes(id))]
    const m = await metricsForOrder(this.prisma, order)
    const data = { condominiumIds: order, reordered: true, plannedKm: m.km, plannedMin: m.durationMin }
    return this.prisma.courierRun.upsert({
      where: { courierId_date_slotId: { courierId, date, slotId: input.slotId } },
      create: { courierId, date, slotId: input.slotId, status: 'PLANNED', ...data },
      update: data,
    })
  }

  /** "Voltar à rota padrão". */
  async resetOrder(courierId: string, slotId: string, now: Date = new Date()): Promise<CourierRun | null> {
    const date = brtDateStr(now)
    const run = await this.findRun(courierId, date, slotId)
    if (!run) return null
    if (run.status === 'ENDED') throw { statusCode: 409, message: 'Essa rota já foi encerrada' }
    const stops = await this.slotStops(courierId, slotId, now)
    const day = await resolveDayRoute(this.fastify, { courierId, slotId, date, ...(await this.dayCondos(stops)), ignoreRun: true })
    return this.prisma.courierRun.update({
      where: { id: run.id },
      data: { condominiumIds: day.order, reordered: false, plannedKm: day.metrics.km, plannedMin: day.metrics.durationMin },
    })
  }

  /** E10: pendências + resumo + km/combustível estimados. */
  async summary(courierId: string, slotId: string, now: Date = new Date()): Promise<RunSummary> {
    const date = brtDateStr(now)
    const [stops, run, meta, cfg, courier, proofs, ganchos] = await Promise.all([
      this.slotStops(courierId, slotId, now),
      this.findRun(courierId, date, slotId),
      this.slotMeta(slotId),
      getRouteConfig(this.prisma),
      this.prisma.user.findUnique({ where: { id: courierId }, select: { courierVehicle: true } }),
      this.prisma.deliveryProof.findMany({ where: { courierId, date, slotId, status: 'PENDING', required: true }, select: { userId: true, outcome: true } }),
      // Ganchos que este entregador deixou no turno — junto com o pão ou sozinhos.
      this.prisma.hookRequest.count({ where: { status: 'DELIVERED', deliveredVia: 'COURIER', deliveredById: courierId, routeDate: date, routeSlotId: slotId } }),
    ])
    const pick = (s: SlotStop) => ({ key: s.key, refId: s.refId, condominiumName: s.condominiumName, clientName: s.clientName, apartment: s.apartment, block: s.block })
    const byUser = new Map(stops.map((s) => [s.userId, s]))
    const pendingStops = stops.filter((s) => s.status === 'PENDING')
    const noPhoto = proofs.flatMap((p) => {
      const s = byUser.get(p.userId)
      return s && s.status !== 'PENDING' ? [{ ...pick(s), outcome: p.outcome }] : []
    })
    const delivered = stops.filter((s) => s.status === 'DELIVERED')

    let km = run?.plannedKm ?? null
    if (km === null && stops.length > 0) {
      const day = await resolveDayRoute(this.fastify, { courierId, slotId, date, ...(await this.dayCondos(stops)), config: cfg })
      km = day.metrics.km
    }
    const vehicle = (courier?.courierVehicle ?? null) as { tipo?: string; combustivel?: string; kmPorLitro?: number } | null
    const price = fuelPriceFor(vehicle?.combustivel, { gasolina: cfg.precoGasolina, etanol: cfg.precoEtanol, gnv: cfg.precoGnv })
    const consumption = vehicleUsesFuel(vehicle?.tipo) ? vehicle?.kmPorLitro ?? null : null
    const est = km !== null ? estimateFuel(km, consumption, price) : null
    const fuelReason: RunSummary['fuelReason'] = est ? null : km === null ? 'SEM_KM' : !consumption ? 'SEM_CONSUMO' : 'SEM_PRECO'

    const startedAt = run?.startedAt ?? null
    const endAt = run?.endedAt ?? now
    const later = meta.slots
      .filter((s) => s.slotId !== slotId && s.time > meta.time)
      .sort((a, b) => a.time.localeCompare(b.time))
    let next: RunSummary['next'] = null
    for (const s of later) {
      const n = (await this.slotStops(courierId, s.slotId, now)).filter((x) => x.status === 'PENDING').length
      if (n > 0) {
        next = { slotId: s.slotId, label: s.label, emoji: s.emoji ?? '', time: s.time, stops: n }
        break
      }
    }

    return {
      slotId,
      label: meta.label,
      emoji: meta.emoji,
      time: meta.time,
      run: runView(run),
      pending: { stops: pendingStops.map(pick), noPhoto },
      stats: {
        delivered: delivered.length,
        notDelivered: stops.filter((s) => s.status === 'NOT_DELIVERED').length,
        breads: delivered.reduce((n, s) => n + s.breads, 0),
        cestinhas: delivered.reduce((n, s) => n + s.marketCount, 0),
        ganchos,
        durationMin: startedAt ? Math.max(0, Math.round((endAt.getTime() - startedAt.getTime()) / 60_000)) : null,
      },
      km,
      voltaBase: cfg.voltaBase,
      fuel: est && consumption && price ? { ...est, kmPorLitro: consumption, preco: price, combustivel: vehicle?.combustivel ?? 'GASOLINA' } : null,
      fuelReason,
      fuelVisible: cfg.entregadorVeCombFimRota,
      vehicleFuel: vehicleUsesFuel(vehicle?.tipo) ? vehicle?.combustivel ?? null : null,
      next,
    }
  }

  /**
   * Encerra a rota. Pendências → 422 com a lista. Já encerrada → devolve a mesma. Apaga a última
   * posição e o ponto de partida por GPS (a localização vale só durante a rota — texto legal).
   * @throws 404 · 409 rota não iniciada · 422 pendências
   */
  async end(courierId: string, runId: string, now: Date = new Date()): Promise<{ run: CourierRun; summary: RunSummary }> {
    const run = await this.prisma.courierRun.findUnique({ where: { id: runId } })
    if (!run || run.courierId !== courierId) throw { statusCode: 404, message: 'Rota não encontrada' }
    const summary = await this.summary(courierId, run.slotId, now)
    if (run.status === 'ENDED') return { run, summary }
    if (run.status !== 'STARTED') throw { statusCode: 409, message: 'A rota ainda não começou' }
    if (summary.pending.stops.length > 0 || summary.pending.noPhoto.length > 0) {
      throw { statusCode: 422, message: 'Resolva as pendências antes de encerrar', pending: summary.pending }
    }
    const ended = await this.prisma.courierRun.update({
      where: { id: run.id },
      data: {
        status: 'ENDED',
        endedAt: now,
        ...RUN_POSITION_CLEARED,
        kmPerLiter: summary.fuel?.kmPorLitro ?? null,
        fuelPrice: summary.fuel?.preco ?? null,
        fuelEstimate: summary.fuel?.custo ?? null,
        plannedKm: summary.km,
        summary: {
          entregues: summary.stats.delivered,
          naoEntregues: summary.stats.notDelivered,
          paes: summary.stats.breads,
          cestinhas: summary.stats.cestinhas,
          ganchos: summary.stats.ganchos,
          combustivel: summary.vehicleFuel,
        },
      },
    })
    return { run: ended, summary: { ...summary, run: runView(ended), stats: { ...summary.stats, durationMin: ended.startedAt ? Math.round((now.getTime() - ended.startedAt.getTime()) / 60_000) : null } } }
  }
}
