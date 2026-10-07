import type { FastifyInstance } from 'fastify'
import { NotificationType } from '@prisma/client'
import { shiftDeclineLabel, type ShiftDeclineReason } from '@cheirin-de-pao/shared'
import { brtDateStr } from '../../lib/cutoff.js'
import { getGlobalDeliverySlots } from '../../lib/delivery-slots.js'
import { dayRangeOf } from '../../lib/courier-shift-offers.js'
import { pendingHookOnlyStops, resolvedHookOnlyStops } from '../../lib/hook-stops.js'
import { NotificationsService } from '../notifications/notifications.service.js'

/**
 * Aceitar ou recusar o turno (plano-termos-legais §5 · D-T1/D-T5). O turno chega OFERECIDO na
 * aprovação da divisão; sem resposta, segue com o entregador. Recusar é livre até iniciar a rota ou
 * resolver a 1ª parada (pão, Cestinha ou gancho sozinho), sem justificativa obrigatória e SEM
 * PENALIDADE: as paradas voltam para a divisão (sem entregador) e o admin é avisado para
 * redistribuir. Recusas não entram em métrica nenhuma — o histórico fica só como prova da autonomia.
 */

export interface ShiftView {
  id: string
  slotId: string
  label: string
  emoji: string
  time: string
  status: 'OFFERED' | 'ACCEPTED'
  stops: number
  offeredAt: string
}

export class CourierShiftService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /** Turnos de HOJE ainda com o entregador (oferecidos ou aceitos), na ordem do horário. */
  async today(courierId: string, now: Date = new Date()): Promise<ShiftView[]> {
    const [rows, slots] = await Promise.all([
      this.prisma.courierShiftOffer.findMany({ where: { courierId, date: brtDateStr(now), status: { in: ['OFFERED', 'ACCEPTED'] } }, orderBy: { offeredAt: 'desc' } }),
      getGlobalDeliverySlots(this.prisma),
    ])
    const latest = new Map<string, (typeof rows)[number]>()
    for (const r of rows) if (!latest.has(r.slotId)) latest.set(r.slotId, r)
    return [...latest.values()]
      .map((r) => {
        const s = slots.find((x) => x.slotId === r.slotId)
        return { id: r.id, slotId: r.slotId, label: s?.label ?? r.slotId, emoji: s?.emoji ?? '', time: s?.time ?? '', status: r.status as ShiftView['status'], stops: r.stops, offeredAt: r.offeredAt.toISOString() }
      })
      .sort((a, b) => a.time.localeCompare(b.time))
  }

  private async own(courierId: string, id: string) {
    const offer = await this.prisma.courierShiftOffer.findUnique({ where: { id } })
    if (!offer || offer.courierId !== courierId) throw { statusCode: 404, message: 'Turno não encontrado' }
    if (offer.status === 'DECLINED') throw { statusCode: 409, message: 'Você já recusou este turno.', code: 'DECLINED' }
    if (offer.status === 'WITHDRAWN') throw { statusCode: 409, message: 'A operação passou este turno para outra pessoa.', code: 'WITHDRAWN' }
    return offer
  }

  /** "Aceitar". Já aceito → devolve igual. @throws 404 · 409 recusado/retirado */
  async accept(courierId: string, id: string, now: Date = new Date()): Promise<{ id: string; status: 'ACCEPTED' }> {
    const offer = await this.own(courierId, id)
    if (offer.status !== 'ACCEPTED') await this.prisma.courierShiftOffer.update({ where: { id }, data: { status: 'ACCEPTED', respondedAt: now, via: 'BUTTON' } })
    return { id, status: 'ACCEPTED' }
  }

  /**
   * "Recusar": devolve as paradas do turno para a divisão (pão, Cestinha e o gancho na rota) e avisa
   * os admins. @throws 404 · 409 recusado/retirado/turno passado/rota já começou
   */
  async decline(courierId: string, id: string, reason: ShiftDeclineReason | null, now: Date = new Date()): Promise<{ id: string; status: 'DECLINED'; released: number }> {
    const offer = await this.own(courierId, id)
    if (offer.date !== brtDateStr(now)) throw { statusCode: 409, message: 'Este turno já passou.', code: 'PAST' }
    const { start, end } = dayRangeOf(offer.date)
    const scope = { courierId, slotId: offer.slotId, scheduledDate: { gte: start, lte: end } }
    const [run, resolved] = await Promise.all([
      this.prisma.courierRun.findUnique({ where: { courierId_date_slotId: { courierId, date: offer.date, slotId: offer.slotId } }, select: { status: true } }),
      this.prisma.order.count({ where: { ...scope, status: { in: ['DELIVERED', 'NOT_DELIVERED'] } } }),
    ])
    const marketResolved = resolved > 0 ? 0 : await this.prisma.marketOrder.count({ where: { ...scope, status: { in: ['DELIVERED', 'NOT_DELIVERED'] } } })
    // Gancho sozinho resolvido também trava: não depende da rota ter iniciado sozinha (best-effort).
    const hookResolved = resolved + marketResolved > 0 ? 0 : (await resolvedHookOnlyStops(this.prisma, [courierId], offer.date, offer.date, offer.slotId)).length
    if (run?.status === 'STARTED' || run?.status === 'ENDED' || resolved + marketResolved + hookResolved > 0) {
      throw { statusCode: 409, message: 'A rota já começou. Para sair dela, fale com a operação.', code: 'STARTED' }
    }

    // Gancho sozinho (sem pão no turno) não tem divisão para voltar: volta para a fila, com o motivo.
    const alone = await pendingHookOnlyStops(this.prisma, { courierIds: [courierId], date: offer.date, slotId: offer.slotId })
    if (alone.length > 0) {
      await this.prisma.hookRequest.updateMany({
        where: { id: { in: alone.map((h) => h.hookId) }, status: 'REQUESTED' },
        data: { routeDate: null, routeSlotId: null, routeCourierId: null, routeFailedAt: now, routeFailedReason: 'Entregador recusou o turno' },
      })
    }
    const [orders, markets] = await Promise.all([
      this.prisma.order.updateMany({ where: { ...scope, status: 'OUT_FOR_DELIVERY' }, data: { courierId: null, status: 'SEPARATED' } }),
      this.prisma.marketOrder.updateMany({ where: { ...scope, status: 'OUT_FOR_DELIVERY' }, data: { courierId: null, status: 'SEPARATED' } }),
    ])
    // O gancho que vai com o pão perde o entregador e sai de novo na próxima aprovação da divisão.
    await this.prisma.hookRequest.updateMany({
      where: { routeCourierId: courierId, routeDate: offer.date, routeSlotId: offer.slotId, status: 'REQUESTED' },
      data: { routeCourierId: null },
    })
    await this.prisma.courierShiftOffer.update({ where: { id }, data: { status: 'DECLINED', respondedAt: now, reason } })

    try {
      const [courier, slots] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: courierId }, select: { name: true } }),
        getGlobalDeliverySlots(this.prisma),
      ])
      const who = courier?.name?.trim().split(/\s+/)[0] || 'Um entregador'
      const label = (slots.find((s) => s.slotId === offer.slotId)?.label ?? offer.slotId).toLowerCase()
      const motivo = shiftDeclineLabel(reason)
      await new NotificationsService(this.fastify).notifyAdmins({
        type: NotificationType.ADMIN_SHIFT_DECLINED,
        title: 'Turno recusado',
        body: `${who} recusou o turno da ${label}${motivo ? ` (${motivo.toLowerCase()})` : ''}. ${offer.stops === 1 ? '1 parada voltou' : `${offer.stops} paradas voltaram`} para a divisão.`,
        actionRoute: '/admin',
        dedupeKey: `shift-declined:${id}`,
      })
    } catch (err) {
      this.fastify.log.warn({ err, offerId: id }, '[courier-shifts] falha ao avisar a recusa — ignorado')
    }
    return { id, status: 'DECLINED', released: orders.count + markets.count }
  }
}
