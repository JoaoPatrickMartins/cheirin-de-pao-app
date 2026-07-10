// AdminSeparationService unit tests — Fase A (board / toggle / conclude)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminSeparationService } from '../admin-separation.service.js'

// AdminSeparationService → AdminOrdersService → @onesignal/node-onesignal (mock no-op)
vi.mock('@onesignal/node-onesignal', () => ({
  createConfiguration: vi.fn().mockReturnValue({}),
  DefaultApi: vi.fn().mockImplementation(() => ({ createNotification: vi.fn().mockResolvedValue({}) })),
  Notification: vi.fn().mockImplementation(() => ({})),
}))

interface MockOpts {
  orders?: unknown[]
  users?: unknown[]
  condos?: unknown[]
  order?: unknown
  count?: number
  finalizedSlots?: string[]
}

function makeMock(opts: MockOpts = {}) {
  // Gate progressivo: getBoard só mostra turnos com COMPRA finalizada. Default cobre manhã+tarde.
  const finalizedSlots = opts.finalizedSlots ?? ['manha', 'tarde']
  const prisma = {
    purchaseOrder: {
      findMany: vi.fn().mockResolvedValue(finalizedSlots.map((slotId) => ({ slotId }))),
    },
    order: {
      findMany: vi.fn().mockResolvedValue(opts.orders ?? []),
      findUnique: vi.fn().mockResolvedValue(opts.order ?? null),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: opts.count ?? 0 }),
    },
    user: {
      findMany: vi.fn().mockResolvedValue(opts.users ?? []),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    condominium: { findMany: vi.fn().mockResolvedValue(opts.condos ?? []) },
    notification: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  }
  return {
    fastify: { prisma, log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } } as unknown,
    prisma,
  }
}

const SLOTS = [
  { slotId: 'manha', name: 'manha', label: 'Manhã', time: '06:30', cutoffTime: '22:00', isActive: true },
  { slotId: 'tarde', name: 'tarde', label: 'Tarde', time: '15:30', cutoffTime: '10:00', isActive: true },
]

describe('AdminSeparationService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getBoard', () => {
    it('agrupa por condomínio → turno e calcula contadores de separação', async () => {
      const orders = [
        { id: 'o1', userId: 'u1', quantity: 4, slotId: 'manha', type: 'SCHEDULED', condominiumId: 'c1', status: 'SCHEDULED' },
        { id: 'o2', userId: 'u2', quantity: 2, slotId: 'manha', type: 'SCHEDULED', condominiumId: 'c1', status: 'SEPARATED' },
        { id: 'o3', userId: 'u3', quantity: 6, slotId: 'tarde', type: 'SINGLE', condominiumId: 'c1', status: 'SCHEDULED' },
      ]
      const users = [
        { id: 'u1', name: 'Ana', apartment: '101', block: 'A' },
        { id: 'u2', name: 'Bia', apartment: '102', block: 'A' },
        { id: 'u3', name: 'Caio', apartment: '201', block: 'B' },
      ]
      const condos = [{ id: 'c1', name: 'Cond 1', deliverySlots: SLOTS }]

      const { fastify } = makeMock({ orders, users, condos })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const board = await new AdminSeparationService(fastify as any).getBoard('2026-06-26')

      expect(board.totalDeliveries).toBe(3)
      expect(board.separatedDeliveries).toBe(1)
      expect(board.totalBreads).toBe(12)
      expect(board.separatedBreads).toBe(2)
      expect(board.condominiums).toHaveLength(1)

      const condo = board.condominiums[0]
      expect(condo.slots).toHaveLength(2)
      const manha = condo.slots.find((s) => s.slotId === 'manha')!
      expect(manha.slotLabel).toBe('Manhã')
      expect(manha.totalDeliveries).toBe(2)
      expect(manha.separatedDeliveries).toBe(1)
      expect(manha.concluded).toBe(false)
      expect(manha.orders.map((o) => o.orderId)).toEqual(['o1', 'o2']) // bloco A, ap 101 antes de 102
    })

    it('marca concluded=true quando todos os pedidos do turno estão separados', async () => {
      const orders = [
        { id: 'o1', userId: 'u1', quantity: 4, slotId: 'manha', type: 'SCHEDULED', condominiumId: 'c1', status: 'SEPARATED' },
        { id: 'o2', userId: 'u2', quantity: 2, slotId: 'manha', type: 'SCHEDULED', condominiumId: 'c1', status: 'SEPARATED' },
      ]
      const users = [
        { id: 'u1', name: 'Ana', apartment: '101', block: 'A' },
        { id: 'u2', name: 'Bia', apartment: '102', block: 'A' },
      ]
      const condos = [{ id: 'c1', name: 'Cond 1', deliverySlots: SLOTS }]

      const { fastify } = makeMock({ orders, users, condos })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const board = await new AdminSeparationService(fastify as any).getBoard('2026-06-26')
      expect(board.condominiums[0].slots[0].concluded).toBe(true)
    })

    it('retorna board vazio quando não há pedidos', async () => {
      const { fastify } = makeMock({ orders: [] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const board = await new AdminSeparationService(fastify as any).getBoard()
      expect(board.condominiums).toEqual([])
      expect(board.totalDeliveries).toBe(0)
    })

    it('gate progressivo: não mostra turno cuja COMPRA não foi finalizada', async () => {
      const orders = [
        { id: 'o1', userId: 'u1', quantity: 4, slotId: 'manha', type: 'SCHEDULED', condominiumId: 'c1', status: 'SCHEDULED' },
      ]
      const users = [{ id: 'u1', name: 'Ana', apartment: '101', block: 'A' }]
      const condos = [{ id: 'c1', name: 'Cond 1', deliverySlots: SLOTS }]
      // Nenhuma compra finalizada → mesmo com pedidos materializados, board vazio
      const { fastify } = makeMock({ orders, users, condos, finalizedSlots: [] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const board = await new AdminSeparationService(fastify as any).getBoard('2026-06-27')
      expect(board.condominiums).toEqual([])
      expect(board.totalDeliveries).toBe(0)
    })
  })

  describe('setSeparated', () => {
    it('marca SCHEDULED → SEPARATED e registra separatedAt', async () => {
      const { fastify, prisma } = makeMock({ order: { id: 'o1', userId: 'u1', quantity: 3, status: 'SCHEDULED' } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminSeparationService(fastify as any).setSeparated('o1', true)
      expect(r.status).toBe('SEPARATED')
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'SEPARATED', separatedAt: expect.any(Date) } }),
      )
    })

    it('é idempotente quando o pedido já está no estado alvo', async () => {
      const { fastify, prisma } = makeMock({ order: { id: 'o1', userId: 'u1', quantity: 3, status: 'SEPARATED' } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminSeparationService(fastify as any).setSeparated('o1', true)
      expect(r.status).toBe('SEPARATED')
      expect(prisma.order.update).not.toHaveBeenCalled()
    })

    it('lança 404 quando o pedido não existe', async () => {
      const { fastify } = makeMock({ order: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(new AdminSeparationService(fastify as any).setSeparated('x', true)).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('lança 422 ao tentar separar um pedido já em rota (OUT_FOR_DELIVERY)', async () => {
      const { fastify } = makeMock({ order: { id: 'o1', userId: 'u1', quantity: 3, status: 'OUT_FOR_DELIVERY' } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(new AdminSeparationService(fastify as any).setSeparated('o1', true)).rejects.toMatchObject({
        statusCode: 422,
      })
    })
  })

  describe('conclude', () => {
    it('move os SCHEDULED do lote (condomínio+turno) para SEPARATED', async () => {
      const { fastify, prisma } = makeMock({ count: 5 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminSeparationService(fastify as any).conclude('c1', 'manha', '2026-06-26')
      expect(r.count).toBe(5)
      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ condominiumId: 'c1', slotId: 'manha', status: 'SCHEDULED' }),
          data: { status: 'SEPARATED', separatedAt: expect.any(Date) },
        }),
      )
    })

    it("traduz slotId '' para null (sem turno)", async () => {
      const { fastify, prisma } = makeMock({ count: 1 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await new AdminSeparationService(fastify as any).conclude('c1', '', '2026-06-26')
      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ slotId: null }) }),
      )
    })
  })
})
