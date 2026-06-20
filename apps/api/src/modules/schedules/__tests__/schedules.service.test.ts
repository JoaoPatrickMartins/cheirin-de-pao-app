// SchedulesService unit tests — Wave 1 (Fase 4 Plan 02) + Wave 2 (Fase 8 Plan 05) + Wave 0 (Fase 14 Plan 01)
// Requirements: SCHED-02, SCHED-03, SCHED-04, CRED-08, CRED-10, MSCHED-02, MSCHED-04
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
  deliveryTime?: string | null
}

type ScheduleShape = {
  id: string
  userId: string
  condominiumId: string
  isActive: boolean
  weeklyQty: object
  deliveryTime: string
  notifyReconfigure: boolean
  days?: object | null
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
  orderFindManyFn?: ReturnType<typeof vi.fn>
  userFindUniqueFn?: ReturnType<typeof vi.fn>
}) {
  const { schedules = [], users = {}, createOrderFn, updateUserFn, createTransactionFn, orderFindManyFn, userFindUniqueFn } = overrides ?? {}

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
      order: {
        findMany: orderFindManyFn ?? vi.fn().mockResolvedValue([]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: userFindUniqueFn ?? vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Wave 0 — Fase 14 Plan 01: Testes MSCHED-02/04 (estado RED)
  // Implementação multi-slot será adicionada no Plano 03 desta fase.
  // ─────────────────────────────────────────────────────────────────────────────

  describe('createDailyOrders [MSCHED-02 multi-slot]', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('createDailyOrders_multiSlot_cria2Orders_quandoAmbosSlotsTêmQty', async () => {
      // schedule.days com 2 slots: 06:30 (qty=2 todos os dias) e 15:30 (qty=1 todos os dias)
      const schedule: ScheduleShape = {
        id: 'sched-multi-1',
        userId: 'user-multi-1',
        condominiumId: 'condo-1',
        isActive: true,
        // weeklyQty placeholder — não usado no modo multi-slot
        weeklyQty: { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 },
        deliveryTime: '06:30',
        notifyReconfigure: false,
        days: {
          '06:30': { seg: 2, ter: 2, qua: 2, qui: 2, sex: 2, sab: 2, dom: 2 },
          '15:30': { seg: 1, ter: 1, qua: 1, qui: 1, sex: 1, sab: 1, dom: 1 },
        },
      }

      const user: UserShape = {
        id: 'user-multi-1',
        creditBalance: 20, // suficiente para ambos os slots (2+1=3 por dia)
        condominiumId: 'condo-1',
        autoRecharge: null,
        oneSignalPlayerId: null,
      }

      const createOrderFn = vi.fn().mockResolvedValue({ id: 'order-multi' })
      const fastify = createMockFastify({
        schedules: [schedule],
        users: { 'user-multi-1': user },
        createOrderFn,
      })

      const service = new SchedulesService(fastify)
      await service.createDailyOrders()

      // Esperado: 2 orders criados — um por slot (06:30 e 15:30)
      expect(createOrderFn).toHaveBeenCalledTimes(2)
      expect(createOrderFn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deliveryTime: '06:30' }),
        }),
      )
      expect(createOrderFn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deliveryTime: '15:30' }),
        }),
      )
    })

    it('createDailyOrders_multiSlot_criaApenasOrdersManhã_quandoTardeInsuficiente', async () => {
      // Manhã qty=2 (saldo 3 >= 2 ✓), Tarde qty=5 (saldo após manhã = 1 < 5 ✗)
      const schedule: ScheduleShape = {
        id: 'sched-multi-2',
        userId: 'user-multi-2',
        condominiumId: 'condo-1',
        isActive: true,
        weeklyQty: { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 },
        deliveryTime: '06:30',
        notifyReconfigure: false,
        days: {
          '06:30': { seg: 2, ter: 2, qua: 2, qui: 2, sex: 2, sab: 2, dom: 2 },
          '15:30': { seg: 5, ter: 5, qua: 5, qui: 5, sex: 5, sab: 5, dom: 5 },
        },
      }

      const user: UserShape = {
        id: 'user-multi-2',
        creditBalance: 3, // suficiente para manhã (qty=2) mas insuficiente para tarde (qty=5)
        condominiumId: 'condo-1',
        autoRecharge: null,
        oneSignalPlayerId: null,
      }

      const createOrderFn = vi.fn().mockResolvedValue({ id: 'order-manha-only' })
      const fastify = createMockFastify({
        schedules: [schedule],
        users: { 'user-multi-2': user },
        createOrderFn,
      })

      const service = new SchedulesService(fastify)
      await service.createDailyOrders()

      // Esperado: apenas 1 order criado (manhã 06:30)
      expect(createOrderFn).toHaveBeenCalledTimes(1)
      expect(createOrderFn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deliveryTime: '06:30' }),
        }),
      )
    })

    it('createDailyOrders_legado_continuaFuncionando_quandoDaysNulo', async () => {
      // Modo legado: schedule.days = null → usa weeklyQty sem deliveryTime no order
      const schedule: ScheduleShape = {
        id: 'sched-legado-1',
        userId: 'user-legado-1',
        condominiumId: 'condo-1',
        isActive: true,
        weeklyQty: { seg: 2, ter: 2, qua: 2, qui: 2, sex: 2, sab: 2, dom: 2 },
        deliveryTime: '07:00',
        notifyReconfigure: false,
        days: null, // modo legado explícito
      }

      const user: UserShape = {
        id: 'user-legado-1',
        creditBalance: 10,
        condominiumId: 'condo-1',
        autoRecharge: null,
        oneSignalPlayerId: null,
      }

      const createOrderFn = vi.fn().mockResolvedValue({ id: 'order-legado' })
      const fastify = createMockFastify({
        schedules: [schedule],
        users: { 'user-legado-1': user },
        createOrderFn,
      })

      const service = new SchedulesService(fastify)
      await service.createDailyOrders()

      // Esperado: 1 order criado sem deliveryTime (ou deliveryTime undefined/absent)
      expect(createOrderFn).toHaveBeenCalledTimes(1)
      // No modo legado, deliveryTime NÃO deve ser passado para o order
      const callArgs = createOrderFn.mock.calls[0][0]
      expect(callArgs.data).not.toHaveProperty('deliveryTime')
    })
  })

  describe('getConsumoSemanal [MSCHED-04]', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('getConsumoSemanal_retornaSomaTotal_modoMultiSlot', async () => {
      // days: 06:30 → seg:2, qua:2, sex:2 (total=6); 15:30 → seg:1, qua:1, sex:1 (total=3)
      // consumoSemanal esperado = 6+3 = 9
      // Teste via sendLowCreditNotifications: creditBalance=8 (< 9) → push enviado
      const schedule: ScheduleShape = {
        id: 'sched-consumo-1',
        userId: 'user-consumo-1',
        condominiumId: 'condo-1',
        isActive: true,
        weeklyQty: { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 },
        deliveryTime: '06:30',
        notifyReconfigure: false,
        days: {
          '06:30': { seg: 2, ter: 0, qua: 2, qui: 0, sex: 2, sab: 0, dom: 0 }, // total = 6
          '15:30': { seg: 1, ter: 0, qua: 1, qui: 0, sex: 1, sab: 0, dom: 0 }, // total = 3
        },
      }

      const userBaixo: UserShape = {
        id: 'user-consumo-1',
        creditBalance: 8, // < consumoSemanal (9) → push enviado
        condominiumId: 'condo-1',
        autoRecharge: null,
        oneSignalPlayerId: 'player-consumo',
      }

      const fastify = createMockFastify({
        schedules: [schedule],
        users: { 'user-consumo-1': userBaixo },
      })
      ;(fastify.prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([schedule])

      const createNotificationSpy = vi.fn().mockResolvedValue({})
      vi.mocked(OneSignalModule.DefaultApi).mockImplementationOnce(function () {
        return { createNotification: createNotificationSpy }
      })

      const createAndTrimMock = vi.fn().mockResolvedValue(undefined)
      const service = new SchedulesService(fastify)
      ;(service as unknown as Record<string, unknown>)['notificationsService'] = { createAndTrim: createAndTrimMock }

      await service.sendLowCreditNotifications()

      // creditBalance=8 < consumoSemanal=9 → DEVE enviar push
      expect(createNotificationSpy).toHaveBeenCalled()

      // Agora testar que com creditBalance=10 (>= 9) NÃO envia push
      vi.clearAllMocks()

      const userAlto: UserShape = {
        id: 'user-consumo-1',
        creditBalance: 10, // >= consumoSemanal (9) → push NÃO enviado
        condominiumId: 'condo-1',
        autoRecharge: null,
        oneSignalPlayerId: 'player-consumo',
      }

      const fastify2 = createMockFastify({
        schedules: [schedule],
        users: { 'user-consumo-1': userAlto },
      })
      ;(fastify2.prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([schedule])

      const createAndTrimMock2 = vi.fn().mockResolvedValue(undefined)
      const service2 = new SchedulesService(fastify2)
      ;(service2 as unknown as Record<string, unknown>)['notificationsService'] = { createAndTrim: createAndTrimMock2 }

      await service2.sendLowCreditNotifications()

      // creditBalance=10 >= consumoSemanal=9 → NÃO deve enviar push nem persistir Notification
      expect(createAndTrimMock2).not.toHaveBeenCalled()
    })
  })

  describe('sendEveReminders [MSCHED-04 deliveryTime]', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('sendEveReminders_textoPush_inclui_deliveryTime_quandoDisponível', async () => {
      // order com deliveryTime: "06:30" → texto do push deve conter "06:30"
      const orders: OrderShape[] = [
        {
          id: 'order-eve-1',
          userId: 'user-eve-1',
          quantity: 2,
          scheduledDate: new Date(),
          status: 'SCHEDULED',
          deliveryTime: '06:30',
        },
      ]

      const orderFindManyFn = vi.fn().mockResolvedValue(orders)
      const userFindUniqueFn = vi.fn().mockResolvedValue({ oneSignalPlayerId: 'player-1' })

      const fastify = createMockFastify({
        orderFindManyFn,
        userFindUniqueFn,
      })
      ;(fastify.prisma as unknown as Record<string, unknown>).notification = {
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({}),
      }

      const capturedNotifications: Array<{ contents?: { pt?: string } }> = []
      const createNotificationSpy = vi.fn().mockImplementation((n: { contents?: { pt?: string } }) => {
        capturedNotifications.push(n)
        return Promise.resolve({})
      })
      vi.mocked(OneSignalModule.DefaultApi).mockImplementationOnce(function () {
        return { createNotification: createNotificationSpy }
      })

      const createAndTrimMock = vi.fn().mockResolvedValue(undefined)
      const service = new SchedulesService(fastify)
      ;(service as unknown as Record<string, unknown>)['notificationsService'] = { createAndTrim: createAndTrimMock }

      await service.sendEveReminders()

      // O push DEVE conter "06:30" no texto
      expect(createNotificationSpy).toHaveBeenCalled()
      const pushedNotif = capturedNotifications[0]
      expect(pushedNotif?.contents?.pt).toContain('06:30')
      // E NÃO deve conter a string literal "null"
      expect(pushedNotif?.contents?.pt).not.toContain('null')
    })

    it('sendEveReminders_textoPush_SEM_null_quandoDeliveryTimeNulo', async () => {
      // order com deliveryTime: null → texto do push NÃO deve conter "null" nem "undefined"
      const orders: OrderShape[] = [
        {
          id: 'order-eve-2',
          userId: 'user-eve-2',
          quantity: 3,
          scheduledDate: new Date(),
          status: 'SCHEDULED',
          deliveryTime: null,
        },
      ]

      const orderFindManyFn = vi.fn().mockResolvedValue(orders)
      const userFindUniqueFn = vi.fn().mockResolvedValue({ oneSignalPlayerId: 'player-1' })

      const fastify = createMockFastify({
        orderFindManyFn,
        userFindUniqueFn,
      })
      ;(fastify.prisma as unknown as Record<string, unknown>).notification = {
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({}),
      }

      const capturedNotifications: Array<{ contents?: { pt?: string } }> = []
      const createNotificationSpy = vi.fn().mockImplementation((n: { contents?: { pt?: string } }) => {
        capturedNotifications.push(n)
        return Promise.resolve({})
      })
      vi.mocked(OneSignalModule.DefaultApi).mockImplementationOnce(function () {
        return { createNotification: createNotificationSpy }
      })

      const createAndTrimMock = vi.fn().mockResolvedValue(undefined)
      const service = new SchedulesService(fastify)
      ;(service as unknown as Record<string, unknown>)['notificationsService'] = { createAndTrim: createAndTrimMock }

      await service.sendEveReminders()

      // O push NÃO deve conter "null" nem "undefined" no texto
      expect(createNotificationSpy).toHaveBeenCalled()
      const pushedNotif = capturedNotifications[0]
      expect(pushedNotif?.contents?.pt).not.toContain('null')
      expect(pushedNotif?.contents?.pt).not.toContain('undefined')
    })
  })

  describe('sendLowCreditNotifications [MSCHED-04 multi-slot]', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('sendLowCreditNotifications_usaGetConsumoSemanal_modoMultiSlot', async () => {
      // days: 06:30 → 3 todos os dias (7*3=21), 15:30 → 3 todos os dias (7*3=21)
      // consumoSemanal = 21+21 = 42
      const schedule: ScheduleShape = {
        id: 'sched-low-multi-1',
        userId: 'user-low-multi-1',
        condominiumId: 'condo-1',
        isActive: true,
        weeklyQty: { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 },
        deliveryTime: '06:30',
        notifyReconfigure: false,
        days: {
          '06:30': { seg: 3, ter: 3, qua: 3, qui: 3, sex: 3, sab: 3, dom: 3 }, // 21
          '15:30': { seg: 3, ter: 3, qua: 3, qui: 3, sex: 3, sab: 3, dom: 3 }, // 21
        },
      }

      // creditBalance=10 < consumoSemanal=42 → push enviado
      const userBaixo: UserShape = {
        id: 'user-low-multi-1',
        creditBalance: 10,
        condominiumId: 'condo-1',
        autoRecharge: null,
        oneSignalPlayerId: 'player-low-multi',
      }

      const fastify = createMockFastify({
        schedules: [schedule],
        users: { 'user-low-multi-1': userBaixo },
      })
      ;(fastify.prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([schedule])

      const createNotificationSpy = vi.fn().mockResolvedValue({})
      vi.mocked(OneSignalModule.DefaultApi).mockImplementationOnce(function () {
        return { createNotification: createNotificationSpy }
      })

      const createAndTrimMock = vi.fn().mockResolvedValue(undefined)
      const service = new SchedulesService(fastify)
      ;(service as unknown as Record<string, unknown>)['notificationsService'] = { createAndTrim: createAndTrimMock }

      await service.sendLowCreditNotifications()

      // creditBalance=10 < consumoSemanal=42 → DEVE enviar push de low credit
      expect(createNotificationSpy).toHaveBeenCalled()

      // Agora testar com creditBalance=50 (>= 42) → NÃO envia push
      vi.clearAllMocks()

      const userAlto: UserShape = {
        id: 'user-low-multi-1',
        creditBalance: 50,
        condominiumId: 'condo-1',
        autoRecharge: null,
        oneSignalPlayerId: 'player-low-multi',
      }

      const fastify2 = createMockFastify({
        schedules: [schedule],
        users: { 'user-low-multi-1': userAlto },
      })
      ;(fastify2.prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([schedule])

      const createAndTrimMock2 = vi.fn().mockResolvedValue(undefined)
      const service2 = new SchedulesService(fastify2)
      ;(service2 as unknown as Record<string, unknown>)['notificationsService'] = { createAndTrim: createAndTrimMock2 }

      await service2.sendLowCreditNotifications()

      // creditBalance=50 >= consumoSemanal=42 → NÃO deve enviar push nem persistir Notification
      expect(createAndTrimMock2).not.toHaveBeenCalled()
    })
  })
})
