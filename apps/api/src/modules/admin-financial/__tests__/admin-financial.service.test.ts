// AdminFinancialService unit tests — Fase 7 / Plano 07-05 (Wave 1 — implementação real)
// Requirements: ADMF-01 (receita por período), ADMF-02 (por condomínio), ADMF-03 (por tipo)
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { AdminFinancialService } from '../admin-financial.service.js'

// ── makeFastifyMock ───────────────────────────────────────────────────────────
function makeFastifyMock(overrides: {
  aggregateTotal?: number
  aggregateCombos?: number
  aggregateAvulso?: number
  runCommandRaw?: unknown
} = {}) {
  const {
    aggregateTotal = 1500.0,
    aggregateCombos = 1000.0,
    aggregateAvulso = 500.0,
    runCommandRaw = { cursor: { firstBatch: [{ _id: 'condo-01', total: 1500 }] } },
  } = overrides

  const prisma = {
    payment: {
      aggregate: vi.fn()
        .mockResolvedValueOnce({ _sum: { amount: aggregateTotal } })   // total geral
        .mockResolvedValueOnce({ _sum: { amount: aggregateCombos } })  // combos
        .mockResolvedValueOnce({ _sum: { amount: aggregateAvulso } }), // avulso
    },
    condominium: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'condo-01', name: 'Residencial das Flores' },
      ]),
    },
    $runCommandRaw: vi.fn().mockResolvedValue(runCommandRaw),
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
    it('getRevenue retorna soma de Payment.amount WHERE status=PAID para period=day', async () => {
      const { fastify, prisma } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminFinancialService(fastify as any)
      const result = await service.getRevenue('day')

      expect(result).toBeDefined()
      expect(result.total).toBe(1500.0)
      // aggregate deve ter sido chamado com status=PAID
      expect(prisma.payment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          _sum: { amount: true },
          where: expect.objectContaining({ status: 'PAID' }),
        }),
      )
    })

    it('getRevenue retorna byType com combos e avulso separados', async () => {
      const { fastify } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminFinancialService(fastify as any)
      const result = await service.getRevenue('week')

      expect(result.byType).toBeDefined()
      expect(result.byType.combos).toBe(1000.0)
      expect(result.byType.avulso).toBe(500.0)
    })

    it('getRevenue retorna byCondominium com dados do $runCommandRaw', async () => {
      const { fastify } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminFinancialService(fastify as any)
      const result = await service.getRevenue('month')

      expect(result.byCondominium).toBeDefined()
      expect(Array.isArray(result.byCondominium)).toBe(true)
      expect(result.byCondominium.length).toBeGreaterThanOrEqual(1)
      expect(result.byCondominium[0]).toHaveProperty('condominiumId')
      expect(result.byCondominium[0]).toHaveProperty('total')
    })

    it('getRevenue aceita condominiumId opcional para filtrar', async () => {
      const { fastify, prisma } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminFinancialService(fastify as any)
      await service.getRevenue('day', 'condo-01')

      // $runCommandRaw deve ter sido chamado
      expect(prisma.$runCommandRaw).toHaveBeenCalled()
    })

    it('getRevenue retorna total=0 quando nao ha pagamentos PAID', async () => {
      const { fastify } = makeFastifyMock({
        aggregateTotal: 0,
        aggregateCombos: 0,
        aggregateAvulso: 0,
        runCommandRaw: { cursor: { firstBatch: [] } },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminFinancialService(fastify as any)
      const result = await service.getRevenue('day')

      expect(result.total).toBe(0)
      expect(result.byCondominium).toEqual([])
    })
  })
})
