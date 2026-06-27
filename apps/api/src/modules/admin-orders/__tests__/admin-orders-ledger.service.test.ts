// AdminOrdersService unit tests — Fase D (ledger / stuck / refund)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminOrdersService } from '../admin-orders.service.js'

vi.mock('@onesignal/node-onesignal', () => ({
  createConfiguration: vi.fn().mockReturnValue({}),
  DefaultApi: vi.fn().mockImplementation(() => ({ createNotification: vi.fn().mockResolvedValue({}) })),
  Notification: vi.fn().mockImplementation(() => ({})),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMock(overrides: Record<string, any> = {}) {
  const {
    orders = [],
    count = 0,
    users = [],
    condos = [],
    couriers = [],
    refunds = [],
    order = null,
    existingRefund = null,
    creditBalanceAfter = 0,
  } = overrides

  const prisma = {
    order: {
      findMany: vi.fn().mockResolvedValue(orders),
      count: vi.fn().mockResolvedValue(count),
      findUnique: vi.fn().mockResolvedValue(order),
      update: vi.fn().mockResolvedValue({}),
    },
    user: {
      // enrich (userIds) e busca por q usam o mesmo mock; couriers via segundo retorno
      findMany: vi.fn().mockImplementation(({ where }: { where?: { id?: { in?: string[] } } }) => {
        // se buscando courierIds, devolve couriers; senão, users
        const ids = where?.id?.in ?? []
        const isCourier = couriers.some((c: { id: string }) => ids.includes(c.id))
        return Promise.resolve(isCourier ? couriers : users)
      }),
      findUnique: vi.fn().mockResolvedValue({ creditBalance: creditBalanceAfter }),
      update: vi.fn().mockResolvedValue({}),
    },
    condominium: { findMany: vi.fn().mockResolvedValue(condos) },
    creditTransaction: {
      findMany: vi.fn().mockResolvedValue(refunds),
      findFirst: vi.fn().mockResolvedValue(existingRefund),
      create: vi.fn().mockResolvedValue({ id: 'tx-1' }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn().mockImplementation((ops: any[]) => Promise.all(ops)),
  }

  return { fastify: { prisma, log: { error: vi.fn(), warn: vi.fn() } } as unknown, prisma }
}

const SLOTS = [{ slotId: 'manha', name: 'manha', label: 'Manhã', time: '06:30', cutoffTime: '22:00', isActive: true }]

function makeOrder(over: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    userId: 'u1',
    quantity: 4,
    slotId: 'manha',
    type: 'SCHEDULED',
    status: 'DELIVERED',
    condominiumId: 'c1',
    courierId: null,
    scheduledDate: new Date('2026-06-20T15:00:00.000Z'),
    separatedAt: null,
    deliveredAt: new Date('2026-06-20T10:00:00.000Z'),
    failedAt: null,
    failureReason: null,
    cancelReason: null,
    ...over,
  }
}

describe('AdminOrdersService — ledger / stuck / refund', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getLedger', () => {
    it('enriquece linhas com cliente, condomínio, slot e flag de estorno', async () => {
      const { fastify } = makeMock({
        orders: [makeOrder()],
        count: 1,
        users: [{ id: 'u1', name: 'Ana', apartment: '101', block: 'A' }],
        condos: [{ id: 'c1', name: 'Cond 1', deliverySlots: SLOTS }],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminOrdersService(fastify as any).getLedger({})
      expect(r.total).toBe(1)
      expect(r.hasMore).toBe(false)
      expect(r.rows).toHaveLength(1)
      const row = r.rows[0]
      expect(row.clientName).toBe('Ana')
      expect(row.condominiumName).toBe('Cond 1')
      expect(row.slotLabel).toBe('Manhã')
      expect(row.refunded).toBe(false)
      expect(row.deliveredAt).not.toBe('')
      expect(row.failureReason).toBe('') // nulos viram '' (sem strip do response schema)
    })

    it('marca refunded=true quando há CreditTransaction REFUND para o pedido', async () => {
      const { fastify } = makeMock({
        orders: [makeOrder({ status: 'NOT_DELIVERED', failedAt: new Date(), failureReason: 'Ausente' })],
        count: 1,
        users: [{ id: 'u1', name: 'Ana', apartment: '101', block: 'A' }],
        condos: [{ id: 'c1', name: 'Cond 1', deliverySlots: SLOTS }],
        refunds: [{ referenceId: 'o1' }],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminOrdersService(fastify as any).getLedger({ status: ['NOT_DELIVERED'] })
      expect(r.rows[0].refunded).toBe(true)
      expect(r.rows[0].failureReason).toBe('Ausente')
    })

    it('retorna vazio quando a busca q não casa nenhum cliente', async () => {
      const { fastify, prisma } = makeMock({ users: [] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminOrdersService(fastify as any).getLedger({ q: 'zzz' })
      expect(r).toEqual({ rows: [], total: 0, hasMore: false })
      expect(prisma.order.findMany).not.toHaveBeenCalled()
    })
  })

  describe('getStuck', () => {
    it('retorna pedidos parados com contagem', async () => {
      const { fastify } = makeMock({
        orders: [makeOrder({ status: 'SCHEDULED', deliveredAt: null })],
        count: 1,
        users: [{ id: 'u1', name: 'Ana', apartment: '101', block: 'A' }],
        condos: [{ id: 'c1', name: 'Cond 1', deliverySlots: SLOTS }],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminOrdersService(fastify as any).getStuck()
      expect(r.count).toBe(1)
      expect(r.rows[0].status).toBe('SCHEDULED')
    })
  })

  describe('refundOrder', () => {
    it('cria REFUND, incrementa saldo e retorna o novo saldo', async () => {
      const { fastify, prisma } = makeMock({
        order: { id: 'o1', userId: 'u1', quantity: 5 },
        existingRefund: null,
        creditBalanceAfter: 12,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminOrdersService(fastify as any).refundOrder('o1', 'admin-1', 'falha de rota')
      expect(r).toEqual({ id: 'o1', refundedCredits: 5, creditBalance: 12 })
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'REFUND', quantity: 5, referenceId: 'o1' }) }),
      )
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { creditBalance: { increment: 5 } } }),
      )
    })

    it('lança 409 quando o pedido já foi estornado', async () => {
      const { fastify } = makeMock({ order: { id: 'o1', userId: 'u1', quantity: 5 }, existingRefund: { id: 'tx-old' } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(new AdminOrdersService(fastify as any).refundOrder('o1', 'admin-1')).rejects.toMatchObject({
        statusCode: 409,
      })
    })

    it('lança 404 quando o pedido não existe', async () => {
      const { fastify } = makeMock({ order: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(new AdminOrdersService(fastify as any).refundOrder('x', 'admin-1')).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })
})
