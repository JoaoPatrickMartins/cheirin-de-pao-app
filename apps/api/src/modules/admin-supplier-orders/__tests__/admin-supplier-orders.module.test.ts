// admin-supplier-orders.module.test.ts — TDD RED: testa o service completo
// Requirements: ADMO-05, ADMO-06, ADMO-07, ADMO-08, ADMO-09
// Estado: "red" — service real ainda não existe neste momento do TDD

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Helper para criar mock do Fastify com Prisma
function makeFastifyMock(overrides: {
  purchaseOrder?: Record<string, unknown> | null
  purchaseOrderItems?: Record<string, unknown>[]
  supplier?: Record<string, unknown> | null
  condominium?: Record<string, unknown> | null
  order?: Record<string, unknown>[]
} = {}) {
  const {
    purchaseOrder = {
      id: 'po-01',
      date: new Date(),
      totalQuantity: 100,
      cutoffTime: new Date(),
      status: 'DRAFT',
    },
    purchaseOrderItems = [
      { id: 'item-01', purchaseOrderId: 'po-01', supplierId: 'sup-01', quantity: 100, unitPrice: 0.5 },
    ],
    supplier = { id: 'sup-01', name: 'Padaria Central', isPrincipal: true, pricePerUnit: 0.5 },
    condominium = { id: 'condo-01', name: 'Residencial Aurora' },
    order = [
      { id: 'ord-01', userId: 'user-01', quantity: 50, condominiumId: 'condo-01', scheduledDate: new Date() },
      { id: 'ord-02', userId: 'user-02', quantity: 30, condominiumId: 'condo-01', scheduledDate: new Date() },
    ],
  } = overrides

  const prisma = {
    purchaseOrder: {
      create: vi.fn().mockResolvedValue(purchaseOrder),
      findMany: vi.fn().mockResolvedValue(purchaseOrder ? [purchaseOrder] : []),
      findUnique: vi.fn().mockResolvedValue(purchaseOrder),
      update: vi.fn().mockResolvedValue({ ...purchaseOrder, status: 'FINALIZED' }),
    },
    purchaseOrderItem: {
      createMany: vi.fn().mockResolvedValue({ count: purchaseOrderItems.length }),
      findMany: vi.fn().mockResolvedValue(purchaseOrderItems),
    },
    supplier: {
      findMany: vi.fn().mockResolvedValue(supplier ? [supplier] : []),
      findUnique: vi.fn().mockResolvedValue(supplier),
    },
    condominium: {
      findUnique: vi.fn().mockResolvedValue(condominium),
    },
    order: {
      findMany: vi.fn().mockResolvedValue(order),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
      if (typeof fn === 'function') {
        return fn({
          purchaseOrder: {
            create: vi.fn().mockResolvedValue(purchaseOrder),
          },
          purchaseOrderItem: {
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        })
      }
      // Array mode
      return Promise.all((fn as unknown as Promise<unknown>[]).map((p) => p))
    }),
  }

  return {
    fastify: {
      prisma,
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    } as unknown,
    prisma,
  }
}

// ── Import service após mocks ─────────────────────────────────────────────────
// O service real será importado quando existir — sem vi.mock (TDD real)
import { AdminSupplierOrdersService } from '../admin-supplier-orders.service.js'

// ── Testes ────────────────────────────────────────────────────────────────────
describe('AdminSupplierOrdersService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getDraft', () => {
    it('retorna lista de condominios com totais de paes para o dia seguinte', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      const result = await service.getDraft()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('create', () => {
    it('cria PurchaseOrder DRAFT com items em $transaction', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      const result = await service.create({
        items: [{ supplierId: 'sup-01', quantity: 100 }],
      })
      expect(result).toBeDefined()
      expect(result.id).toBeDefined()
      // $transaction deve ter sido chamado para atomicidade
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('retorna id do PurchaseOrder criado', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      const result = await service.create({
        items: [{ supplierId: 'sup-01', quantity: 50 }],
      })
      expect(result.id).toBe('po-01')
    })
  })

  describe('finalize', () => {
    it('muda status para FINALIZED', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      await service.finalize('po-01')
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'po-01' },
          data: { status: 'FINALIZED' },
        }),
      )
    })

    it('lanca 404 se PurchaseOrder nao existe', async () => {
      const { fastify } = makeFastifyMock({ purchaseOrder: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      await expect(service.finalize('po-nao-existe')).rejects.toMatchObject({ statusCode: 404 })
    })

    it('lanca 400 se status ja e FINALIZED', async () => {
      const { fastify } = makeFastifyMock({
        purchaseOrder: { id: 'po-01', date: new Date(), totalQuantity: 100, cutoffTime: new Date(), status: 'FINALIZED' },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      await expect(service.finalize('po-01')).rejects.toMatchObject({ statusCode: 400 })
    })
  })

  describe('getHistory', () => {
    it('retorna lista de PurchaseOrders FINALIZED', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      await service.getHistory()
      expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'FINALIZED' },
        }),
      )
    })
  })

  describe('getPdfBuffer', () => {
    it('retorna Buffer maior que 0', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      const buf = await service.getPdfBuffer('po-01')
      expect(buf).toBeInstanceOf(Buffer)
      expect(buf.length).toBeGreaterThan(0)
    })
  })

  describe('getExcelBuffer', () => {
    it('retorna Buffer maior que 0', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      const buf = await service.getExcelBuffer('po-01')
      expect(buf).toBeInstanceOf(Buffer)
      expect(buf.length).toBeGreaterThan(0)
    })
  })
})
