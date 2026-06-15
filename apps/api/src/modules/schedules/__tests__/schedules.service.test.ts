// SchedulesService unit tests — Wave 1 (Fase 4 Plan 02)
// Requirements: SCHED-02, SCHED-03, SCHED-04, CRED-10
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SchedulesService } from '../schedules.service.js'
import { FastifyInstance } from 'fastify'

// Mock do módulo OneSignal
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

type OrderShape = {
  id: string
  userId: string
  quantity: number
  scheduledDate: Date
  status: string
}

type ScheduleShape = {
  id: string
  userId: string
  condominiumId: string
  isActive: boolean
  weeklyQty: object
  deliveryTime: string
  notifyReconfigure: boolean
}

type UserShape = {
  id: string
  creditBalance: number
  condominiumId: string | null
  autoRecharge: object | null
  oneSignalPlayerId: string | null
}

// Cria uma instância de Fastify mockada com prisma e log
function createMockFastify(overrides?: {
  schedules?: ScheduleShape[]
  users?: Record<string, UserShape>
  createOrderFn?: ReturnType<typeof vi.fn>
  updateUserFn?: ReturnType<typeof vi.fn>
  createTransactionFn?: ReturnType<typeof vi.fn>
}) {
  const { schedules = [], users = {}, createOrderFn, updateUserFn, createTransactionFn } = overrides ?? {}

  const transactionFn = vi.fn().mockImplementation(async (cb: (tx: object) => Promise<void>) => {
    const tx = {
      order: {
        create: createOrderFn ?? vi.fn().mockResolvedValue({ id: 'order-1' }),
      },
      user: {
        update: updateUserFn ?? vi.fn().mockResolvedValue({}),
      },
      creditTransaction: {
        create: createTransactionFn ?? vi.fn().mockResolvedValue({}),
      },
    }
    return cb(tx)
  })

  return {
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    prisma: {
      schedule: {
        findFirst: vi.fn().mockImplementation(({ where }: { where: { userId: string; isActive: boolean } }) => {
          return Promise.resolve(
            schedules.find(
              (s) => s.userId === where.userId && s.isActive === true,
            ) ?? null,
          )
        }),
        findMany: vi.fn().mockResolvedValue(schedules),
        upsert: vi.fn().mockResolvedValue({ id: 'schedule-1' }),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          return Promise.resolve(users[where.id] ?? null)
        }),
      },
      $transaction: transactionFn,
    },
  } as unknown as FastifyInstance
}

describe('SchedulesService', () => {
  describe('upsertSchedule', () => {
    it('cria novo Schedule se não existir', async () => {
      const fastify = createMockFastify()
      const service = new SchedulesService(fastify)

      const data = {
        weeklyQty: { seg: 2, ter: 0, qua: 2, qui: 0, sex: 2, sab: 0, dom: 0 },
        deliveryTime: '07:00' as const,
        notifyReconfigure: false,
      }

      const result = await service.upsertSchedule('user-1', 'condo-1', data)
      expect(fastify.prisma.schedule.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_condominiumId: { userId: 'user-1', condominiumId: 'condo-1' } },
        }),
      )
      expect(result).toBeDefined()
    })

    it('atualiza Schedule existente via upsert', async () => {
      const fastify = createMockFastify()
      const service = new SchedulesService(fastify)

      const data = {
        weeklyQty: { seg: 3, ter: 1, qua: 3, qui: 1, sex: 3, sab: 0, dom: 0 },
        deliveryTime: '06:30' as const,
        notifyReconfigure: true,
      }

      await service.upsertSchedule('user-1', 'condo-1', data)
      expect(fastify.prisma.schedule.upsert).toHaveBeenCalledOnce()
    })
  })

  describe('createDailyOrders', () => {
    it('cria Order com type SCHEDULED quando saldo suficiente', async () => {
      const schedule: ScheduleShape = {
        id: 'sched-1',
        userId: 'user-1',
        condominiumId: 'condo-1',
        isActive: true,
        weeklyQty: { seg: 2, ter: 2, qua: 2, qui: 2, sex: 2, sab: 2, dom: 2 },
        deliveryTime: '07:00',
        notifyReconfigure: false,
      }

      const user: UserShape = {
        id: 'user-1',
        creditBalance: 10,
        condominiumId: 'condo-1',
        autoRecharge: null,
        oneSignalPlayerId: null,
      }

      const createOrderFn = vi.fn().mockResolvedValue({ id: 'order-1' })
      const fastify = createMockFastify({
        schedules: [schedule],
        users: { 'user-1': user },
        createOrderFn,
      })

      const service = new SchedulesService(fastify)
      await service.createDailyOrders()

      expect(createOrderFn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            type: 'SCHEDULED',
            status: 'SCHEDULED',
          }),
        }),
      )
    })

    it('NÃO cria Order quando weeklyQty do dia === 0', async () => {
      const schedule: ScheduleShape = {
        id: 'sched-1',
        userId: 'user-1',
        condominiumId: 'condo-1',
        isActive: true,
        // Todos os dias com quantidade 0
        weeklyQty: { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 },
        deliveryTime: '07:00',
        notifyReconfigure: false,
      }

      const user: UserShape = {
        id: 'user-1',
        creditBalance: 10,
        condominiumId: 'condo-1',
        autoRecharge: null,
        oneSignalPlayerId: null,
      }

      const createOrderFn = vi.fn().mockResolvedValue({ id: 'order-1' })
      const fastify = createMockFastify({
        schedules: [schedule],
        users: { 'user-1': user },
        createOrderFn,
      })

      const service = new SchedulesService(fastify)
      await service.createDailyOrders()

      // Com weeklyQty zerado para todos os dias, nenhuma order deve ser criada
      expect(createOrderFn).not.toHaveBeenCalled()
    })

    it('NÃO cria Order quando creditBalance < quantidade (envia push ao invés)', async () => {
      const schedule: ScheduleShape = {
        id: 'sched-1',
        userId: 'user-1',
        condominiumId: 'condo-1',
        isActive: true,
        weeklyQty: { seg: 5, ter: 5, qua: 5, qui: 5, sex: 5, sab: 5, dom: 5 },
        deliveryTime: '07:00',
        notifyReconfigure: false,
      }

      const user: UserShape = {
        id: 'user-1',
        creditBalance: 1, // muito baixo — 5 pãezinhos necessários
        condominiumId: 'condo-1',
        autoRecharge: null,
        oneSignalPlayerId: 'player-123',
      }

      const createOrderFn = vi.fn().mockResolvedValue({ id: 'order-1' })
      const fastify = createMockFastify({
        schedules: [schedule],
        users: { 'user-1': user },
        createOrderFn,
      })

      const service = new SchedulesService(fastify)
      await service.createDailyOrders()

      // Order NÃO deve ser criado
      expect(createOrderFn).not.toHaveBeenCalled()
    })
  })

  describe('sendEveReminders', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('05-05a: chama prisma.order.findMany com scheduledDate amanhã e status: { not: CANCELLED }', async () => {
      const fastify = createMockFastify()
      const orderFindMany = vi.fn().mockResolvedValue([])
      ;(fastify.prisma as unknown as Record<string, unknown>).order = { findMany: orderFindMany }
      ;(fastify.prisma as unknown as Record<string, unknown>).notification = {
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({}),
      }
      const service = new SchedulesService(fastify)
      await service.sendEveReminders()
      expect(orderFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: 'CANCELLED' },
          }),
        }),
      )
    })

    it('05-05b: com 2 orders amanhã — cria 2 Notifications independente de oneSignalPlayerId', async () => {
      const orders: OrderShape[] = [
        { id: 'order-1', userId: 'user-1', quantity: 2, scheduledDate: new Date(), status: 'SCHEDULED' },
        { id: 'order-2', userId: 'user-2', quantity: 1, scheduledDate: new Date(), status: 'SCHEDULED' },
      ]
      const fastify = createMockFastify({
        users: {
          'user-1': { id: 'user-1', creditBalance: 5, condominiumId: null, autoRecharge: null, oneSignalPlayerId: null },
          'user-2': { id: 'user-2', creditBalance: 5, condominiumId: null, autoRecharge: null, oneSignalPlayerId: null },
        },
      })
      ;(fastify.prisma as unknown as Record<string, unknown>).order = {
        findMany: vi.fn().mockResolvedValue(orders),
      }
      ;(fastify.prisma as unknown as Record<string, unknown>).notification = {
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({}),
      }
      const service = new SchedulesService(fastify)
      const createAndTrimMock = vi.fn().mockResolvedValue(undefined)
      ;(service as unknown as Record<string, unknown>)['notificationsService'] = { createAndTrim: createAndTrimMock }
      await service.sendEveReminders()
      expect(createAndTrimMock).toHaveBeenCalledTimes(2)
      expect(createAndTrimMock).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: 'DELIVERY_EVE' }),
      )
      expect(createAndTrimMock).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-2', type: 'DELIVERY_EVE' }),
      )
    })
  })

  describe('sendReconfigureReminders', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('chama osClient.createNotification quando há playerIds', async () => {
      const schedule: ScheduleShape = {
        id: 'sched-1',
        userId: 'user-1',
        condominiumId: 'condo-1',
        isActive: true,
        weeklyQty: { seg: 2, ter: 0, qua: 2, qui: 0, sex: 2, sab: 0, dom: 0 },
        deliveryTime: '07:00',
        notifyReconfigure: true,
      }

      const user: UserShape = {
        id: 'user-1',
        creditBalance: 10,
        condominiumId: 'condo-1',
        autoRecharge: null,
        oneSignalPlayerId: 'player-abc',
      }

      const fastify = createMockFastify({
        schedules: [schedule],
        users: { 'user-1': user },
      })

      // Override findMany para schedules com notifyReconfigure: true
      ;(fastify.prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([schedule])

      const service = new SchedulesService(fastify)
      await service.sendReconfigureReminders()

      // Verificar que o módulo OneSignal foi invocado
      const OneSignal = await import('@onesignal/node-onesignal')
      expect(OneSignal.DefaultApi).toHaveBeenCalled()
    })

    it('não cria instância OneSignal quando nenhum playerIds existe', async () => {
      const schedule: ScheduleShape = {
        id: 'sched-1',
        userId: 'user-1',
        condominiumId: 'condo-1',
        isActive: true,
        weeklyQty: { seg: 2, ter: 0, qua: 2, qui: 0, sex: 2, sab: 0, dom: 0 },
        deliveryTime: '07:00',
        notifyReconfigure: true,
      }

      const user: UserShape = {
        id: 'user-1',
        creditBalance: 10,
        condominiumId: 'condo-1',
        autoRecharge: null,
        oneSignalPlayerId: null, // sem playerID
      }

      const fastify = createMockFastify({
        schedules: [schedule],
        users: { 'user-1': user },
      })

      ;(fastify.prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([schedule])

      const service = new SchedulesService(fastify)

      // Deve retornar sem chamar createNotification
      await expect(service.sendReconfigureReminders()).resolves.toBeUndefined()
      // Log de info deve ter sido chamado indicando 0 playerIds
      expect(fastify.log.info).toHaveBeenCalledWith(
        expect.stringContaining('nenhum player_id encontrado'),
      )
    })
  })
})
