// Onda F4 — aviso ao admin de Cestinha nova. O gatilho é a CONFIRMAÇÃO do pagamento, não o
// checkout: antes disso o pedido pode morrer no sweep sem nunca entrar na operação. E como webhook
// Stripe, webhook Mercado Pago e o pull de reconciliação chegam ao mesmo pagamento, quem avisa é
// só quem ganha o claim da transição.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

const notifyAdmins = vi.fn().mockResolvedValue(undefined)
vi.mock('../../notifications/notifications.service.js', () => ({
  NotificationsService: class {
    constructor(_fastify: unknown) {}
    notifyAdmins = notifyAdmins
  },
}))

const updatePaymentStatus = vi.fn().mockResolvedValue({})
vi.mock('../payments.repository.js', () => ({
  PaymentsRepository: class {
    constructor(_fastify: unknown) {}
    updatePaymentStatus = updatePaymentStatus
  },
}))

import { fulfillMarketOrder } from '../fulfill-market-order.js'

const payment = { id: 'pay-1', userId: 'user-1' } as Parameters<typeof fulfillMarketOrder>[1]

const order = (over: Record<string, unknown> = {}) => ({
  id: 'mo-1',
  userId: 'user-1',
  status: 'PENDING_PAYMENT',
  breadQty: 4,
  items: [{ productId: 'p1', name: 'Bolo', qty: 2, unitPrice: 12 }],
  scheduledDate: new Date('2026-07-30T15:00:00.000Z'),
  ...over,
})

function mockFastify(found: Record<string, unknown> | null, claimCount = 1) {
  const updateMany = vi.fn().mockResolvedValue({ count: claimCount })
  const prisma = {
    marketOrder: { findFirst: vi.fn().mockResolvedValue(found), updateMany },
    user: {
      findUnique: vi.fn().mockResolvedValue({ name: 'Fulano', block: 'B', apartment: '101' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  }
  return {
    fastify: { prisma, log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } } as unknown as FastifyInstance,
    updateMany,
  }
}

describe('fulfillMarketOrder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('confirma a Cestinha e avisa os admins com pães e itens SEPARADOS (D-1)', async () => {
    const { fastify, updateMany } = mockFastify(order())
    await fulfillMarketOrder(fastify, payment)

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'mo-1', status: 'PENDING_PAYMENT' },
      data: { status: 'SCHEDULED' },
    })
    expect(notifyAdmins).toHaveBeenCalledTimes(1)
    const payload = notifyAdmins.mock.calls[0][0]
    expect(payload.type).toBe('ADMIN_ORDER_PLACED')
    expect(payload.title).toBe('Nova Cestinha')
    expect(payload.body).toContain('Fulano · Apto B 101')
    expect(payload.body).toContain('2 itens')
    expect(payload.body).toContain('4 🥖')
    expect(payload.body).toContain('30/07')
    expect(updatePaymentStatus).toHaveBeenCalledWith('pay-1', 'PAID')
  })

  it('claim perdido (outro webhook chegou primeiro) → marca PAID mas NÃO avisa de novo', async () => {
    const { fastify } = mockFastify(order(), 0)
    await fulfillMarketOrder(fastify, payment)

    expect(notifyAdmins).not.toHaveBeenCalled()
    expect(updatePaymentStatus).toHaveBeenCalledWith('pay-1', 'PAID')
  })

  it('pedido já SCHEDULED → nem tenta transicionar, nem avisa', async () => {
    const { fastify, updateMany } = mockFastify(order({ status: 'SCHEDULED' }))
    await fulfillMarketOrder(fastify, payment)

    expect(updateMany).not.toHaveBeenCalled()
    expect(notifyAdmins).not.toHaveBeenCalled()
  })

  it('pagamento sem Cestinha vinculada → só marca PAID', async () => {
    const { fastify } = mockFastify(null)
    await fulfillMarketOrder(fastify, payment)

    expect(notifyAdmins).not.toHaveBeenCalled()
    expect(updatePaymentStatus).toHaveBeenCalledWith('pay-1', 'PAID')
  })

  it('Cestinha só de pão (sem itens) → o corpo não inventa "0 itens"', async () => {
    const { fastify } = mockFastify(order({ items: [], breadQty: 6 }))
    await fulfillMarketOrder(fastify, payment)

    const body = notifyAdmins.mock.calls[0][0].body as string
    expect(body).toContain('6 🥖')
    expect(body).not.toContain('itens')
  })

  it('falha do aviso não impede o PAID (best-effort)', async () => {
    notifyAdmins.mockRejectedValueOnce(new Error('push fora'))
    const { fastify } = mockFastify(order())
    await expect(fulfillMarketOrder(fastify, payment)).resolves.toBeUndefined()
    expect(updatePaymentStatus).toHaveBeenCalledWith('pay-1', 'PAID')
  })
})
