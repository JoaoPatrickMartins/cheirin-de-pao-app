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
  schedule?: Record<string, unknown>[]
  users?: Record<string, unknown>[]
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
    condominium = { id: 'condo-01', name: 'Residencial Aurora', deliverySlots: [] },
    order = [
      { id: 'ord-01', userId: 'user-01', quantity: 50, condominiumId: 'condo-01', scheduledDate: new Date(), type: 'SINGLE', slotId: 'manha' },
      { id: 'ord-02', userId: 'user-02', quantity: 30, condominiumId: 'condo-01', scheduledDate: new Date(), type: 'SCHEDULED', slotId: 'tarde' },
    ],
    schedule = [],
    users = [
      { id: 'user-01', name: 'Ana Lima', apartment: '102', block: 'A', creditBalance: 100, isBlocked: false },
      { id: 'user-02', name: 'Bruno Sá', apartment: '204', block: 'B', creditBalance: 100, isBlocked: false },
    ],
  } = overrides

  const prisma = {
    purchaseOrder: {
      create: vi.fn().mockResolvedValue(purchaseOrder),
      findMany: vi.fn().mockResolvedValue(purchaseOrder ? [purchaseOrder] : []),
      findUnique: vi.fn().mockResolvedValue(purchaseOrder),
      findFirst: vi.fn().mockResolvedValue(null),
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
      findMany: vi.fn().mockResolvedValue(condominium ? [condominium] : []),
    },
    order: {
      // Honra o filtro por turno (where.slotId) — pipeline por slot.
      findMany: vi.fn().mockImplementation(({ where }: { where?: { slotId?: string } } = {}) => {
        const slotId = where?.slotId
        return Promise.resolve(slotId ? order.filter((o) => o.slotId === slotId) : order)
      }),
    },
    user: {
      findMany: vi.fn().mockResolvedValue(users),
    },
    // projectScheduleDetailForDate (projeção de agenda) consulta schedule.findMany.
    schedule: {
      findMany: vi.fn().mockResolvedValue(schedule),
    },
    // _resolveSlot lê a config global de slots (Setting). null → DEFAULT_DELIVERY_SLOTS.
    setting: {
      findUnique: vi.fn().mockResolvedValue(null),
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

  describe('getDraft (por turno)', () => {
    it('retorna apenas o turno solicitado (manhã)', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      const result = await service.getDraft('manha')
      const condo = result.find((c) => c.condominiumId === 'condo-01')!
      expect(condo).toBeDefined()
      // só ord-01 (manha, 50) — a tarde NÃO entra no corte da manhã
      expect(condo.totalBreads).toBe(50)
      expect(condo.deliveryCount).toBe(1)
      expect(condo.riskCount).toBe(0)
    })

    it('separa manhã e tarde em prévias distintas', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      const tarde = await service.getDraft('tarde')
      const condo = tarde.find((c) => c.condominiumId === 'condo-01')!
      expect(condo.totalBreads).toBe(30)
      expect(condo.deliveryCount).toBe(1)
    })
  })

  describe('getCondominiumDetail (por turno)', () => {
    it('detalha apenas as entregas do turno solicitado', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      const detail = await service.getCondominiumDetail('condo-01', 'manha')

      expect(detail.name).toBe('Residencial Aurora')
      expect(detail.materializedBreads).toBe(50)
      expect(detail.deliveries).toHaveLength(1)
      const ana = detail.deliveries.find((d) => d.name === 'Ana Lima')!
      expect(ana).toMatchObject({ apartment: '102', block: 'A', type: 'SINGLE', source: 'order', risk: '' })
    })

    it('marca risco no-credit para previsto sem saldo suficiente', async () => {
      const { fastify } = makeFastifyMock({
        order: [],
        schedule: [
          { userId: 'user-03', condominiumId: 'condo-01', days: { manha: { seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 8, dom: 8 } } },
        ],
        users: [{ id: 'user-03', name: 'Rafael Pinto', apartment: '301', block: 'A', creditBalance: 2, isBlocked: false }],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      const detail = await service.getCondominiumDetail('condo-01', 'manha')

      expect(detail.projectedBreads).toBe(8)
      expect(detail.riskCount).toBe(1)
      const raf = detail.deliveries.find((d) => d.name === 'Rafael Pinto')!
      expect(raf.source).toBe('projected')
      expect(raf.risk).toBe('no-credit')
    })

    it('marca risco blocked para cliente bloqueado (turno tarde)', async () => {
      const { fastify } = makeFastifyMock({
        order: [],
        schedule: [
          { userId: 'user-04', condominiumId: 'condo-01', days: { tarde: { seg: 4, ter: 4, qua: 4, qui: 4, sex: 4, sab: 4, dom: 4 } } },
        ],
        users: [{ id: 'user-04', name: 'Tânia Freitas', apartment: '405', block: 'B', creditBalance: 999, isBlocked: true }],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      const detail = await service.getCondominiumDetail('condo-01', 'tarde')

      const tania = detail.deliveries.find((d) => d.name === 'Tânia Freitas')!
      expect(tania.risk).toBe('blocked')
      expect(detail.riskCount).toBe(1)
    })
  })

  describe('getSlotsStatus', () => {
    it('retorna estado por turno: tem pedidos e não finalizado', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slots = await new AdminSupplierOrdersService(fastify as any).getSlotsStatus()
      expect(slots.length).toBe(2) // manha + tarde (default)
      const manha = slots.find((s) => s.slotId === 'manha')!
      expect(manha.hasOrders).toBe(true) // ord-01 (manha) materializado
      expect(manha.generated).toBe(false) // nenhuma compra finalizada (findFirst → null)
      expect(typeof manha.deliveryDate).toBe('string')
      expect(manha.deliveryDate.length).toBeGreaterThan(0)
    })
  })

  describe('create (por turno)', () => {
    it('cria PurchaseOrder do turno em $transaction', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      const result = await service.create({
        items: [{ supplierId: 'sup-01', quantity: 100 }],
        slotId: 'manha',
      })
      expect(result).toBeDefined()
      expect(result.id).toBeDefined()
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('retorna id do PurchaseOrder criado', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSupplierOrdersService(fastify as any)
      const result = await service.create({
        items: [{ supplierId: 'sup-01', quantity: 50 }],
        slotId: 'manha',
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
