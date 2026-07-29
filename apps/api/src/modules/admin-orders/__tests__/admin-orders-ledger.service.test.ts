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
    // D-4: ledger unificado. Vazio por padrão → o fluxo de pão fica idêntico ao histórico.
    marketOrders = [],
    marketCount = 0,
  } = overrides

  const prisma = {
    order: {
      findMany: vi.fn().mockResolvedValue(orders),
      count: vi.fn().mockResolvedValue(count),
      findUnique: vi.fn().mockResolvedValue(order),
      update: vi.fn().mockResolvedValue({}),
    },
    // D-4: o ledger/limbo é unificado (pão + Cestinha). Vazio por padrão → as asserções
    // existentes do fluxo de pão continuam valendo sem mudança.
    marketOrder: {
      findMany: vi.fn().mockResolvedValue(marketOrders),
      count: vi.fn().mockResolvedValue(marketCount),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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

/** Uma Cestinha na forma que `_marketLedgerSelect` devolve. */
function makeMarketOrder(over: Record<string, unknown> = {}) {
  return {
    id: 'mo1',
    userId: 'u1',
    condominiumId: 'c1',
    slotId: 'manha',
    status: 'SCHEDULED',
    breadQty: 2,
    scheduledDate: new Date('2026-06-21T15:00:00.000Z'),
    separatedAt: null,
    deliveredAt: null,
    failedAt: null,
    failureReason: null,
    cancelReason: null,
    paymentId: null,
    courierId: null,
    creditsApplied: 3,
    moneyAmount: 5.5,
    totalValue: 8.5,
    items: [{ name: 'Bolo de Fubá', qty: 2 }],
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

    // ── D-4: ledger unificado (pão + Cestinha) ──────────────────────────────
    it('une pão e Cestinha na mesma lista, discriminados por kind', async () => {
      const { fastify } = makeMock({
        orders: [makeOrder()],
        count: 1,
        marketOrders: [makeMarketOrder()],
        marketCount: 1,
        users: [{ id: 'u1', name: 'Ana', apartment: '101', block: 'A' }],
        condos: [{ id: 'c1', name: 'Cond 1', deliverySlots: SLOTS }],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminOrdersService(fastify as any).getLedger({})
      expect(r.total).toBe(2)
      expect(r.rows).toHaveLength(2)
      // Ordenado por data de entrega desc → a Cestinha (21/06) vem antes do pão (20/06).
      expect(r.rows[0].kind).toBe('CESTINHA')
      expect(r.rows[0].marketOrderId).toBe('mo1')
      expect(r.rows[0].orderId).toBe('')
      expect(r.rows[0].type).toBe('MARKET')
      expect(r.rows[0].quantity).toBe(2) // breadQty — pão da Cestinha
      expect(r.rows[0].marketItems).toEqual([{ name: 'Bolo de Fubá', qty: 2 }])
      expect(r.rows[0].creditsApplied).toBe(3)
      expect(r.rows[1].kind).toBe('BREAD')
      expect(r.rows[1].orderId).toBe('o1')
      expect(r.rows[1].marketOrderId).toBe('')
    })

    it('kind=BREAD não consulta a coleção de Cestinhas (e vice-versa)', async () => {
      const m1 = makeMock({ orders: [makeOrder()], count: 1, marketOrders: [makeMarketOrder()], marketCount: 1 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onlyBread = await new AdminOrdersService(m1.fastify as any).getLedger({ kind: 'BREAD' })
      expect(m1.prisma.marketOrder.findMany).not.toHaveBeenCalled()
      expect(onlyBread.total).toBe(1)
      expect(onlyBread.rows.every((x) => x.kind === 'BREAD')).toBe(true)

      const m2 = makeMock({ orders: [makeOrder()], count: 1, marketOrders: [makeMarketOrder()], marketCount: 1 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onlyMarket = await new AdminOrdersService(m2.fastify as any).getLedger({ kind: 'CESTINHA' })
      expect(m2.prisma.order.findMany).not.toHaveBeenCalled()
      expect(onlyMarket.total).toBe(1)
      expect(onlyMarket.rows.every((x) => x.kind === 'CESTINHA')).toBe(true)
    })

    it('status só do mercadinho (PENDING_PAYMENT) não traz pedido de pão nenhum', async () => {
      // `OrderStatus` não tem PENDING_PAYMENT: passar esse valor no `in` do Order estouraria no
      // Prisma. O filtro por coleção evita isso E respeita a intenção (só Cestinhas).
      const { fastify, prisma } = makeMock({
        orders: [makeOrder()],
        count: 1,
        marketOrders: [makeMarketOrder({ status: 'PENDING_PAYMENT' })],
        marketCount: 1,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminOrdersService(fastify as any).getLedger({ status: ['PENDING_PAYMENT'] })
      expect(prisma.order.findMany).not.toHaveBeenCalled()
      expect(r.total).toBe(1)
      expect(r.rows[0].kind).toBe('CESTINHA')
    })

    it('pagina corretamente entre as DUAS coleções (busca skip+limit de cada lado)', async () => {
      // 3 pães (20, 18, 16/06) + 3 Cestinhas (21, 19, 17/06). Unido e ordenado desc:
      // mo-a(21) o-a(20) mo-b(19) o-b(18) mo-c(17) o-c(16).
      const build = () =>
        makeMock({
          orders: [
            makeOrder({ id: 'o-a', scheduledDate: new Date('2026-06-20T15:00:00.000Z') }),
            makeOrder({ id: 'o-b', scheduledDate: new Date('2026-06-18T15:00:00.000Z') }),
            makeOrder({ id: 'o-c', scheduledDate: new Date('2026-06-16T15:00:00.000Z') }),
          ],
          count: 3,
          marketOrders: [
            makeMarketOrder({ id: 'mo-a', scheduledDate: new Date('2026-06-21T15:00:00.000Z') }),
            makeMarketOrder({ id: 'mo-b', scheduledDate: new Date('2026-06-19T15:00:00.000Z') }),
            makeMarketOrder({ id: 'mo-c', scheduledDate: new Date('2026-06-17T15:00:00.000Z') }),
          ],
          marketCount: 3,
        })

      const p1 = build()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page1 = await new AdminOrdersService(p1.fastify as any).getLedger({ limit: 2, skip: 0 })
      expect(page1.total).toBe(6)
      expect(page1.rows.map((r) => r.marketOrderId || r.orderId)).toEqual(['mo-a', 'o-a'])
      expect(page1.hasMore).toBe(true)
      // Janela = skip + limit em CADA coleção (2), nunca `limit` por coleção.
      expect(p1.prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }))

      const p2 = build()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page2 = await new AdminOrdersService(p2.fastify as any).getLedger({ limit: 2, skip: 2 })
      expect(page2.rows.map((r) => r.marketOrderId || r.orderId)).toEqual(['mo-b', 'o-b'])
      expect(p2.prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 4 }))

      const p3 = build()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page3 = await new AdminOrdersService(p3.fastify as any).getLedger({ limit: 2, skip: 4 })
      expect(page3.rows.map((r) => r.marketOrderId || r.orderId)).toEqual(['mo-c', 'o-c'])
      expect(page3.hasMore).toBe(false)
    })

    it('total é a soma dos dois counts (não o de uma coleção só)', async () => {
      const { fastify } = makeMock({ orders: [makeOrder()], count: 7, marketOrders: [makeMarketOrder()], marketCount: 5 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminOrdersService(fastify as any).getLedger({ limit: 10 })
      expect(r.total).toBe(12)
      expect(r.hasMore).toBe(true) // 2 linhas devolvidas de 12
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

  describe('resolveStuckOrder', () => {
    // Um pedido parado costuma estar em SCHEDULED (nunca separado) — data no passado.
    const stuck = { id: 'o1', userId: 'u1', quantity: 4, status: 'SCHEDULED', scheduledDate: new Date('2026-06-20T15:00:00.000Z') }

    it('SCHEDULED → NOT_DELIVERED com estorno: aplica status, grava motivo e devolve pães', async () => {
      const { fastify, prisma } = makeMock({ order: { ...stuck }, existingRefund: null, creditBalanceAfter: 9 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminOrdersService(fastify as any).resolveStuckOrder('o1', 'admin-1', {
        outcome: 'NOT_DELIVERED',
        reason: 'cliente ausente',
        refundCredits: true,
      })
      expect(r).toEqual({ id: 'o1', status: 'NOT_DELIVERED', refundedCredits: 4, creditBalance: 9 })
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'NOT_DELIVERED', failureReason: 'cliente ausente' }) }),
      )
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'REFUND', quantity: 4, referenceId: 'o1' }) }),
      )
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { creditBalance: { increment: 4 } } }))
    })

    it('NOT_DELIVERED sem estorno: aplica status e NÃO devolve pães', async () => {
      const { fastify, prisma } = makeMock({ order: { ...stuck }, creditBalanceAfter: 5 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminOrdersService(fastify as any).resolveStuckOrder('o1', 'admin-1', {
        outcome: 'NOT_DELIVERED',
        reason: 'endereço',
        refundCredits: false,
      })
      expect(r.refundedCredits).toBe(0)
      expect(prisma.creditTransaction.create).not.toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('DELIVERED (retroativo): grava nota e ignora estorno mesmo com refundCredits=true', async () => {
      const { fastify, prisma } = makeMock({ order: { ...stuck }, creditBalanceAfter: 5 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminOrdersService(fastify as any).resolveStuckOrder('o1', 'admin-1', {
        outcome: 'DELIVERED',
        reason: 'entregue manualmente',
        refundCredits: true,
      })
      expect(r.status).toBe('DELIVERED')
      expect(r.refundedCredits).toBe(0)
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'DELIVERED', deliveryNote: 'entregue manualmente' }) }),
      )
      expect(prisma.creditTransaction.create).not.toHaveBeenCalled()
    })

    it('CANCELLED com estorno: aplica status e devolve pães', async () => {
      const { fastify, prisma } = makeMock({ order: { ...stuck }, existingRefund: null, creditBalanceAfter: 8 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminOrdersService(fastify as any).resolveStuckOrder('o1', 'admin-1', {
        outcome: 'CANCELLED',
        reason: 'duplicado',
        refundCredits: true,
      })
      expect(r).toMatchObject({ status: 'CANCELLED', refundedCredits: 4 })
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED', cancelReason: 'duplicado' }) }),
      )
    })

    it('idempotência: com estorno prévio não cria novo REFUND (refundedCredits=0)', async () => {
      const { fastify, prisma } = makeMock({ order: { ...stuck }, existingRefund: { id: 'tx-old' }, creditBalanceAfter: 4 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminOrdersService(fastify as any).resolveStuckOrder('o1', 'admin-1', {
        outcome: 'NOT_DELIVERED',
        reason: 'x',
        refundCredits: true,
      })
      expect(r.refundedCredits).toBe(0)
      expect(prisma.creditTransaction.create).not.toHaveBeenCalled()
    })

    it('lança 422 em transição inválida (pedido já terminal)', async () => {
      const { fastify } = makeMock({ order: { ...stuck, status: 'DELIVERED' } })
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new AdminOrdersService(fastify as any).resolveStuckOrder('o1', 'admin-1', { outcome: 'NOT_DELIVERED', reason: 'x', refundCredits: true }),
      ).rejects.toMatchObject({ statusCode: 422 })
    })

    it('lança 404 quando o pedido não existe', async () => {
      const { fastify } = makeMock({ order: null })
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new AdminOrdersService(fastify as any).resolveStuckOrder('x', 'admin-1', { outcome: 'DELIVERED' }),
      ).rejects.toMatchObject({ statusCode: 404 })
    })
  })
})
