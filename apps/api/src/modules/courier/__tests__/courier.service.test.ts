// CourierService unit tests — Fase 6 / Plano 06-01
// Requirements: COUR-01 (filtro por courierId), COUR-02 (confirmDelivery),
//               COUR-03 (getRoute graceful degradation), COUR-04 (ordenação)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CourierService } from '../courier.service.js'

// ── Mock OneSignal ────────────────────────────────────────────────────────────
vi.mock('@onesignal/node-onesignal', () => {
  const createNotificationMock = vi.fn().mockResolvedValue({})
  return {
    createConfiguration: vi.fn().mockReturnValue({}),
    DefaultApi: vi.fn().mockImplementation(() => ({ createNotification: createNotificationMock })),
    Notification: vi.fn().mockImplementation(() => ({
      app_id: '',
      include_subscription_ids: [],
      headings: {},
      contents: {},
    })),
    _createNotificationMock: createNotificationMock,
  }
})

// ── Mock fetch (Nominatim + OSRM) ────────────────────────────────────────────
vi.stubGlobal('fetch', vi.fn())

// ── makeFastifyMock ───────────────────────────────────────────────────────────
function makeFastifyMock(overrides: {
  orders?: Array<{
    id?: string
    userId?: string
    courierId?: string | null
    quantity?: number
    status?: string
    scheduledDate?: Date
    condominiumId?: string | null
    apartment?: string
    block?: string | null
  }>
  order?: {
    id?: string
    userId?: string
    courierId?: string | null
    quantity?: number
    status?: string
  } | null
  user?: { id?: string; name?: string; oneSignalPlayerId?: string | null } | null
  condominium?: {
    id?: string
    name?: string
    address?: string
  } | null
  notificationCount?: number
} = {}) {
  const {
    orders = [],
    order = { id: 'order-01', userId: 'user-01', courierId: 'courier-01', quantity: 3, status: 'SCHEDULED' },
    user = { id: 'user-01', name: 'Cliente Teste', oneSignalPlayerId: null },
    condominium = { id: 'condo-01', name: 'Condominio Teste', address: 'Rua Teste, 123' },
    notificationCount = 0,
  } = overrides

  const makeNotifications = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `notif-${i + 1}` }))

  const prisma = {
    order: {
      findMany: vi.fn().mockResolvedValue(orders),
      findUnique: vi.fn().mockResolvedValue(order),
      update: vi.fn().mockResolvedValue({ ...order, status: 'DELIVERED' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
    },
    condominium: {
      findUnique: vi.fn().mockResolvedValue(condominium),
    },
    // getGlobalDeliverySlots (rótulos de turno) consulta setting.findUnique;
    // null => usa DEFAULT_DELIVERY_SLOTS.
    setting: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif-new' }),
      findMany: vi.fn().mockResolvedValue(makeNotifications(notificationCount)),
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

// ── Testes ────────────────────────────────────────────────────────────────────
describe('CourierService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Comportamento 1 (COUR-01): getTodayOrders filtra por courierId do entregador logado
  describe('getTodayOrders — filtro por courierId', () => {
    it('retorna apenas ordens com courierId igual ao do entregador logado', async () => {
      const { fastify, prisma } = makeFastifyMock({
        orders: [
          {
            id: 'order-01',
            userId: 'user-01',
            courierId: 'courier-01',
            quantity: 3,
            status: 'SCHEDULED',
            scheduledDate: new Date(),
            condominiumId: 'condo-01',
            apartment: '101',
            block: null,
          },
        ],
      })

      // Mock Nominatim e OSRM
      const fetchMock = vi.mocked(fetch)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: '-23.5', lon: '-46.6' }],
      } as Response)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [{ distance: 5000, duration: 600, geometry: { coordinates: [] } }],
        }),
      } as Response)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)
      const result = await service.getTodayOrders('courier-01')

      // Verifica que prisma.order.findMany foi chamado com courierId
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            courierId: 'courier-01',
          }),
        }),
      )
      expect(result.totalStops).toBe(1)
    })
  })

  // Comportamento 2 (COUR-01): ordens sem courierId nao aparecem
  describe('getTodayOrders — ordens sem courierId excluidas', () => {
    it('retorna lista vazia quando nenhuma ordem esta atribuida ao entregador', async () => {
      const { fastify } = makeFastifyMock({ orders: [] })

      // Mock fetch para nao falhar
      const fetchMock = vi.mocked(fetch)
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ routes: [] }),
      } as Response)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)
      const result = await service.getTodayOrders('courier-01')

      expect(result.condos).toHaveLength(0)
      expect(result.totalStops).toBe(0)
    })
  })

  // Comportamento 3 (COUR-02): confirmDelivery com courierId diferente lanca 403
  describe('confirmDelivery — order de outro entregador retorna 403', () => {
    it('lanca { statusCode: 403 } quando order.courierId !== courierId do JWT', async () => {
      const { fastify } = makeFastifyMock({
        order: {
          id: 'order-01',
          userId: 'user-01',
          courierId: 'courier-OUTRO',
          quantity: 3,
          status: 'SCHEDULED',
        },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)

      await expect(service.confirmDelivery('order-01', 'courier-01')).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringMatching(/nao pertence|nao pertence/i),
      })
    })
  })

  // Comportamento 4 (COUR-02): confirmDelivery OUT_FOR_DELIVERY -> DELIVERED e transicao valida
  describe('confirmDelivery — transicao OUT_FOR_DELIVERY -> DELIVERED valida', () => {
    it('delega para AdminOrdersService.updateOrderStatus quando courierId bate', async () => {
      const { fastify, prisma } = makeFastifyMock({
        order: {
          id: 'order-01',
          userId: 'user-01',
          courierId: 'courier-01',
          quantity: 3,
          status: 'OUT_FOR_DELIVERY',
        },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)

      // Deve resolver sem lancar — AdminOrdersService chama prisma.order.update
      await expect(service.confirmDelivery('order-01', 'courier-01')).resolves.toBeUndefined()

      // Verifica que prisma.order.update foi chamado (via AdminOrdersService),
      // registrando também o marco deliveredAt (ciclo de vida v2)
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-01' },
          data: { status: 'DELIVERED', deliveredAt: expect.any(Date) },
        }),
      )
    })
  })

  // Comportamento 5 (COUR-03): getRoute retorna null quando OSRM lanca erro
  describe('getTodayOrders — getRoute retorna null quando OSRM falha', () => {
    it('seta route: null quando OSRM lanca erro (graceful degradation)', async () => {
      const { fastify } = makeFastifyMock({
        orders: [
          {
            id: 'order-01',
            userId: 'user-01',
            courierId: 'courier-01',
            quantity: 3,
            status: 'SCHEDULED',
            scheduledDate: new Date(),
            condominiumId: 'condo-01',
            apartment: '101',
            block: null,
          },
        ],
      })

      const fetchMock = vi.mocked(fetch)
      // Nominatim OK
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: '-23.5', lon: '-46.6' }],
      } as Response)
      // OSRM falha
      fetchMock.mockRejectedValueOnce(new Error('OSRM unavailable'))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)
      const result = await service.getTodayOrders('courier-01')

      expect(result.route).toBeNull()
    })
  })

  // Comportamento 6 (COUR-04): paradas ordenadas por apartamento numerico
  describe('getTodayOrders — paradas ordenadas por apartment numerico', () => {
    it('ordena paradas com sequencia 9 < 10 < 101', async () => {
      const { fastify } = makeFastifyMock({
        orders: [
          {
            id: 'order-101',
            userId: 'user-01',
            courierId: 'courier-01',
            quantity: 2,
            status: 'SCHEDULED',
            scheduledDate: new Date(),
            condominiumId: 'condo-01',
            apartment: '101',
            block: null,
          },
          {
            id: 'order-09',
            userId: 'user-02',
            courierId: 'courier-01',
            quantity: 1,
            status: 'SCHEDULED',
            scheduledDate: new Date(),
            condominiumId: 'condo-01',
            apartment: '9',
            block: null,
          },
          {
            id: 'order-10',
            userId: 'user-03',
            courierId: 'courier-01',
            quantity: 3,
            status: 'SCHEDULED',
            scheduledDate: new Date(),
            condominiumId: 'condo-01',
            apartment: '10',
            block: null,
          },
        ],
      })

      const fetchMock = vi.mocked(fetch)
      // Nominatim OK
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: '-23.5', lon: '-46.6' }],
      } as Response)
      // OSRM OK
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [{ distance: 5000, duration: 600, geometry: { coordinates: [] } }],
        }),
      } as Response)

      // Mock user findUnique com condominiumId e apartment corretos por usuario
      const prismaRef = (fastify as { prisma: typeof makeFastifyMock extends (...args: any[]) => { prisma: infer P } ? P : never }).prisma
      prismaRef.user.findUnique
        .mockResolvedValueOnce({ id: 'user-01', name: 'Cliente 101', condominiumId: 'condo-01', apartment: '101', block: null })
        .mockResolvedValueOnce({ id: 'user-02', name: 'Cliente 9', condominiumId: 'condo-01', apartment: '9', block: null })
        .mockResolvedValueOnce({ id: 'user-03', name: 'Cliente 10', condominiumId: 'condo-01', apartment: '10', block: null })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)
      const result = await service.getTodayOrders('courier-01')

      const stops = result.condos[0].stops
      expect(stops).toHaveLength(3)
      // Ordem numerica: 9 < 10 < 101
      expect(stops[0].apartment).toBe('9')
      expect(stops[1].apartment).toBe('10')
      expect(stops[2].apartment).toBe('101')
    })
  })

  describe('markNotDelivered', () => {
    it('marca NOT_DELIVERED com motivo quando o pedido é do entregador', async () => {
      const { fastify, prisma } = makeFastifyMock({
        order: { id: 'order-01', userId: 'user-01', courierId: 'courier-01', quantity: 3, status: 'OUT_FOR_DELIVERY' },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)
      await service.markNotDelivered('order-01', 'courier-01', 'Cliente ausente')

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'NOT_DELIVERED', failedAt: expect.any(Date), failureReason: 'Cliente ausente' },
        }),
      )
    })

    it('lança 403 quando o pedido não pertence ao entregador', async () => {
      const { fastify } = makeFastifyMock({
        order: { id: 'order-01', userId: 'user-01', courierId: 'outro-courier', quantity: 3, status: 'OUT_FOR_DELIVERY' },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)
      await expect(service.markNotDelivered('order-01', 'courier-01')).rejects.toMatchObject({ statusCode: 403 })
    })

    it('lança 404 quando o pedido não existe', async () => {
      const { fastify } = makeFastifyMock({ order: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)
      await expect(service.markNotDelivered('x', 'courier-01')).rejects.toMatchObject({ statusCode: 404 })
    })
  })
})
