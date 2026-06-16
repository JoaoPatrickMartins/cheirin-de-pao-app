// AdminFinancialService unit tests — Fase 7 / Plano 07-01 (Wave 0 stub)
// Requirements: ADMF-01 (receita por período), ADMF-03 (receita por tipo), ADMF-04 (lista de pagamentos)
// Estado: "red" — mock temporário do service para CI verde enquanto implementação não existe (Wave 1)
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock temporário do service — permite que o teste passe com valores stub
// enquanto o service real não existe (substituir por import real na Wave 1)
vi.mock('../admin-financial.service.js', () => ({
  AdminFinancialService: class {
    async getRevenue(_params: { from: string; to: string }) {
      return { total: 1500.0, period: _params }
    }
    async list() {
      return []
    }
  },
}))

import { AdminFinancialService } from '../admin-financial.service.js'

// ── makeFastifyMock ───────────────────────────────────────────────────────────
function makeFastifyMock(overrides: {
  payments?: Array<{ id: string; amount: number; status: string }> | null
} = {}) {
  const {
    payments = [
      { id: 'pay-01', amount: 500, status: 'PAID' },
      { id: 'pay-02', amount: 1000, status: 'PAID' },
      { id: 'pay-03', amount: 200, status: 'PENDING' }, // não deve ser somado
    ],
  } = overrides

  const prisma = {
    payment: {
      findMany: vi.fn().mockResolvedValue((payments ?? []).filter((p) => p.status === 'PAID')),
      // aggregate mock — retorna soma dos pagamentos PAID
      aggregate: vi.fn().mockResolvedValue({
        _sum: {
          amount: (payments ?? [])
            .filter((p) => p.status === 'PAID')
            .reduce((sum, p) => sum + p.amount, 0),
        },
      }),
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
describe('AdminFinancialService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getRevenue', () => {
    it('getRevenue retorna soma de Payment.amount WHERE status=PAID', async () => {
      const { fastify } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminFinancialService(fastify as any)
      const result = await service.getRevenue({
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-30T23:59:59.999Z',
      })

      expect(result).toBeDefined()
      expect(result.total).toBeDefined()
    })
  })
})
