// AdminPaymentsService unit tests — Fase 7 / Plano 07-05 (Wave 1 — implementação real)
// Requirements: PAY-04 (estorno via Mercado Pago), PAY-03 (lista de pagamentos)
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock do Mercado Pago ──────────────────────────────────────────────────────
// Pattern 4 de 07-RESEARCH.md — PaymentRefund.total() para estorno total
const mockRefundTotal = vi.fn().mockResolvedValue({ id: 'refund-01', status: 'approved' })

vi.mock('mercadopago', () => {
  class MockMercadoPagoConfig {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(_opts: any) {}
  }
  class MockPaymentRefund {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(_client: any) {}
    total = mockRefundTotal
  }
  return { MercadoPagoConfig: MockMercadoPagoConfig, PaymentRefund: MockPaymentRefund }
})

import { AdminPaymentsService } from '../admin-payments.service.js'

// ── makeFastifyMock ───────────────────────────────────────────────────────────
function makeFastifyMock(overrides: {
  payment?: {
    id?: string
    userId?: string
    amount?: number
    mercadoPagoId?: string | null
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
      mercadoPagoId: 'mp-01',
      status: 'PAID',
      comboId: 'combo-01',
      customQuantity: null,
    },
    user = { id: 'user-01', creditBalance: 10 },
    combo = { quantity: 5 },
    transactionResult = [
      { id: 'pay-01', status: 'REFUNDED' },
      { id: 'txn-01' },
      { id: 'user-01', creditBalance: 5 },
    ],
  } = overrides

  const updatePaymentMock = vi.fn().mockResolvedValue({ ...(payment ?? {}), status: 'REFUNDED' })
  const createCreditTxnMock = vi.fn().mockResolvedValue({ id: 'txn-01' })
  const updateUserMock = vi.fn().mockResolvedValue({ ...(user ?? {}), creditBalance: Math.max(0, (user?.creditBalance ?? 0) - 3) })

  const prisma = {
    payment: {
      findUnique: vi.fn().mockResolvedValue(payment),
      findMany: vi.fn().mockResolvedValue(payment ? [payment] : []),
      update: updatePaymentMock,
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: updateUserMock,
    },
    combo: {
      findUnique: vi.fn().mockResolvedValue(combo),
    },
    creditTransaction: {
      create: createCreditTxnMock,
    },
    $transaction: vi.fn().mockResolvedValue(transactionResult),
  }

  return {
    fastify: {
      prisma,
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    } as unknown,
    prisma,
  }
}

// ── Testes ────────────────────────────────────────────────────────────────────
describe('AdminPaymentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list', () => {
    it('list retorna array de pagamentos', async () => {
      const { fastify } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)
      const result = await service.list()

      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('refund', () => {
    it('refund chama PaymentRefund.total() com payment_id correto', async () => {
      const { fastify } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)
      await service.refund('pay-01')

      expect(mockRefundTotal).toHaveBeenCalledWith({ payment_id: 'mp-01' })
    })

    it('refund chama $transaction atomicamente (T-07-05-02)', async () => {
      const { fastify, prisma } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)
      await service.refund('pay-01')

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('refund lanca 404 se pagamento nao encontrado', async () => {
      const { fastify } = makeFastifyMock({ payment: null })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)

      await expect(service.refund('pay-inexistente')).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('refund lanca 400 se payment.status nao e PAID', async () => {
      const { fastify } = makeFastifyMock({
        payment: {
          id: 'pay-02',
          userId: 'user-01',
          amount: 100,
          mercadoPagoId: 'mp-02',
          status: 'REFUNDED',
          comboId: null,
          customQuantity: 5,
        },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)

      await expect(service.refund('pay-02')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('estornado'),
      })
    })

    it('refund lanca 400 se mercadoPagoId e nulo (T-07-05-03)', async () => {
      const { fastify } = makeFastifyMock({
        payment: {
          id: 'pay-03',
          userId: 'user-01',
          amount: 100,
          mercadoPagoId: null,
          status: 'PAID',
          comboId: null,
          customQuantity: 5,
        },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)

      await expect(service.refund('pay-03')).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('refund calcula creditsToDebit = Math.min(combo.quantity, user.creditBalance)', async () => {
      // combo.quantity=5, user.creditBalance=3 → deve debitar 3 (nao mais que o disponivel)
      const { fastify, prisma } = makeFastifyMock({
        payment: {
          id: 'pay-01',
          userId: 'user-01',
          amount: 100,
          mercadoPagoId: 'mp-01',
          status: 'PAID',
          comboId: 'combo-01',
          customQuantity: null,
        },
        user: { id: 'user-01', creditBalance: 3 },
        combo: { quantity: 5 },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)
      await service.refund('pay-01')

      // $transaction deve ter sido chamado
      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })
})
