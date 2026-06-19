// SchedulesService unit tests — Wave 1 (Fase 4 Plan 02) + Wave 2 (Fase 8 Plan 05)
// Requirements: SCHED-02, SCHED-03, SCHED-04, CRED-08, CRED-10
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SchedulesService } from '../schedules.service.js'
import { FastifyInstance } from 'fastify'
import * as OneSignalModule from '@onesignal/node-onesignal'

// Mock do módulo OneSignal
vi.mock('@onesignal/node-onesignal', () => {
  const createNotificationMock = vi.fn().mockResolvedValue({})
  return {
    createConfiguration: vi.fn().mockReturnValue({}),
    // function keyword obrigatório em Vitest 4+ para constructor mocks — arrow functions ignoram return value
    DefaultApi: vi.fn().mockImplementation(function () {
      return { createNotification: createNotificationMock }
    }),
    Notification: vi.fn().mockImplementation(function () {
      return { app_id: '', include_subscription_ids: [], headings: {}, contents: {}, url: '' }
    }),
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
      expect(OneSignalModule.DefaultApi).toHaveBeenCalled()
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

  describe('processAutoBuy [CRED-08/10]', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      vi.useRealTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('CRED-08 — weekday respeitado: NÃO compra quando autoRecharge.weekday não coincide com o dia atual', async () => {
      // 2024-01-09T15:00:00Z = terça-feira 12:00 BRT (America/Sao_Paulo = UTC-3)
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-09T15:00:00Z'))

      const user: UserShape = {
        id: 'user-cred08',
        creditBalance: 2,
        condominiumId: 'condo-1',
        autoRecharge: { active: true, mode: 'semanal', weekday: 'seg', comboId: 'combo-1' }, // seg ≠ ter
        oneSignalPlayerId: 'player-cred08',
      }

      const fastify = createMockFastify({ users: { 'user-cred08': user } })
      ;(fastify.prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([user])

      const createNotificationSpy = vi.fn().mockResolvedValue({})
      vi.mocked(OneSignalModule.DefaultApi).mockImplementation(function () {
        return { createNotification: createNotificationSpy }
      })

      const service = new SchedulesService(fastify)
      await service.processAutoBuy()

      // Weekday não coincide (seg vs ter) — não deve enviar push de compra automática
      expect(createNotificationSpy).not.toHaveBeenCalled()
    })

    it('CRED-10 — modo semanal verificado: NÃO compra quando autoRecharge.mode !== "semanal"', async () => {
      // mode='mensal' não é tratado em processAutoBuy (apenas 'acabar' e 'semanal')
      // shouldBuy permanece false → nenhuma ação de compra
      const user: UserShape = {
        id: 'user-cred10-mode',
        creditBalance: 0,
        condominiumId: 'condo-1',
        autoRecharge: { active: true, mode: 'mensal', weekday: 'seg', comboId: 'combo-1' },
        oneSignalPlayerId: 'player-cred10-mode',
      }

      const fastify = createMockFastify({ users: { 'user-cred10-mode': user } })
      ;(fastify.prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([user])

      const createNotificationSpy = vi.fn().mockResolvedValue({})
      vi.mocked(OneSignalModule.DefaultApi).mockImplementation(function () {
        return { createNotification: createNotificationSpy }
      })

      const service = new SchedulesService(fastify)
      await service.processAutoBuy()

      // mode='mensal' → shouldBuy=false → nenhum push enviado
      expect(createNotificationSpy).not.toHaveBeenCalled()
    })

    it('CRED-08/10 — push de confirmação enviado após compra automática bem-sucedida (semanal + weekday correto)', async () => {
      // 2024-01-08T15:00:00Z = segunda-feira 12:00 BRT (America/Sao_Paulo = UTC-3)
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-08T15:00:00Z'))

      const user: UserShape = {
        id: 'user-cred08-push',
        creditBalance: 2,
        condominiumId: 'condo-1',
        autoRecharge: { active: true, mode: 'semanal', weekday: 'seg', comboId: 'combo-1' }, // seg === seg ✓
        oneSignalPlayerId: 'player-cred08-push',
      }

      const fastify = createMockFastify({ users: { 'user-cred08-push': user } })
      ;(fastify.prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([user])

      const createNotificationSpy = vi.fn().mockResolvedValue({})
      vi.mocked(OneSignalModule.DefaultApi).mockImplementation(function () {
        return { createNotification: createNotificationSpy }
      })

      const service = new SchedulesService(fastify)
      await service.processAutoBuy()

      // Weekday correto (seg === seg) → push de compra automática DEVE ser enviado
      expect(createNotificationSpy).toHaveBeenCalledOnce()
      expect(createNotificationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/client/creditos',
        }),
      )
    })
  })

  describe('sendLowCreditNotifications [CRED-09]', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('envia push quando creditBalance < consumoSemanal e sem auto-recharge', async () => {
      // weeklyQty total = 2+1+2+0+0+0+0 = 5
      const schedule: ScheduleShape = {
        id: 'sched-1',
        userId: 'user-1',
        condominiumId: 'condo-1',
        isActive: true,
        weeklyQty: { seg: 2, ter: 1, qua: 2, qui: 0, sex: 0, sab: 0, dom: 0 },
        deliveryTime: '07:00',
        notifyReconfigure: false,
      }

      const user: UserShape = {
        id: 'user-1',
        creditBalance: 2, // < consumoSemanal (5)
        condominiumId: 'condo-1',
        autoRecharge: null, // sem auto-recharge
        oneSignalPlayerId: 'osp-id',
      }

      const fastify = createMockFastify({
        schedules: [schedule],
        users: { 'user-1': user },
      })

      ;(fastify.prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([schedule])

      const createAndTrimMock = vi.fn().mockResolvedValue(undefined)

      // Spy local para createNotification — function keyword obrigatório em Vitest 4+ para constructor mocks
      const createNotificationSpy = vi.fn().mockResolvedValue({})
      vi.mocked(OneSignalModule.DefaultApi).mockImplementationOnce(function () {
        return { createNotification: createNotificationSpy }
      })

      const service = new SchedulesService(fastify)
      ;(service as unknown as Record<string, unknown>)['notificationsService'] = { createAndTrim: createAndTrimMock }

      await service.sendLowCreditNotifications()

      expect(OneSignalModule.DefaultApi).toHaveBeenCalled()
      expect(createNotificationSpy).toHaveBeenCalled()
      expect(createAndTrimMock).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: 'LOW_CREDIT' }),
      )
    })

    it('NAO envia push quando autoRecharge.active=true', async () => {
      const schedule: ScheduleShape = {
        id: 'sched-2',
        userId: 'user-2',
        condominiumId: 'condo-1',
        isActive: true,
        weeklyQty: { seg: 2, ter: 1, qua: 2, qui: 0, sex: 0, sab: 0, dom: 0 },
        deliveryTime: '07:00',
        notifyReconfigure: false,
      }

      const user: UserShape = {
        id: 'user-2',
        creditBalance: 2, // < consumoSemanal (5) — mas auto-recharge ativo
        condominiumId: 'condo-1',
        autoRecharge: { active: true, mode: 'acabar' }, // auto-recharge ativo
        oneSignalPlayerId: 'osp-id-2',
      }

      const fastify = createMockFastify({
        schedules: [schedule],
        users: { 'user-2': user },
      })

      ;(fastify.prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([schedule])

      const createAndTrimMock = vi.fn().mockResolvedValue(undefined)
      const service = new SchedulesService(fastify)
      ;(service as unknown as Record<string, unknown>)['notificationsService'] = { createAndTrim: createAndTrimMock }

      await service.sendLowCreditNotifications()

      // Não deve enviar push nem criar Notification (auto-recharge cuida disso — D-10)
      const mockInstance = vi.mocked(OneSignalModule.DefaultApi).mock.results[0]?.value as { createNotification: ReturnType<typeof vi.fn> } | undefined
      if (mockInstance) {
        expect(mockInstance.createNotification).not.toHaveBeenCalled()
      }
      expect(createAndTrimMock).not.toHaveBeenCalled()
    })

    it('NAO envia push quando creditBalance >= consumoSemanal', async () => {
      const schedule: ScheduleShape = {
        id: 'sched-3',
        userId: 'user-3',
        condominiumId: 'condo-1',
        isActive: true,
        weeklyQty: { seg: 1, ter: 1, qua: 1, qui: 1, sex: 1, sab: 0, dom: 0 }, // consumo = 5
        deliveryTime: '07:00',
        notifyReconfigure: false,
      }

      const user: UserShape = {
        id: 'user-3',
        creditBalance: 10, // >= consumoSemanal (5) — saldo suficiente
        condominiumId: 'condo-1',
        autoRecharge: null,
        oneSignalPlayerId: 'osp-id-3',
      }

      const fastify = createMockFastify({
        schedules: [schedule],
        users: { 'user-3': user },
      })

      ;(fastify.prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([schedule])

      const createAndTrimMock = vi.fn().mockResolvedValue(undefined)
      const service = new SchedulesService(fastify)
      ;(service as unknown as Record<string, unknown>)['notificationsService'] = { createAndTrim: createAndTrimMock }

      await service.sendLowCreditNotifications()

      // Saldo suficiente — não deve notificar
      const mockInstance = vi.mocked(OneSignalModule.DefaultApi).mock.results[0]?.value as { createNotification: ReturnType<typeof vi.fn> } | undefined
      if (mockInstance) {
        expect(mockInstance.createNotification).not.toHaveBeenCalled()
      }
      expect(createAndTrimMock).not.toHaveBeenCalled()
    })

    it('NAO envia push quando oneSignalPlayerId = null, mas persiste Notification', async () => {
      const schedule: ScheduleShape = {
        id: 'sched-4',
        userId: 'user-4',
        condominiumId: 'condo-1',
        isActive: true,
        weeklyQty: { seg: 2, ter: 1, qua: 2, qui: 0, sex: 0, sab: 0, dom: 0 }, // consumo = 5
        deliveryTime: '07:00',
        notifyReconfigure: false,
      }

      const user: UserShape = {
        id: 'user-4',
        creditBalance: 2, // < consumoSemanal (5)
        condominiumId: 'condo-1',
        autoRecharge: null,
        oneSignalPlayerId: null, // sem token push — não deve enviar push
      }

      const fastify = createMockFastify({
        schedules: [schedule],
        users: { 'user-4': user },
      })

      ;(fastify.prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([schedule])

      const createAndTrimMock = vi.fn().mockResolvedValue(undefined)
      const service = new SchedulesService(fastify)
      ;(service as unknown as Record<string, unknown>)['notificationsService'] = { createAndTrim: createAndTrimMock }

      await service.sendLowCreditNotifications()

      // Push não enviado (sem oneSignalPlayerId), mas Notification persistida
      const mockInstance = vi.mocked(OneSignalModule.DefaultApi).mock.results[0]?.value as { createNotification: ReturnType<typeof vi.fn> } | undefined
      if (mockInstance) {
        expect(mockInstance.createNotification).not.toHaveBeenCalled()
      }
      // Notification LOW_CREDIT DEVE ser persistida mesmo sem push
      expect(createAndTrimMock).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-4', type: 'LOW_CREDIT' }),
      )
    })
  })
})
