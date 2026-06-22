// AdminPaymentsService unit tests — estorno via Stripe (PAY-04) + lista (PAY-03)
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock do StripeService (refund) ──────────────────────────────────────────
const mockRefund = vi.fn().mockResolvedValue({ id: 're_01', status: 'succeeded' })

vi.mock('../../payments/stripe.service.js', () => {
  class MockStripeService {
    constructor(_fastify: unknown) {}
    refund = mockRefund
  }
  return { StripeService: MockStripeService }
})

import { AdminPaymentsService } from '../admin-payments.service.js'

function makeFastifyMock(overrides: {
  payment?: {
    id?: string
    userId?: string
    amount?: number
    stripePaymentIntentId?: string | null
    status?: string
    comboId?: string | null
    customQuantity?: number | null
  } | null
  user?: { id?: string; creditBalance?: number } | null
  combo?: { quantity?: number } | null
  transactionResult?: unknown
} = {}) {
  const {
    payment = {
      id: 'pay-01',
      userId: 'user-01',
      amount: 100,
      stripePaymentIntentId: 'pi-01',
      status: 'PAID',
      comboId: 'combo-01',
      customQuantity: null,
    },
    user = { id: 'user-01', creditBalance: 10 },
    combo = { quantity: 5 },
    transactionResult = [{ id: 'pay-01', status: 'REFUNDED' }, { id: 'txn-01' }, { id: 'user-01' }],
  } = overrides

  const prisma = {
    payment: {
      findUnique: vi.fn().mockResolvedValue(payment),
      findMany: vi.fn().mockResolvedValue(payment ? [payment] : []),
      update: vi.fn().mockResolvedValue({ ...(payment ?? {}), status: 'REFUNDED' }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue({}),
    },
    combo: { findUnique: vi.fn().mockResolvedValue(combo) },
    creditTransaction: { create: vi.fn().mockResolvedValue({ id: 'txn-01' }) },
    $transaction: vi.fn().mockResolvedValue(transactionResult),
  }

  return {
    fastify: { prisma, log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } } as unknown,
    prisma,
  }
}

describe('AdminPaymentsService (Stripe)', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('list', () => {
    it('retorna array de pagamentos', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)
      const result = await service.list()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('refund', () => {
    it('chama stripe.refund() com o stripePaymentIntentId correto', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)
      await service.refund('pay-01')
      expect(mockRefund).toHaveBeenCalledWith('pi-01')
    })

    it('chama $transaction atomicamente (T-07-05-02)', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)
      await service.refund('pay-01')
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('lança 404 se pagamento não encontrado', async () => {
      const { fastify } = makeFastifyMock({ payment: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)
      await expect(service.refund('pay-x')).rejects.toMatchObject({ statusCode: 404 })
    })

    it('lança 400 se status não é PAID', async () => {
      const { fastify } = makeFastifyMock({
        payment: { id: 'pay-02', userId: 'user-01', amount: 100, stripePaymentIntentId: 'pi-02', status: 'REFUNDED', comboId: null, customQuantity: 5 },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)
      await expect(service.refund('pay-02')).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('estornado') })
    })

    it('lança 400 se stripePaymentIntentId é nulo (T-07-05-03)', async () => {
      const { fastify } = makeFastifyMock({
        payment: { id: 'pay-03', userId: 'user-01', amount: 100, stripePaymentIntentId: null, status: 'PAID', comboId: null, customQuantity: 5 },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)
      await expect(service.refund('pay-03')).rejects.toMatchObject({ statusCode: 400 })
      expect(mockRefund).not.toHaveBeenCalled()
    })

    it('debita Math.min(combo.quantity, creditBalance) e estorna no Stripe', async () => {
      const { fastify, prisma } = makeFastifyMock({
        payment: { id: 'pay-01', userId: 'user-01', amount: 100, stripePaymentIntentId: 'pi-01', status: 'PAID', comboId: 'combo-01', customQuantity: null },
        user: { id: 'user-01', creditBalance: 3 },
        combo: { quantity: 5 },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)
      await service.refund('pay-01')
      expect(mockRefund).toHaveBeenCalledWith('pi-01')
      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })
})
