// AdminOrdersService unit tests — 07-06 (dashboard, delivery-status, division-suggestion)
// Requirements: ADMO-01, ADMO-02, ADMO-03, ADMO-04, ADMO-10, ADMO-11
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminOrdersService } from '../admin-orders.service.js'

// ── makeDashboardFastifyMock ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeDashboardFastifyMock(overrides: Record<string, any> = {}) {
  const {
    orderAggregate = { _sum: { quantity: 42 } },
    paymentAggregate = { _sum: { amount: 180.5 } },
    clientCount = 15,
    condominiumCount = 3,
    deliverySlotsSetting = null,
    comboPaidPayments = [],
    avulsoPaidPayments = [],
  } = overrides

  const prisma = {
    order: {
      aggregate: vi.fn().mockResolvedValue(orderAggregate),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    // projectScheduleForDate (projeção de agenda) consulta schedule.findMany;
    // [] => projeção retorna 0 e não interfere nos contadores materializados.
    schedule: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    payment: {
      aggregate: vi.fn().mockResolvedValue(paymentAggregate),
      findMany: vi.fn().mockImplementation(({ where }: { where?: { comboId?: unknown } }) => {
        // Diferenciar chamadas: com comboId (combos) ou sem (avulso)
        if (where?.comboId !== undefined) {
          return Promise.resolve(comboPaidPayments)
        }
        return Promise.resolve(avulsoPaidPayments)
      }),
    },
    user: {
      count: vi.fn().mockResolvedValue(clientCount),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    condominium: {
      count: vi.fn().mockResolvedValue(condominiumCount),
      findMany: vi.fn().mockResolvedValue([]),
    },
    setting: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key === 'deliverySlots' ? deliverySlotsSetting : null),
      ),
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif-new' }),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({}),
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

// ── Mock OneSignal (necessário para importar AdminOrdersService) ──────────────
vi.mock('@onesignal/node-onesignal', () => {
  return {
    createConfiguration: vi.fn().mockReturnValue({}),
    DefaultApi: vi.fn().mockImplementation(() => ({ createNotification: vi.fn().mockResolvedValue({}) })),
    Notification: vi.fn().mockImplementation(() => ({
      app_id: '',
      include_subscription_ids: [],
      headings: {},
      contents: {},
    })),
  }
})

// ── Testes para getDashboard ──────────────────────────────────────────────────
describe('AdminOrdersService.getDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna breadsTodayCount como soma de quantity de Orders nao CANCELLED', async () => {
    const { fastify, prisma } = makeDashboardFastifyMock({
      orderAggregate: { _sum: { quantity: 42 } },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDashboard()

    expect(result.breadsTodayCount).toBe(42)
    expect(prisma.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: { quantity: true },
        where: expect.objectContaining({ status: { not: 'CANCELLED' } }),
      }),
    )
  })

  it('retorna breadsTodayCount = 0 quando aggregate retorna null', async () => {
    const { fastify } = makeDashboardFastifyMock({
      orderAggregate: { _sum: { quantity: null } },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDashboard()

    expect(result.breadsTodayCount).toBe(0)
  })

  it('retorna revenueToday como soma de amount em Payments PAID hoje', async () => {
    const { fastify } = makeDashboardFastifyMock({
      paymentAggregate: { _sum: { amount: 180.5 } },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDashboard()

    expect(result.revenueToday).toBe(180.5)
  })

  it('retorna clientsCount como contagem de Users com role CLIENT e isBlocked false', async () => {
    const { fastify } = makeDashboardFastifyMock({ clientCount: 15 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDashboard()

    expect(result.clientsCount).toBe(15)
  })

  it('retorna condominiumsCount como contagem de Condominiums ativos', async () => {
    const { fastify } = makeDashboardFastifyMock({ condominiumCount: 3 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDashboard()

    expect(result.condominiumsCount).toBe(3)
  })

  it('retorna deliverySlots da config global persistida (com cutoffTime por slot)', async () => {
    const custom = [
      { slotId: 'manha', name: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30', cutoffTime: '21:30', isActive: true },
      { slotId: 'tarde', name: 'tarde', label: 'Tarde', emoji: '🌙', time: '15:30', cutoffTime: '09:00', isActive: true },
    ]
    const { fastify } = makeDashboardFastifyMock({
      deliverySlotsSetting: { key: 'deliverySlots', value: JSON.stringify(custom) },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDashboard()

    expect(result.deliverySlots).toHaveLength(2)
    expect(result.deliverySlots.find((s) => s.slotId === 'manha')!.cutoffTime).toBe('21:30')
  })

  it('retorna deliverySlots default (manha 22:00 / tarde 10:00) quando config global nao existe', async () => {
    const { fastify } = makeDashboardFastifyMock({ deliverySlotsSetting: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDashboard()

    expect(result.deliverySlots.find((s) => s.slotId === 'manha')!.cutoffTime).toBe('22:00')
    expect(result.deliverySlots.find((s) => s.slotId === 'tarde')!.cutoffTime).toBe('10:00')
  })

  it('retorna estrutura com revenueByType com combos e avulso', async () => {
    const { fastify } = makeDashboardFastifyMock({
      comboPaidPayments: [{ amount: 90 }, { amount: 60 }],
      avulsoPaidPayments: [{ amount: 15 }, { amount: 15.5 }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDashboard()

    expect(result.revenueByType).toEqual(
      expect.objectContaining({
        combos: expect.any(Number),
        avulso: expect.any(Number),
      }),
    )
  })
})

// ── Testes para getDeliveryStatus ─────────────────────────────────────────────
describe('AdminOrdersService.getDeliveryStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('agrupa orders de hoje por condominiumId com contagem scheduled e delivered', async () => {
    const condominiumId = 'condo-01'
    const orders = [
      { id: 'order-1', condominiumId, status: 'SCHEDULED' },
      { id: 'order-2', condominiumId, status: 'DELIVERED' },
      { id: 'order-3', condominiumId, status: 'SCHEDULED' },
    ]

    const { fastify, prisma } = makeDashboardFastifyMock({})
    prisma.order.findMany.mockResolvedValue(orders)
    prisma.condominium.findMany.mockResolvedValue([
      { id: condominiumId, name: 'Residencial X' },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDeliveryStatus()

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(
      expect.objectContaining({
        condominiumId,
        condominiumName: 'Residencial X',
        scheduled: 3,
        delivered: 1,
        orderIds: expect.arrayContaining(['order-1', 'order-2', 'order-3']),
      }),
    )
  })

  it('retorna array vazio quando nao ha orders hoje', async () => {
    const { fastify, prisma } = makeDashboardFastifyMock({})
    prisma.order.findMany.mockResolvedValue([])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDeliveryStatus()

    expect(result).toEqual([])
  })

  it('inclui orderIds contendo todos os IDs do grupo', async () => {
    const condominiumId = 'condo-02'
    const orders = [
      { id: 'o-1', condominiumId, status: 'DELIVERED' },
      { id: 'o-2', condominiumId, status: 'SCHEDULED' },
    ]

    const { fastify, prisma } = makeDashboardFastifyMock({})
    prisma.order.findMany.mockResolvedValue(orders)
    prisma.condominium.findMany.mockResolvedValue([
      { id: condominiumId, name: 'Condominio Y' },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDeliveryStatus()

    expect(result[0].orderIds).toEqual(expect.arrayContaining(['o-1', 'o-2']))
    expect(result[0].orderIds).toHaveLength(2)
  })
})

// ── Testes para getDivisionSuggestion ─────────────────────────────────────────
describe('AdminOrdersService.getDivisionSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna array vazio quando nao ha entregadores ativos', async () => {
    const { fastify, prisma } = makeDashboardFastifyMock({})
    prisma.user.findMany.mockResolvedValue([]) // sem couriers

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDivisionSuggestion()

    expect(result).toEqual([])
  })

  it('retorna array vazio quando nao ha orders para amanha', async () => {
    const { fastify, prisma } = makeDashboardFastifyMock({})
    prisma.user.findMany.mockResolvedValue([
      { id: 'courier-01', name: 'Joao' },
    ])
    prisma.order.findMany.mockResolvedValue([])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDivisionSuggestion()

    expect(result).toEqual([])
  })

  it('algoritmo greedy aloca condominio ao entregador com menor total', async () => {
    const couriers = [
      { id: 'c-01', name: 'Joao' },
      { id: 'c-02', name: 'Maria' },
    ]
    // Dois condominios: 10 e 5 pães
    const orders = [
      { condominiumId: 'condo-A', quantity: 10 },
      { condominiumId: 'condo-A', quantity: 10 },
      { condominiumId: 'condo-B', quantity: 5 },
    ]

    const { fastify, prisma } = makeDashboardFastifyMock({})
    prisma.user.findMany.mockResolvedValue(couriers)
    prisma.order.findMany.mockResolvedValue(orders)
    prisma.condominium.findMany.mockResolvedValue([
      { id: 'condo-A', name: 'Condo A' },
      { id: 'condo-B', name: 'Condo B' },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDivisionSuggestion()

    expect(result).toHaveLength(2) // 2 entregadores
    // Verificar estrutura de cada item
    for (const courier of result) {
      expect(courier).toEqual(
        expect.objectContaining({
          courierId: expect.any(String),
          courierName: expect.any(String),
          condominiums: expect.any(Array),
          total: expect.any(Number),
        }),
      )
    }
    // Total combinado deve ser 25 (20 + 5)
    const totalAll = result.reduce((sum, c) => sum + c.total, 0)
    expect(totalAll).toBe(25)
  })

  it('retorna entregadores sem condominio quando ha mais entregadores que condominios', async () => {
    const { fastify, prisma } = makeDashboardFastifyMock({})
    prisma.user.findMany.mockResolvedValue([
      { id: 'c-01', name: 'Joao' },
      { id: 'c-02', name: 'Maria' },
    ])
    // Apenas 1 condominio para 2 entregadores
    prisma.order.findMany.mockResolvedValue([{ condominiumId: 'condo-A', quantity: 10 }])
    prisma.condominium.findMany.mockResolvedValue([{ id: 'condo-A', name: 'Condo A' }])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDivisionSuggestion()

    // Ambos os entregadores devem aparecer — o vazio serve de alvo p/ atribuicao manual
    expect(result).toHaveLength(2)
    const empty = result.find((c) => c.condominiums.length === 0)
    expect(empty).toBeDefined()
    expect(empty?.total).toBe(0)
  })

  it('retorna 1 entregador com todos os condominios quando ha apenas 1 entregador', async () => {
    const { fastify, prisma } = makeDashboardFastifyMock({})
    prisma.user.findMany.mockResolvedValue([{ id: 'c-01', name: 'Unico' }])
    prisma.order.findMany.mockResolvedValue([
      { condominiumId: 'condo-X', quantity: 8 },
      { condominiumId: 'condo-Y', quantity: 6 },
    ])
    prisma.condominium.findMany.mockResolvedValue([
      { id: 'condo-X', name: 'X' },
      { id: 'condo-Y', name: 'Y' },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminOrdersService(fastify as any)
    const result = await service.getDivisionSuggestion()

    expect(result).toHaveLength(1)
    expect(result[0].condominiums).toHaveLength(2)
    expect(result[0].total).toBe(14)
  })
})
