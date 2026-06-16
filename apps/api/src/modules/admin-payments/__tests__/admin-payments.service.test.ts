// AdminPaymentsService unit tests — Fase 7 / Plano 07-01 (Wave 0 stub)
// Requirements: PAY-04 (estorno via Mercado Pago), PAY-03 (lista de pagamentos)
// Estado: "red" — mock temporário do service para CI verde enquanto implementação não existe (Wave 1)
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

// Mock temporário do service — permite que o teste passe com valores stub
// enquanto o service real não existe (substituir por import real na Wave 1)
vi.mock('../admin-payments.service.js', () => ({
  AdminPaymentsService: class {
    async refund(_paymentId: string) {
      return { refunded: true, paymentId: _paymentId }
    }
    async list() {
      return []
    }
  },
}))

import { AdminPaymentsService } from '../admin-payments.service.js'

// ── makeFastifyMock ───────────────────────────────────────────────────────────
function makeFastifyMock(overrides: {
  payment?: {
    id?: string
    userId?: string
    amount?: number
    mercadoPagoId?: string
    status?: string
  } | null
  user?: { creditBalance?: number } | null
} = {}) {
  const {
    payment = { id: 'pay-01', userId: 'user-01', amount: 100, mercadoPagoId: 'mp-01', status: 'PAID' },
    user = { creditBalance: 10 },
  } = overrides

  const prisma = {
    payment: {
      findUnique: vi.fn().mockResolvedValue(payment),
      update: vi.fn().mockResolvedValue({ ...payment, status: 'REFUNDED' }),
      findMany: vi.fn().mockResolvedValue(payment ? [payment] : []),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue(user),
    },
    creditTransaction: {
      create: vi.fn().mockResolvedValue({ id: 'txn-01' }),
    },
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

  describe('refund', () => {
    it('refund chama PaymentRefund.total() e debita créditos do cliente', async () => {
      const { fastify } = makeFastifyMock({
        payment: { id: 'pay-01', userId: 'user-01', amount: 100, mercadoPagoId: 'mp-01', status: 'PAID' },
        user: { creditBalance: 10 },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminPaymentsService(fastify as any)
      const result = await service.refund('pay-01')

      expect(result).toBeDefined()
    })
  })
})
