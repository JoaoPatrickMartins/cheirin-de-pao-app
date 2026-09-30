// Indique e Ganhe — os pontos de entrega do admin chamam `afterDelivery` só em DELIVERED (§7.5).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('../../../lib/referral.js', () => ({ afterDelivery: vi.fn().mockResolvedValue(undefined) }))
// O resto da esteira não importa aqui — só QUANDO o gatilho da indicação dispara.
vi.mock('../../../lib/market-pipeline.js', () => ({
  propagateMarketStatusForOrder: vi.fn().mockResolvedValue(0),
  dispatchMarketForOrders: vi.fn(),
  assignMarketByCondoDay: vi.fn(),
}))
vi.mock('../../../lib/market-reversal.js', () => ({ reverseMarketOrder: vi.fn().mockResolvedValue(0) }))
vi.mock('../../market/market-notify.js', () => ({
  notifyMarketCancelled: vi.fn(),
  notifyMarketDelivered: vi.fn(),
  notifyMarketNotDelivered: vi.fn(),
}))

import { AdminOrdersService } from '../admin-orders.service.js'
import { afterDelivery } from '../../../lib/referral.js'

function makeService(order: Record<string, unknown>, marketOrder: Record<string, unknown> | null = null) {
  const prisma = {
    order: { findUnique: vi.fn().mockResolvedValue(order), update: vi.fn().mockResolvedValue(order) },
    marketOrder: { findUnique: vi.fn().mockResolvedValue(marketOrder) },
    creditTransaction: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue({ creditMilli: 0 }), update: vi.fn() },
    setting: { findUnique: vi.fn().mockResolvedValue({ value: '1.00' }) },
    $transaction: vi.fn().mockResolvedValue([]),
  }
  const fastify = { prisma, log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } } as unknown as FastifyInstance
  const service = new AdminOrdersService(fastify)
  // Avisos do próprio serviço ficam fora do escopo deste teste.
  const internals = service as unknown as Record<string, unknown>
  internals.notifyAndPersist = vi.fn().mockResolvedValue(undefined)
  internals.notifyAdminsDelivery = vi.fn().mockResolvedValue(undefined)
  return { service, fastify }
}

const breadOrder = {
  id: 'o1',
  userId: 'friend1',
  quantity: 4,
  status: 'OUT_FOR_DELIVERY',
  scheduledDate: new Date('2026-09-20T15:00:00Z'),
  condominiumId: 'c1',
  slotId: 'manha',
}

beforeEach(() => vi.mocked(afterDelivery).mockClear())

describe('AdminOrdersService — gatilho do Indique e Ganhe', () => {
  it('updateOrderStatus DELIVERED → afterDelivery(cliente do pedido)', async () => {
    const { service, fastify } = makeService(breadOrder)
    await service.updateOrderStatus('o1', 'DELIVERED')
    expect(afterDelivery).toHaveBeenCalledOnce()
    expect(afterDelivery).toHaveBeenCalledWith(fastify, 'friend1')
  })

  it('updateOrderStatus em outro status não dispara', async () => {
    for (const [status, to] of [['OUT_FOR_DELIVERY', 'NOT_DELIVERED'], ['SCHEDULED', 'SEPARATED'], ['SCHEDULED', 'OUT_FOR_DELIVERY']]) {
      const { service } = makeService({ ...breadOrder, status })
      await service.updateOrderStatus('o1', to, 'motivo')
    }
    expect(afterDelivery).not.toHaveBeenCalled()
  })

  it('resolveStuckOrder DELIVERED dispara; NOT_DELIVERED e CANCELLED não', async () => {
    const stuck = { ...breadOrder, status: 'SCHEDULED' }
    await makeService(stuck).service.resolveStuckOrder('o1', 'admin1', { outcome: 'DELIVERED' })
    expect(afterDelivery).toHaveBeenCalledWith(expect.anything(), 'friend1')

    vi.mocked(afterDelivery).mockClear()
    await makeService(stuck).service.resolveStuckOrder('o1', 'admin1', { outcome: 'NOT_DELIVERED', reason: 'x' })
    await makeService(stuck).service.resolveStuckOrder('o1', 'admin1', { outcome: 'CANCELLED', reason: 'x' })
    expect(afterDelivery).not.toHaveBeenCalled()
  })

  it('resolveStuckMarketOrder DELIVERED dispara; NOT_DELIVERED e CANCELLED não', async () => {
    const cesta = { id: 'm1', userId: 'friend1', status: 'SCHEDULED', scheduledDate: new Date('2026-09-20T15:00:00Z') }
    await makeService(breadOrder, cesta).service.resolveStuckMarketOrder('m1', 'admin1', { outcome: 'DELIVERED' })
    expect(afterDelivery).toHaveBeenCalledWith(expect.anything(), 'friend1')

    vi.mocked(afterDelivery).mockClear()
    await makeService(breadOrder, cesta).service.resolveStuckMarketOrder('m1', 'admin1', { outcome: 'NOT_DELIVERED' })
    await makeService(breadOrder, cesta).service.resolveStuckMarketOrder('m1', 'admin1', { outcome: 'CANCELLED' })
    expect(afterDelivery).not.toHaveBeenCalled()
  })
})
