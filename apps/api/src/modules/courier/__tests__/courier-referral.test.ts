// Indique e Ganhe — a Cestinha confirmada pelo entregador chama `afterDelivery` (§7.5).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('../../../lib/referral.js', () => ({ afterDelivery: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../../lib/market-pipeline.js', () => ({ completeMarketStop: vi.fn() }))
// O resumo da parada (pop-up) e o comprovante não são o assunto deste teste.
vi.mock('../courier-stop.js', () => ({
  buildStopSummary: vi.fn().mockResolvedValue({ marketOrderIds: ['m1'], proofRequired: true }),
  recordStopOutcome: vi.fn().mockResolvedValue(undefined),
  lastClientOpId: vi.fn().mockResolvedValue(null),
  clampOccurredAt: vi.fn().mockReturnValue(null),
}))
vi.mock('../../market/market-notify.js', () => ({
  notifyMarketDelivered: vi.fn(),
  notifyMarketNotDelivered: vi.fn(),
}))

import { CourierService } from '../courier.service.js'
import { afterDelivery } from '../../../lib/referral.js'
import { completeMarketStop } from '../../../lib/market-pipeline.js'

const stop = {
  id: 'm1',
  userId: 'friend1',
  courierId: 'courier1',
  status: 'OUT_FOR_DELIVERY',
  condominiumId: 'c1',
  slotId: 'manha',
  scheduledDate: new Date('2026-09-20T15:00:00Z'),
}

function makeService() {
  const prisma = { marketOrder: { findUnique: vi.fn().mockResolvedValue(stop), updateMany: vi.fn().mockResolvedValue({ count: 1 }) } }
  const fastify = { prisma, log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } } as unknown as FastifyInstance
  return { service: new CourierService(fastify), fastify }
}

beforeEach(() => {
  vi.mocked(afterDelivery).mockClear()
  vi.mocked(completeMarketStop).mockReset()
})

describe('CourierService — gatilho do Indique e Ganhe na Cestinha', () => {
  it('confirmMarketDelivery que moveu a Cestinha → afterDelivery(cliente)', async () => {
    vi.mocked(completeMarketStop).mockResolvedValue(1)
    const { service, fastify } = makeService()
    await service.confirmMarketDelivery('m1', 'courier1')
    expect(afterDelivery).toHaveBeenCalledWith(fastify, 'friend1')
  })

  it('reexecução (nada movido) não reavalia', async () => {
    vi.mocked(completeMarketStop).mockResolvedValue(0)
    await makeService().service.confirmMarketDelivery('m1', 'courier1')
    expect(afterDelivery).not.toHaveBeenCalled()
  })

  it('não entregue não dispara', async () => {
    vi.mocked(completeMarketStop).mockResolvedValue(1)
    await makeService().service.markMarketNotDelivered('m1', 'courier1', { reason: 'ausente' })
    expect(afterDelivery).not.toHaveBeenCalled()
  })
})
