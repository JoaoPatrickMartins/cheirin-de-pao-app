// AdminOrdersService unit tests — Fase 5 / Plano 05-01
// Requirements: ACOMP-01 (transições de status), ACOMP-03 (validação de transição),
//               ACOMP-05 (notificação push + persistência ao DELIVERED)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminOrdersService } from '../admin-orders.service.js'

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

// ── makeFastifyMock ───────────────────────────────────────────────────────────
function makeFastifyMock(overrides: {
  order?: {
    id?: string
    userId?: string
    quantity?: number
    status?: string
  } | null
  user?: { oneSignalPlayerId?: string | null } | null
  notificationCount?: number
} = {}) {
  const {
    order = { id: 'order-01', userId: 'user-01', quantity: 3, status: 'SCHEDULED' },
    user = { oneSignalPlayerId: null },
    notificationCount = 0,
  } = overrides

  // Gera array de N notificações simulando findMany para trim
  const makeNotifications = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `notif-${i + 1}` }))

  const prisma = {
    order: {
      findUnique: vi.fn().mockResolvedValue(order),
      update: vi.fn().mockResolvedValue({ ...order, status: 'OUT_FOR_DELIVERY' }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
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
describe('AdminOrdersService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateOrderStatus', () => {
    // Teste 1 (05-01): transição válida SCHEDULED → OUT_FOR_DELIVERY
    it('chama prisma.order.update quando transição SCHEDULED → OUT_FOR_DELIVERY é válida', async () => {
      const { fastify, prisma } = makeFastifyMock({
        order: { id: 'order-01', userId: 'user-01', quantity: 3, status: 'SCHEDULED' },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminOrdersService(fastify as any)
      await service.updateOrderStatus('order-01', 'OUT_FOR_DELIVERY')

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-01' },
          data: { status: 'OUT_FOR_DELIVERY' },
        }),
      )
    })

    // Teste 2 (05-01): transição reversa DELIVERED → SCHEDULED lança 422
    it('lança { statusCode: 422 } quando transição DELIVERED → SCHEDULED é inválida', async () => {
      const { fastify } = makeFastifyMock({
        order: { id: 'order-01', userId: 'user-01', quantity: 3, status: 'DELIVERED' },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminOrdersService(fastify as any)

      await expect(service.updateOrderStatus('order-01', 'SCHEDULED')).rejects.toMatchObject({
        statusCode: 422,
        message: expect.stringMatching(/Transição inválida/),
      })
    })

    // Teste 3 (05-01): transição inválida OUT_FOR_DELIVERY → OUT_FOR_DELIVERY lança 422
    it('lança { statusCode: 422 } quando transição OUT_FOR_DELIVERY → OUT_FOR_DELIVERY é inválida', async () => {
      const { fastify } = makeFastifyMock({
        order: { id: 'order-01', userId: 'user-01', quantity: 3, status: 'OUT_FOR_DELIVERY' },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminOrdersService(fastify as any)

      await expect(service.updateOrderStatus('order-01', 'OUT_FOR_DELIVERY')).rejects.toMatchObject({
        statusCode: 422,
      })
    })

    // Teste 4 (05-01): order não encontrada lança 404
    it('lança { statusCode: 404 } quando order não existe', async () => {
      const { fastify } = makeFastifyMock({ order: null })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminOrdersService(fastify as any)

      await expect(service.updateOrderStatus('id-inexistente', 'OUT_FOR_DELIVERY')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/não encontrado/),
      })
    })

    // Teste 5 (05-06): transição OUT_FOR_DELIVERY → DELIVERED chama prisma.notification.create
    it('chama prisma.notification.create quando transição para DELIVERED', async () => {
      const { fastify, prisma } = makeFastifyMock({
        order: { id: 'order-01', userId: 'user-01', quantity: 3, status: 'OUT_FOR_DELIVERY' },
        user: { oneSignalPlayerId: null },
        notificationCount: 0,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminOrdersService(fastify as any)
      await service.updateOrderStatus('order-01', 'DELIVERED')

      // Garante pelo menos uma chamada a prisma.notification.create
      expect(prisma.notification.create.mock.calls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('createAndTrim', () => {
    // Teste 6 (05-07): trim quando total > 30 — chama deleteMany com os IDs excedentes
    it('chama prisma.notification.deleteMany com IDs dos 2 mais antigos quando há 32 notificações', async () => {
      // Simula 32 notificações retornadas (após criar a nova, findMany retorna 32)
      const { fastify, prisma } = makeFastifyMock({ notificationCount: 32 })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminOrdersService(fastify as any)

      await service.createAndTrim({
        userId: 'user-01',
        type: 'DELIVERY_DONE',
        title: 'Entrega realizada',
        body: 'Seus 3 pães foram entregues. Bom apetite!',
        actionRoute: '/client/pedidos',
      })

      // Com 32 notificações, deleteMany deve ser chamado com os IDs das posições 30-31 (índices 30 e 31)
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: {
              in: ['notif-31', 'notif-32'],
            },
          },
        }),
      )
    })
  })
})
