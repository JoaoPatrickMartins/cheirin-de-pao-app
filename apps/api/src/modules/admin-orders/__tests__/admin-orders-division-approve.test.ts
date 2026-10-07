// Aprovar a divisão (plano-termos-legais §5): despacha as paradas e acerta o turno OFERECIDO de cada
// entregador pelos dias/turnos das paradas (o aviso "aceitar ou recusar" sai de lá).
import { describe, it, expect, vi } from 'vitest'

const sync = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/courier-shift-offers.js', () => ({ syncShiftOffers: sync }))
vi.mock('../../courier/courier-plan.js', () => ({ ensureSuggestion: vi.fn() }))

import { AdminOrdersService } from '../admin-orders.service.js'

describe('approveDivision · turno oferecido', () => {
  it('despacha e chama o sincronizador com o dia (BRT) e o turno de cada parada', async () => {
    const prisma = {
      order: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        findMany: vi.fn().mockResolvedValue([
          { userId: 'u1', condominiumId: 'c1', slotId: 'manha', scheduledDate: new Date('2026-10-02T09:00:00Z') },
          { userId: 'u2', condominiumId: 'c1', slotId: 'manha', scheduledDate: new Date('2026-10-02T09:00:00Z') },
        ]),
      },
      marketOrder: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findMany: vi.fn().mockResolvedValue([]) },
      hookRequest: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      condominium: { findMany: vi.fn().mockResolvedValue([]) },
      setting: { findUnique: vi.fn().mockResolvedValue(null) },
    }
    const fastify = { prisma, log: { warn: vi.fn() } }
    const r = await new AdminOrdersService(fastify as never).approveDivision([{ courierId: 'k1', orderIds: ['o1', 'o2'] }])
    expect(r).toEqual({ count: 2 })
    expect(prisma.order.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['o1', 'o2'] }, status: { in: ['SEPARATED', 'OUT_FOR_DELIVERY'] } }, data: { courierId: 'k1', status: 'OUT_FOR_DELIVERY' } })
    expect(sync).toHaveBeenCalledWith(fastify, [
      { date: '2026-10-02', slotId: 'manha' },
      { date: '2026-10-02', slotId: 'manha' },
    ])
  })
})
