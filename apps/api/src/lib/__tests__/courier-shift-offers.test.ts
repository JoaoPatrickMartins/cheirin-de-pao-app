// Turno oferecido na aprovação da divisão (plano-termos-legais §5 · T-T1/T-T2).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const notifyUser = vi.hoisted(() => vi.fn())
vi.mock('../../modules/notifications/notifications.service.js', () => ({
  NotificationsService: class {
    notifyUser = notifyUser
  },
}))

import { syncShiftOffers } from '../courier-shift-offers.js'

const now = new Date('2026-10-02T08:00:00.000Z')
const key = { date: '2026-10-02', slotId: 'manha' }

function setup(over: { orders?: unknown[]; markets?: unknown[]; active?: unknown[] } = {}) {
  const prisma = {
    order: { findMany: vi.fn().mockResolvedValue(over.orders ?? []) },
    marketOrder: { findMany: vi.fn().mockResolvedValue(over.markets ?? []) },
    courierShiftOffer: {
      findMany: vi.fn().mockResolvedValue(over.active ?? []),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    setting: { findUnique: vi.fn().mockResolvedValue(null) },
  }
  return { prisma, fastify: { prisma, log: { warn: vi.fn() } } as never }
}

beforeEach(() => vi.clearAllMocks())

describe('syncShiftOffers', () => {
  it('entregador com paradas e sem oferta: cria OFFERED (pão + Cestinha do mesmo cliente = 1) e avisa "aceitar ou recusar"', async () => {
    const { prisma, fastify } = setup({
      orders: [{ courierId: 'k1', userId: 'u1' }, { courierId: 'k1', userId: 'u2' }],
      markets: [{ courierId: 'k1', userId: 'u1' }],
    })
    await syncShiftOffers(fastify, [key, key], now)
    expect(prisma.courierShiftOffer.create).toHaveBeenCalledTimes(1)
    expect(prisma.courierShiftOffer.create).toHaveBeenCalledWith({ data: { courierId: 'k1', date: '2026-10-02', slotId: 'manha', status: 'OFFERED', stops: 2, offeredAt: now } })
    expect(notifyUser).toHaveBeenCalledWith('k1', expect.objectContaining({ type: 'COURIER_NEW_ORDERS', title: 'Turno da manhã', body: '2 paradas às 06:30. Toque para aceitar ou recusar.' }))
  })

  it('já tinha oferta: só atualiza as paradas (aceite não volta para OFFERED); aviso só se aumentou', async () => {
    const accepted = { id: 'o1', courierId: 'k1', status: 'ACCEPTED', stops: 3 }
    const less = setup({ orders: [{ courierId: 'k1', userId: 'u1' }], active: [accepted] })
    await syncShiftOffers(less.fastify, [key], now)
    expect(less.prisma.courierShiftOffer.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { stops: 1 } })
    expect(less.prisma.courierShiftOffer.create).not.toHaveBeenCalled()
    expect(notifyUser).not.toHaveBeenCalled()

    const more = setup({ orders: [1, 2, 3, 4].map((i) => ({ courierId: 'k1', userId: `u${i}` })), active: [accepted] })
    await syncShiftOffers(more.fastify, [key], now)
    expect(notifyUser).toHaveBeenCalledWith('k1', expect.objectContaining({ title: 'Seu turno da manhã mudou', body: 'Agora são 4 paradas. Toque para ver a rota.' }))
  })

  it('perdeu todas as paradas na reaprovação: WITHDRAWN', async () => {
    const { prisma, fastify } = setup({ orders: [{ courierId: 'k2', userId: 'u1' }], active: [{ id: 'o1', courierId: 'k1', status: 'OFFERED', stops: 2 }] })
    await syncShiftOffers(fastify, [key], now)
    expect(prisma.courierShiftOffer.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'WITHDRAWN', respondedAt: now } })
    expect(prisma.courierShiftOffer.create).toHaveBeenCalledWith({ data: expect.objectContaining({ courierId: 'k2', status: 'OFFERED' }) })
  })
})
