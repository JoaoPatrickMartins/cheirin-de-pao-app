import type { FastifyInstance } from 'fastify'
import { randomBytes } from 'node:crypto'
import { LEGAL_DOCS, badgeNumberLabel, badgeStatus, maskCpf, offReasonFor, weekdayOf, WEEKDAYS, type OffReason } from '@cheirin-de-pao/shared'
import { brtDateStr, brtDayRange } from '../../lib/cutoff.js'
import { getGlobalDeliverySlots } from '../../lib/delivery-slots.js'
import { resolveCourierRules } from '../../lib/courier-profile.js'
import { validityToDay } from '../../lib/courier-badge.js'
import { resolvedCourierStops, type ResolvedStop } from '../../lib/courier-stops.js'
import { getRouteConfig } from '../../lib/route-config.js'

/**
 * O próprio entregador (Onda 6 do plano): perfil e crachá (E14/E15), meus números (E17) e a escala
 * (E18). Tudo SÓ LEITURA — quem define é o admin (F-1, F-8).
 */

const DAY_MS = 24 * 60 * 60 * 1000
const addDays = (day: string, n: number) => new Date(new Date(`${day}T15:00:00.000Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10)

const WEEKDAY_SHORT: Record<string, string> = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom' }

/** "Seg a sáb" · "Todos os dias" · "Seg, qua e sex". */
export function scheduleLabel(dias: string[] | null | undefined): string {
  if (!dias) return 'Todos os dias'
  const order = WEEKDAYS.filter((d) => dias.includes(d))
  if (order.length === 7) return 'Todos os dias'
  if (order.length === 0) return 'Sem dias definidos'
  const idx = order.map((d) => WEEKDAYS.indexOf(d))
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  if (consecutive && order.length >= 3) return `${WEEKDAY_SHORT[order[0]]} a ${WEEKDAY_SHORT[order[order.length - 1]].toLowerCase()}`
  const names = order.map((d, i) => (i === 0 ? WEEKDAY_SHORT[d] : WEEKDAY_SHORT[d].toLowerCase()))
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

type Stop = ResolvedStop

export class CourierMeService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /** Paradas resolvidas no intervalo (pão + Cestinha do mesmo cliente/turno/dia = 1). */
  private resolvedStops(courierId: string, fromDay: string, toDay: string): Promise<Stop[]> {
    return resolvedCourierStops(this.prisma, courierId, fromDay, toDay)
  }

  /** E14/E15: perfil e crachá. @throws 404 */
  async me(courierId: string, now: Date = new Date()) {
    const u = await this.prisma.user.findUnique({
      where: { id: courierId },
      select: {
        name: true,
        phone: true,
        cpf: true,
        createdAt: true,
        isBlocked: true,
        courierPhotoUrl: true,
        courierVehicle: true,
        courierRules: true,
        courierAvailability: true,
        badgeNumber: true,
        badgeValidUntil: true,
      },
    })
    if (!u) throw { statusCode: 404, message: 'Entregador não encontrado' }
    const today = brtDateStr(now)
    const validUntil = validityToDay(u.badgeValidUntil)
    const { start, end } = brtDayRange(now)
    const [todayOrders, todayMarkets, offs, slots, stops30, cfg, accepted] = await Promise.all([
      this.prisma.order.findMany({ where: { courierId, scheduledDate: { gte: start, lte: end }, status: { in: ['OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED'] } }, select: { slotId: true, condominiumId: true } }),
      this.prisma.marketOrder.findMany({ where: { courierId, scheduledDate: { gte: start, lte: end }, status: { in: ['OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED'] } }, select: { slotId: true, condominiumId: true } }),
      this.prisma.courierTimeOff.findMany({ where: { courierId, endDate: { gte: today } }, orderBy: { startDate: 'asc' }, take: 1 }),
      getGlobalDeliverySlots(this.prisma),
      this.resolvedStops(courierId, addDays(today, -29), today),
      getRouteConfig(this.prisma),
      this.lastAcceptance(courierId),
    ])
    const todayAll = [...todayOrders, ...todayMarkets]
    const slotIds = [...new Set(todayAll.map((o) => o.slotId).filter((x): x is string => !!x))]
    const condoIds = [...new Set(todayAll.map((o) => o.condominiumId).filter((x): x is string => !!x))]
    const condos = condoIds.length ? await this.prisma.condominium.findMany({ where: { id: { in: condoIds } }, select: { name: true }, orderBy: { name: 'asc' } }) : []
    const availability = (u.courierAvailability ?? null) as { dias?: string[]; turnos?: string[] } | null
    return {
      name: u.name,
      firstName: u.name.trim().split(/\s+/)[0] ?? u.name,
      phone: u.phone ?? null,
      since: u.createdAt.toISOString(),
      photoUrl: u.courierPhotoUrl ?? null,
      cpfMasked: maskCpf(u.cpf),
      vehicle: (u.courierVehicle ?? null) as Record<string, unknown> | null,
      rules: resolveCourierRules(u.courierRules),
      badge: { number: badgeNumberLabel(u.badgeNumber), validUntil, ...badgeStatus({ isBlocked: u.isBlocked, validUntil }, today) },
      today: {
        slots: slots.filter((s) => slotIds.includes(s.slotId)).map((s) => ({ slotId: s.slotId, label: s.label, emoji: s.emoji ?? '' })),
        condos: condos.map((c) => c.name),
      },
      deliveries30: stops30.filter((s) => s.status === 'DELIVERED').length,
      scheduleLabel: scheduleLabel(availability?.dias),
      nextTimeOff: offs[0] ? { startDate: offs[0].startDate, endDate: offs[0].endDate } : null,
      /** Termo do Entregador Parceiro (plano-termos-legais §6): vigente × aceita. */
      terms: { version: LEGAL_DOCS.COURIER_TERMS.version, acceptedVersion: accepted?.version ?? null, acceptedAt: accepted?.acceptedAt.toISOString() ?? null },
      /** Alguma tela mostra combustível ao entregador (A5 · H-6) — o Perfil cita o consumo. */
      showFuel: cfg.entregadorVeCombNumeros || cfg.entregadorVeCombFimRota || cfg.entregadorVeCombGanhos,
    }
  }

  private lastAcceptance(userId: string) {
    return this.prisma.legalAcceptance.findFirst({ where: { userId, doc: 'COURIER_TERMS' }, orderBy: { acceptedAt: 'desc' }, select: { version: true, acceptedAt: true } })
  }

  /**
   * Aceite do Termo do Entregador Parceiro (plano-termos-legais §6 · T-T7). Grava versão, quando, IP,
   * navegador e aparelho — é a prova do aceite. Só a versão VIGENTE é aceita (o app pode estar com o
   * texto antigo em cache). Aceitar de novo a mesma versão não duplica.
   * @throws 409 versão diferente da vigente
   */
  async acceptTerms(
    courierId: string,
    version: string,
    meta: { ip?: string | null; userAgent?: string | null; deviceId?: string | null },
    now: Date = new Date(),
  ): Promise<{ version: string; acceptedAt: string }> {
    const current = LEGAL_DOCS.COURIER_TERMS.version
    if (version !== current) throw { statusCode: 409, message: 'O termo foi atualizado. Leia a versão nova para aceitar.', code: 'OUTDATED' }
    const last = await this.lastAcceptance(courierId)
    if (last?.version === current) return { version: current, acceptedAt: last.acceptedAt.toISOString() }
    const row = await this.prisma.legalAcceptance.create({
      data: {
        userId: courierId,
        doc: 'COURIER_TERMS',
        version: current,
        acceptedAt: now,
        ip: meta.ip?.slice(0, 64) ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        deviceId: meta.deviceId?.slice(0, 100) ?? null,
      },
    })
    return { version: current, acceptedAt: row.acceptedAt.toISOString() }
  }

  /**
   * Crachá v3 (Onda 11 · T-23/T-24): o segredo com que o aparelho gera QR e código a cada 30 s, e a
   * hora do servidor (o app corrige o relógio do celular — T-26). Gerado na 1ª chamada. Inativo ou
   * vencido → `secret: null` (o app apaga o que guardou e não gera QR). @throws 404
   */
  async badgeKey(courierId: string, now: Date = new Date()): Promise<{ secret: string | null; serverTime: string }> {
    const u = await this.prisma.user.findUnique({ where: { id: courierId }, select: { isBlocked: true, badgeValidUntil: true, badgeSecret: true } })
    if (!u) throw { statusCode: 404, message: 'Entregador não encontrado' }
    const serverTime = now.toISOString()
    if (!badgeStatus({ isBlocked: u.isBlocked, validUntil: validityToDay(u.badgeValidUntil) }, brtDateStr(now)).active) return { secret: null, serverTime }
    let secret = u.badgeSecret ?? null
    if (!secret) {
      secret = randomBytes(32).toString('base64url')
      await this.prisma.user.update({ where: { id: courierId }, data: { badgeSecret: secret } })
    }
    return { secret, serverTime }
  }

  /**
   * E17: meus números (7 ou 30 dias). Sem ranking — só os do próprio entregador. Km e combustível
   * estimados só vão com o switch "Meus números" do A5 (padrão desligado, H-6/T-20).
   */
  async stats(courierId: string, days: 7 | 30, now: Date = new Date()) {
    const today = brtDateStr(now)
    const from = addDays(today, -(days - 1))
    const [stops, runs, slots, cfg] = await Promise.all([
      this.resolvedStops(courierId, from, today),
      this.prisma.courierRun.findMany({ where: { courierId, status: 'ENDED', date: { gte: from, lte: today } }, select: { startedAt: true, endedAt: true, plannedKm: true, fuelEstimate: true } }),
      getGlobalDeliverySlots(this.prisma),
      getRouteConfig(this.prisma),
    ])
    const fuelVisible = cfg.entregadorVeCombNumeros
    const sum = (xs: Array<number | null>) => {
      const ns = xs.filter((x): x is number => typeof x === 'number')
      return ns.length ? ns.reduce((a, b) => a + b, 0) : null
    }
    const kmSum = sum(runs.map((r) => r.plannedKm))
    const fuelSum = sum(runs.map((r) => r.fuelEstimate))
    const delivered = stops.filter((s) => s.status === 'DELIVERED')
    const failed = stops.length - delivered.length
    const durations = runs.flatMap((r) => (r.startedAt && r.endedAt ? [(r.endedAt.getTime() - r.startedAt.getTime()) / 60_000] : []))
    const perDay = Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i)
      const here = stops.filter((s) => s.date === date)
      return { date, delivered: here.filter((s) => s.status === 'DELIVERED').length, failed: here.filter((s) => s.status === 'NOT_DELIVERED').length }
    })
    const emojiOf = new Map(slots.map((s) => [s.slotId, s.emoji ?? '']))
    const recent = [...perDay]
      .reverse()
      .filter((d) => d.delivered + d.failed > 0)
      .slice(0, 7)
      .map((d) => ({
        ...d,
        slots: [...new Set(stops.filter((s) => s.date === d.date).map((s) => s.slotId))]
          .sort((a, b) => (slots.find((x) => x.slotId === a)?.time ?? '').localeCompare(slots.find((x) => x.slotId === b)?.time ?? ''))
          .map((id) => emojiOf.get(id) || '•'),
      }))
    return {
      days,
      deliveries: delivered.length,
      failed,
      successRate: stops.length ? Math.round((delivered.length / stops.length) * 1000) / 1000 : null,
      breads: delivered.reduce((n, s) => n + s.breads, 0),
      avgRouteMin: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      fuelVisible,
      ...(fuelVisible
        ? { km: kmSum === null ? null : Math.round(kmSum * 10) / 10, fuel: fuelSum === null ? null : Math.round(fuelSum * 100) / 100 }
        : {}),
      perDay,
      recent,
    }
  }

  /** E18: a semana (segunda a domingo), as folgas futuras e o próximo turno. Só leitura. */
  async schedule(courierId: string, now: Date = new Date()) {
    const today = brtDateStr(now)
    const dow = WEEKDAYS.indexOf(weekdayOf(today))
    const monday = addDays(today, -dow)
    const sunday = addDays(monday, 6)
    const [u, offs, allSlots] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: courierId }, select: { courierAvailability: true } }),
      this.prisma.courierTimeOff.findMany({ where: { courierId, endDate: { gte: monday } }, orderBy: { startDate: 'asc' } }),
      getGlobalDeliverySlots(this.prisma),
    ])
    const availability = (u?.courierAvailability ?? null) as { dias?: string[]; turnos?: string[] } | null
    const slots = allSlots.filter((s) => s.isActive !== false).sort((a, b) => a.time.localeCompare(b.time))
    const slotsFor = (date: string) => slots.filter((s) => !offReasonFor(availability, [], date, s.slotId))
    const dayInfo = (date: string) => {
      const off: OffReason | null = offReasonFor(availability, offs, date) ?? (slotsFor(date).length === 0 ? 'FORA_DA_ESCALA' : null)
      return {
        date,
        weekday: weekdayOf(date),
        today: date === today,
        off,
        slots: off ? [] : slotsFor(date).map((s) => ({ slotId: s.slotId, label: s.label, emoji: s.emoji ?? '', time: s.time })),
      }
    }
    const week = Array.from({ length: 7 }, (_, i) => dayInfo(addDays(monday, i)))
    let nextShift: { date: string; slotId: string; label: string; emoji: string; time: string } | null = null
    for (let i = 1; i <= 21 && !nextShift; i++) {
      const d = dayInfo(addDays(today, i))
      if (d.slots[0]) nextShift = { date: d.date, ...d.slots[0] }
    }
    return {
      weekStart: monday,
      weekEnd: sunday,
      slots: slots.map((s) => ({ slotId: s.slotId, label: s.label, emoji: s.emoji ?? '', time: s.time })),
      week,
      todayOff: dayInfo(today).off,
      timeOffs: offs.filter((o) => o.endDate >= today).map((o) => ({ startDate: o.startDate, endDate: o.endDate, reason: o.reason ?? null })),
      nextShift,
      scheduleLabel: scheduleLabel(availability?.dias),
    }
  }
}
