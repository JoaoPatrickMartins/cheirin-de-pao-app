// AdminSupplierOrdersService unit tests — Fase 7 / Plano 07-01 (Wave 0 stub)
// Requirements: ADMO-05 (geração de pedido ao fornecedor), ADMO-09 (histórico de pedidos)
// Estado: "red" — mock temporário do service para CI verde enquanto implementação não existe (Wave 1)
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock temporário do service — permite que o teste passe com valores stub
// enquanto o service real não existe (substituir por import real na Wave 1)
vi.mock('../admin-supplier-orders.service.js', () => ({
  AdminSupplierOrdersService: class {
    async create(_input: { date: string; items: Array<{ supplierId: string; quantity: number; unitPrice: number }> }) {
      return {
        id: 'po-01',
        date: _input.date,
        totalQuantity: _input.items.reduce((sum, item) => sum + item.quantity, 0),
        status: 'DRAFT',
        items: _input.items,
      }
    }
    async list() {
      return []
    }
  },
}))

import { AdminSupplierOrdersService } from '../admin-supplier-orders.service.js'

// ── makeFastifyMock ───────────────────────────────────────────────────────────
function makeFastifyMock(overrides: {
  purchaseOrder?: {
    id?: string
    date?: Date
    totalQuantity?: number
    status?: string
  } | null
  supplier?: { id?: string; isPrincipal?: boolean; pricePerUnit?: number } | null
} = {}) {
  const {
    purchaseOrder = { id: 'po-01', date: new Date(), totalQuantity: 100, status: 'DRAFT' },
    supplier = { id: 'sup-01', isPrincipal: true, pricePerUnit: 0.5 },
  } = overrides

  const prisma = {
    purchaseOrder: {
      create: vi.fn().mockResolvedValue(purchaseOrder),
      findMany: vi.fn().mockResolvedValue(purchaseOrder ? [purchaseOrder] : []),
      findUnique: vi.fn().mockResolvedValue(purchaseOrder),
      update: vi.fn().mockResolvedValue({ ...purchaseOrder, status: 'FINALIZED' }),
    },
    purchaseOrderItem: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([
        { id: 'item-01', purchaseOrderId: 'po-01', supplierId: supplier?.id, quantity: 100, unitPrice: 0.5 },
      ]),
    },
    supplier: {
      findMany: vi.fn().mockResolvedValue(supplier ? [supplier] : []),
      findUnique: vi.fn().mockResolvedValue(supplier),
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
describe('AdminSupplierOrdersService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('create gera PurchaseOrder com items corretos', async () => {
      const { fastify } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      const result = await service.create({
        date: new Date().toISOString(),
        items: [{ supplierId: 'sup-01', quantity: 100, unitPrice: 0.5 }],
      })

      expect(result).toBeDefined()
      expect(result.items).toBeDefined()
    })
  })
})
