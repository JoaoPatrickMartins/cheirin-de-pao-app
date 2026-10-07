import type { FastifyInstance } from 'fastify'
import { NotificationType } from '@prisma/client'
import { brtDayRange } from './cutoff.js'
import { getGlobalDeliverySlots } from './delivery-slots.js'
import { NotificationsService } from '../modules/notifications/notifications.service.js'

/**
 * Turno oferecido ao entregador (plano-termos-legais §5 · T-T1/T-T2). A aprovação da divisão de
 * entregas continua despachando as paradas; depois dela, este sincronizador acerta a OFERTA de cada
 * entregador naquele dia/turno:
 *
 * - tem paradas e nenhuma oferta ativa → cria `OFFERED` e avisa "Turno da manhã: N paradas…";
 * - já tinha oferta ativa → só atualiza o nº de paradas (aceite não volta para OFFERED; o aviso só
 *   sai se as paradas aumentaram);
 * - ficou sem paradas (o admin passou tudo para outro) → `WITHDRAWN`.
 *
 * Paradas = clientes distintos com pão/Cestinha do entregador no dia/turno (pão + Cestinha = 1).
 */

const ACTIVE = ['OFFERED', 'ACCEPTED']
const ASSIGNED = ['OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED'] as const

export const dayRangeOf = (date: string) => brtDayRange(new Date(`${date}T15:00:00.000Z`))

export interface ShiftKey {
  date: string
  slotId: string
}

/** Clientes distintos por entregador no dia/turno. */
export async function stopsByCourier(prisma: FastifyInstance['prisma'], key: ShiftKey): Promise<Map<string, number>> {
  const { start, end } = dayRangeOf(key.date)
  const where = { scheduledDate: { gte: start, lte: end }, slotId: key.slotId, status: { in: [...ASSIGNED] }, courierId: { not: null } }
  const [orders, markets] = await Promise.all([
    prisma.order.findMany({ where, select: { courierId: true, userId: true } }),
    prisma.marketOrder.findMany({ where, select: { courierId: true, userId: true } }),
  ])
  const users = new Map<string, Set<string>>()
  for (const o of [...orders, ...markets]) {
    if (!o.courierId) continue
    const set = users.get(o.courierId) ?? new Set<string>()
    set.add(o.userId)
    users.set(o.courierId, set)
  }
  return new Map([...users].map(([id, set]) => [id, set.size]))
}

/** Acerta as ofertas dos turnos tocados por uma aprovação. Best-effort: nunca desfaz a divisão. */
export async function syncShiftOffers(fastify: FastifyInstance, keys: ShiftKey[], now: Date = new Date()): Promise<void> {
  const prisma = fastify.prisma
  const unique = [...new Map(keys.map((k) => [`${k.date}|${k.slotId}`, k])).values()]
  if (unique.length === 0) return
  let slots: Awaited<ReturnType<typeof getGlobalDeliverySlots>> = []
  try {
    slots = await getGlobalDeliverySlots(prisma)
  } catch (err) {
    fastify.log.warn({ err }, '[shift-offers] sem os turnos globais — segue com o slotId')
  }
  const notifications = new NotificationsService(fastify)
  for (const key of unique) {
    try {
      const counts = await stopsByCourier(prisma, key)
      const active = await prisma.courierShiftOffer.findMany({ where: { date: key.date, slotId: key.slotId, status: { in: ACTIVE } } })
      const byCourier = new Map(active.map((o) => [o.courierId, o]))
      const slot = slots.find((s) => s.slotId === key.slotId)
      const label = (slot?.label ?? key.slotId).toLowerCase()

      for (const [courierId, stops] of counts) {
        const cur = byCourier.get(courierId)
        if (!cur) {
          await prisma.courierShiftOffer.create({ data: { courierId, date: key.date, slotId: key.slotId, status: 'OFFERED', stops, offeredAt: now } })
          await notifyCourier(notifications, fastify, courierId, {
            title: `Turno da ${label}`,
            body: `${stops === 1 ? '1 parada' : `${stops} paradas`}${slot?.time ? ` às ${slot.time}` : ''}. Toque para aceitar ou recusar.`,
          })
        } else if (cur.stops !== stops) {
          await prisma.courierShiftOffer.update({ where: { id: cur.id }, data: { stops } })
          if (stops > cur.stops) await notifyCourier(notifications, fastify, courierId, { title: `Seu turno da ${label} mudou`, body: `Agora são ${stops} paradas. Toque para ver a rota.` })
        }
      }
      for (const o of active) {
        if (!counts.has(o.courierId)) await prisma.courierShiftOffer.update({ where: { id: o.id }, data: { status: 'WITHDRAWN', respondedAt: now } })
      }
    } catch (err) {
      fastify.log.warn({ err, key }, '[shift-offers] falha ao acertar as ofertas do turno — ignorado')
    }
  }
}

async function notifyCourier(notifications: NotificationsService, fastify: FastifyInstance, courierId: string, msg: { title: string; body: string }) {
  try {
    await notifications.notifyUser(courierId, { type: NotificationType.COURIER_NEW_ORDERS, title: msg.title, body: msg.body, actionRoute: '/courier' })
  } catch (err) {
    fastify.log.warn({ err, courierId }, '[shift-offers] falha ao avisar o entregador — ignorado')
  }
}
