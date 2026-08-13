// SchedulesService unit tests — Wave 1 (Fase 4 Plan 02) + Wave 2 (Fase 8 Plan 05) + Wave 0 (Fase 14 Plan 01)
// Requirements: SCHED-02, SCHED-03, SCHED-04, CRED-08, CRED-10, MSCHED-02, MSCHED-04
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SchedulesService, findAgendaMinimoError, eveMessage } from '../schedules.service.js'
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
  pausedAt?: Date | null
  lastPauseReminderAt?: Date | null
}

type UserShape = {
  id: string
  creditMilli: number
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
  /** Cestinhas do escopo (Onda F2 — véspera unifica pão + Cestinha). Default: nenhuma. */
  marketOrderFindManyFn?: ReturnType<typeof vi.fn>
  userFindUniqueFn?: ReturnType<typeof vi.fn>
  agendaMinimoRow?: { key: string; value: string } | null
}) {
  const { schedules = [], users = {}, createOrderFn, updateUserFn, createTransactionFn, orderFindManyFn, marketOrderFindManyFn, userFindUniqueFn, agendaMinimoRow } = overrides ?? {}

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
        update: vi.fn().mockResolvedValue({ id: 'schedule-1' }),
      },
      order: {
        findMany: orderFindManyFn ?? vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      // Default vazio → o fluxo do pão fica idêntico ao histórico (mesmo padrão dos stubs de
      // marketOrder adicionados nas Ondas A e B).
      marketOrder: {
        findMany: marketOrderFindManyFn ?? vi.fn().mockResolvedValue([]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: userFindUniqueFn ?? vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          return Promise.resolve(users[where.id] ?? null)
        }),
      },
      // Config de pedido mínimo (global) por chave. Só 'pedidoMinimoAgenda' devolve a linha de
      // mínimos; diasBloqueados/limitePedidosDia → null (sem bloqueio nem limite nos testes).
      setting: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
          Promise.resolve(where.key === 'pedidoMinimoAgenda' ? (agendaMinimoRow ?? null) : null),
        ),
      },
      // Sem override por condomínio → as restrições resolvem para o padrão global (nada
      // bloqueado, sem limite), mantendo os testes idênticos ao comportamento histórico.
      condominium: { findUnique: vi.fn().mockResolvedValue(null) },
      // Sem bloqueios de data/período.
      deliveryBlock: { findMany: vi.fn().mockResolvedValue([]) },
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

    it('salvar a agenda retoma automaticamente (limpa pausedAt no update)', async () => {
      const fastify = createMockFastify()
      const service = new SchedulesService(fastify)

      await service.upsertSchedule('user-1', 'condo-1', {
        days: { manha: { seg: 2, ter: 0, qua: 2, qui: 0, sex: 2, sab: 0, dom: 0 } },
        notifyReconfigure: false,
      })

      expect(fastify.prisma.schedule.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ pausedAt: null, lastPauseReminderAt: null }),
        }),
      )
    })

    it('rejeita (422) quando um dia com qtd > 0 fica abaixo do mínimo (por turno)', async () => {
      const fastify = createMockFastify({
        agendaMinimoRow: {
          key: 'pedidoMinimoAgenda',
          value: JSON.stringify({ seg: 3, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }),
        },
      })
      const service = new SchedulesService(fastify)

      // Seg = 2 (< mín 3) → viola; deve lançar 422 e NÃO chamar o upsert.
      await expect(
        service.upsertSchedule('user-1', 'condo-1', {
          days: { manha: { seg: 2, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 } },
          notifyReconfigure: false,
        }),
      ).rejects.toMatchObject({ statusCode: 422 })
      expect(fastify.prisma.schedule.upsert).not.toHaveBeenCalled()
    })

    it('aceita quando o dia é 0 (folga) mesmo com mínimo configurado', async () => {
      const fastify = createMockFastify({
        agendaMinimoRow: {
          key: 'pedidoMinimoAgenda',
          value: JSON.stringify({ seg: 3, ter: 3, qua: 3, qui: 3, sex: 3, sab: 3, dom: 3 }),
        },
      })
      const service = new SchedulesService(fastify)

      // Seg = 3 (== mín, ok); resto folga (0, sempre ok).
      await service.upsertSchedule('user-1', 'condo-1', {
        days: { manha: { seg: 3, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 } },
        notifyReconfigure: false,
      })
      expect(fastify.prisma.schedule.upsert).toHaveBeenCalledOnce()
    })
  })

  describe('findAgendaMinimoError (helper puro)', () => {
    const minimos = { seg: 3, ter: 2, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }

    it('retorna null quando todos os dias com qtd > 0 respeitam o mínimo', () => {
      const days = { manha: { seg: 3, ter: 2, qua: 5, qui: 0, sex: 0, sab: 0, dom: 0 } }
      expect(findAgendaMinimoError({ days }, minimos)).toBeNull()
    })

    it('0 (folga) é sempre válido, mesmo com mínimo > 0', () => {
      const days = { manha: { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 } }
      expect(findAgendaMinimoError({ days }, minimos)).toBeNull()
    })

    it('acusa o dia violado (qtd > 0 e < mínimo) e ignora dias sem mínimo', () => {
      const days = { manha: { seg: 1, ter: 0, qua: 1, qui: 0, sex: 0, sab: 0, dom: 0 } }
      const erro = findAgendaMinimoError({ days }, minimos)
      expect(erro).toContain('Seg')
      expect(erro).not.toContain('Qua') // qua tem mínimo 0 → sem exigência
    })

    it('valida cada turno independentemente no multi-slot', () => {
      const days = {
        manha: { seg: 3, ter: 2, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 },
        tarde: { seg: 1, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }, // seg tarde = 1 < 3
      }
      expect(findAgendaMinimoError({ days }, minimos)).toContain('Seg')
    })

    it('valida o formato legado (weeklyQty)', () => {
      const weeklyQty = { seg: 2, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }
      expect(findAgendaMinimoError({ weeklyQty }, minimos)).toContain('Seg')
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
          'user-1': { id: 'user-1', creditMilli: 5000, condominiumId: null, autoRecharge: null, oneSignalPlayerId: null },
          'user-2': { id: 'user-2', creditMilli: 5000, condominiumId: null, autoRecharge: null, oneSignalPlayerId: null },
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

  // ── Onda F2 — véspera unificada (pão + Cestinha) ──────────────────────────────
  // Antes a véspera iterava só `Order`: quem tinha Cestinha para amanhã não recebia nada. A
  // unidade do aviso é a PARADA (D-5: userId + turno) — uma campainha amanhã, um aviso hoje.
  describe('eveMessage (texto do lembrete)', () => {
    it('só pão → mantém o texto histórico, com horário', () => {
      const { title, body } = eveMessage({ breads: 4, items: 0, hasBread: true, hasCestinha: false, deliveryTime: '06:30' })
      expect(title).toBe('Entrega amanhã 🥖')
      expect(body).toBe('Lembrete: 4 pães às 06:30 amanhã.')
    })

    it('pão + Cestinha → UMA mensagem, com as duas grandezas separadas (D-1)', () => {
      const { title, body } = eveMessage({ breads: 6, items: 2, hasBread: true, hasCestinha: true, deliveryTime: '07:00' })
      expect(title).toBe('Entrega amanhã 🥖🧺')
      expect(body).toBe('Lembrete: 6 pães e sua Cestinha (2 itens) às 07:00 amanhã.')
      // Nunca soma pães com itens: o total "8" não existe em lugar nenhum do texto.
      expect(body).not.toContain('8')
    })

    it('só Cestinha (sem pão) → título 🧺', () => {
      const { title, body } = eveMessage({ breads: 0, items: 1, hasBread: false, hasCestinha: true, deliveryTime: null })
      expect(title).toBe('Entrega amanhã 🧺')
      expect(body).toBe('Lembrete: sua Cestinha (1 item) amanhã.')
    })

    it('Cestinha só de pão → é entrega de pão para o cliente (🥖, sem falar de itens)', () => {
      const { title, body } = eveMessage({ breads: 4, items: 0, hasBread: false, hasCestinha: true, deliveryTime: '07:00' })
      expect(title).toBe('Entrega amanhã 🥖')
      expect(body).toBe('Lembrete: 4 pães às 07:00 amanhã.')
    })

    it('sem deliveryTime → nunca interpola null/undefined (T-14-03-03)', () => {
      const { body } = eveMessage({ breads: 1, items: 0, hasBread: true, hasCestinha: false, deliveryTime: null })
      expect(body).toBe('Lembrete: 1 pão amanhã.')
      expect(body).not.toContain('null')
      expect(body).not.toContain('undefined')
    })
  })

  describe('sendEveReminders — Cestinha (F2)', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    type MarketShape = {
      userId: string
      slotId: string | null
      deliveryTime: string | null
      breadQty: number
      items: { qty: number }[]
    }

    function runWith(orders: OrderShape[], marketOrders: MarketShape[]) {
      const fastify = createMockFastify({
        orderFindManyFn: vi.fn().mockResolvedValue(orders),
        marketOrderFindManyFn: vi.fn().mockResolvedValue(marketOrders),
        userFindUniqueFn: vi.fn().mockResolvedValue({ oneSignalPlayerId: null }),
      })
      const service = new SchedulesService(fastify)
      const createAndTrimMock = vi.fn().mockResolvedValue(undefined)
      ;(service as unknown as Record<string, unknown>)['notificationsService'] = { createAndTrim: createAndTrimMock }
      return { service, createAndTrimMock, fastify }
    }

    it('pão + Cestinha no MESMO turno → um único aviso (não dois pushes)', async () => {
      const { service, createAndTrimMock } = runWith(
        [{ id: 'o1', userId: 'u1', quantity: 4, scheduledDate: new Date(), status: 'SCHEDULED', deliveryTime: '08:00', slotId: 'manha' } as OrderShape],
        [{ userId: 'u1', slotId: 'manha', deliveryTime: '08:00', breadQty: 0, items: [{ qty: 2 }] }],
      )
      await service.sendEveReminders()

      expect(createAndTrimMock).toHaveBeenCalledTimes(1)
      expect(createAndTrimMock.mock.calls[0][0].body).toBe('Lembrete: 4 pães e sua Cestinha (2 itens) às 08:00 amanhã.')
    })

    it('cliente SÓ com Cestinha amanhã → passa a receber aviso (antes: nenhum)', async () => {
      const { service, createAndTrimMock } = runWith(
        [],
        [{ userId: 'u2', slotId: 'tarde', deliveryTime: '15:00', breadQty: 0, items: [{ qty: 3 }] }],
      )
      await service.sendEveReminders()

      expect(createAndTrimMock).toHaveBeenCalledTimes(1)
      expect(createAndTrimMock.mock.calls[0][0]).toMatchObject({ userId: 'u2', type: 'DELIVERY_EVE' })
      expect(createAndTrimMock.mock.calls[0][0].body).toContain('sua Cestinha (3 itens)')
    })

    it('breadQty da Cestinha SOMA no contador de pães (D-1)', async () => {
      const { service, createAndTrimMock } = runWith(
        [{ id: 'o1', userId: 'u1', quantity: 2, scheduledDate: new Date(), status: 'SCHEDULED', deliveryTime: '08:00', slotId: 'manha' } as OrderShape],
        [{ userId: 'u1', slotId: 'manha', deliveryTime: '08:00', breadQty: 4, items: [{ qty: 1 }] }],
      )
      await service.sendEveReminders()

      expect(createAndTrimMock.mock.calls[0][0].body).toBe('Lembrete: 6 pães e sua Cestinha (1 item) às 08:00 amanhã.')
    })

    it('turnos diferentes do mesmo cliente → duas paradas, dois avisos', async () => {
      const { service, createAndTrimMock } = runWith(
        [{ id: 'o1', userId: 'u1', quantity: 2, scheduledDate: new Date(), status: 'SCHEDULED', deliveryTime: '08:00', slotId: 'manha' } as OrderShape],
        [{ userId: 'u1', slotId: 'tarde', deliveryTime: '15:00', breadQty: 0, items: [{ qty: 1 }] }],
      )
      await service.sendEveReminders()

      expect(createAndTrimMock).toHaveBeenCalledTimes(2)
      expect(createAndTrimMock.mock.calls[0][0].body).toContain('às 08:00')
      expect(createAndTrimMock.mock.calls[1][0].body).toContain('às 15:00')
    })

    it('dois pedidos de pão no mesmo turno → um aviso com o total (mescla por parada)', async () => {
      const { service, createAndTrimMock } = runWith(
        [
          { id: 'o1', userId: 'u1', quantity: 2, scheduledDate: new Date(), status: 'SCHEDULED', deliveryTime: '08:00', slotId: 'manha' } as OrderShape,
          { id: 'o2', userId: 'u1', quantity: 3, scheduledDate: new Date(), status: 'SCHEDULED', deliveryTime: '08:00', slotId: 'manha' } as OrderShape,
        ],
        [],
      )
      await service.sendEveReminders()

      expect(createAndTrimMock).toHaveBeenCalledTimes(1)
      expect(createAndTrimMock.mock.calls[0][0].body).toBe('Lembrete: 5 pães às 08:00 amanhã.')
    })

    it('só busca Cestinha que ainda vai ser entregue — PENDING_PAYMENT fica fora', async () => {
      const marketFindMany = vi.fn().mockResolvedValue([])
      const fastify = createMockFastify({ marketOrderFindManyFn: marketFindMany })
      const service = new SchedulesService(fastify)
      ;(service as unknown as Record<string, unknown>)['notificationsService'] = { createAndTrim: vi.fn() }
      await service.sendEveReminders()

      const where = marketFindMany.mock.calls[0][0].where as { status: { in: string[] } }
      expect(where.status.in).toEqual(['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY'])
      expect(where.status.in).not.toContain('PENDING_PAYMENT')
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
        creditMilli: 10000,
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
        creditMilli: 10000,
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

  describe('processAutoBuy (descontinuado — recarga agora é no corte)', () => {
    beforeEach(() => vi.clearAllMocks())

    it('é no-op: não envia push nem dispara cobrança', async () => {
      const user: UserShape = {
        id: 'user-noop',
        creditMilli: 0,
        condominiumId: 'condo-1',
        autoRecharge: { active: true, mode: 'semanal', weekday: 'seg', comboId: 'combo-1' },
        oneSignalPlayerId: 'player-noop',
      }

      const fastify = createMockFastify({ users: { 'user-noop': user } })
      ;(fastify.prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([user])

      const createNotificationSpy = vi.fn().mockResolvedValue({})
      vi.mocked(OneSignalModule.DefaultApi).mockImplementation(function () {
        return { createNotification: createNotificationSpy }
      })

      const service = new SchedulesService(fastify)
      await service.processAutoBuy()

      expect(createNotificationSpy).not.toHaveBeenCalled()
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
        creditMilli: 2000, // < consumoSemanal (5)
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
        creditMilli: 2000, // < consumoSemanal (5) — mas auto-recharge ativo
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
        creditMilli: 10000, // >= consumoSemanal (5) — saldo suficiente
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
        creditMilli: 2000, // < consumoSemanal (5)
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
        creditMilli: 8000, // < consumoSemanal (9) → push enviado
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
        creditMilli: 10000, // >= consumoSemanal (9) → push NÃO enviado
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
        creditMilli: 10000,
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
        creditMilli: 50000,
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

  // ─────────────────────────────────────────────────────────────────────────────
  // createOrdersAtCutoff — criação de orders no corte de cada slot (Regra A)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('createOrdersAtCutoff [corte por slot]', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      vi.useRealTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    // Mock dedicado com condominium.findMany + order.findFirst (idempotência)
    function mockFastifyCutoff(opts: {
      condominiums: Array<{ id: string; name: string; isActive: boolean; deliverySlots: Array<{ name: string; time: string; cutoffTime: string; isActive: boolean }> }>
      schedules: ScheduleShape[]
      users: Record<string, UserShape>
      existingOrder?: boolean
      createOrderFn?: ReturnType<typeof vi.fn>
    }) {
      const createOrderFn = opts.createOrderFn ?? vi.fn().mockResolvedValue({ id: 'o-1' })
      const transactionFn = vi.fn().mockImplementation(async (cb: (tx: object) => Promise<void>) =>
        cb({
          order: { create: createOrderFn },
          user: { update: vi.fn().mockResolvedValue({}) },
          creditTransaction: { create: vi.fn().mockResolvedValue({}) },
        }),
      )
      const fastify = {
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        prisma: {
          condominium: {
            findMany: vi.fn().mockResolvedValue(opts.condominiums),
            // Sem override → restrições resolvem para o padrão global.
            findUnique: vi.fn().mockResolvedValue(null),
          },
          schedule: { findMany: vi.fn().mockResolvedValue(opts.schedules) },
          setting: { findUnique: vi.fn().mockResolvedValue(null) },
          deliveryBlock: { findMany: vi.fn().mockResolvedValue([]) },
          order: {
            findFirst: vi.fn().mockResolvedValue(opts.existingOrder ? { id: 'existing' } : null),
            count: vi.fn().mockResolvedValue(0),
          },
          user: {
            findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
              Promise.resolve(opts.users[where.id] ?? null),
            ),
          },
          materializedCycle: {
            findFirst: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue({}),
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
          $transaction: transactionFn,
        },
      } as unknown as FastifyInstance
      return { fastify, createOrderFn }
    }

    const tardeCondo = {
      id: 'condo-1',
      name: 'Cond Teste',
      isActive: true,
      deliverySlots: [
        { slotId: 'manha', name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true },
        { slotId: 'tarde', name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true },
      ],
    }

    const multiSchedule: ScheduleShape = {
      id: 'sched-cut-1',
      userId: 'user-cut-1',
      condominiumId: 'condo-1',
      isActive: true,
      weeklyQty: { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 },
      deliveryTime: '06:30',
      notifyReconfigure: false,
      // Etapa B: days indexado por slotId
      days: {
        manha: { seg: 2, ter: 2, qua: 2, qui: 2, sex: 2, sab: 2, dom: 2 },
        tarde: { seg: 1, ter: 1, qua: 1, qui: 1, sex: 1, sab: 1, dom: 1 },
      },
    }

    it('no corte da tarde (10:00), cria order do slot 15:30 para HOJE (Regra A) com condominiumId', async () => {
      // 2026-06-22T13:00:00Z = segunda 10:00 BRT → casa cutoff da tarde (10:00)
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-22T13:00:00Z'))

      const { fastify, createOrderFn } = mockFastifyCutoff({
        condominiums: [tardeCondo],
        schedules: [multiSchedule],
        users: { 'user-cut-1': { id: 'user-cut-1', creditMilli: 10000, condominiumId: 'condo-1', autoRecharge: null, oneSignalPlayerId: null } },
      })

      const service = new SchedulesService(fastify)
      await service.createOrdersAtCutoff()

      // Só a tarde casa o corte (10:00); manhã (22:00) não → exatamente 1 order
      expect(createOrderFn).toHaveBeenCalledTimes(1)
      expect(createOrderFn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-cut-1',
            slotId: 'tarde',
            deliveryTime: '15:30',
            condominiumId: 'condo-1',
            quantity: 1, // seg do slot 15:30
            type: 'SCHEDULED',
          }),
        }),
      )
    })

    it('backstop hard: data BLOQUEADA não gera nenhuma order no corte', async () => {
      // 2026-06-22T13:00:00Z = segunda 10:00 BRT → corte da tarde, entrega HOJE (Regra A).
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-22T13:00:00Z'))

      const { fastify, createOrderFn } = mockFastifyCutoff({
        condominiums: [tardeCondo],
        schedules: [multiSchedule],
        users: { 'user-cut-1': { id: 'user-cut-1', creditMilli: 10000, condominiumId: 'condo-1', autoRecharge: null, oneSignalPlayerId: null } },
      })
      // Feriado cobrindo o dia da entrega — protege agenda salva ANTES do bloqueio.
      fastify.prisma.deliveryBlock.findMany = vi.fn().mockResolvedValue([
        { id: 'b1', condominiumId: null, startDate: '2026-06-22', endDate: '2026-06-22', reason: 'Feriado' },
      ])

      const service = new SchedulesService(fastify)
      await service.createOrdersAtCutoff()

      expect(createOrderFn).not.toHaveBeenCalled()
    })

    it('backstop hard: bloqueio de OUTRO condomínio não impede a geração', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-22T13:00:00Z'))

      const { fastify, createOrderFn } = mockFastifyCutoff({
        condominiums: [tardeCondo],
        schedules: [multiSchedule],
        users: { 'user-cut-1': { id: 'user-cut-1', creditMilli: 10000, condominiumId: 'condo-1', autoRecharge: null, oneSignalPlayerId: null } },
      })
      // O `findMany` real filtraria por escopo; aqui simulamos o retorno já filtrado (vazio)
      // para o condomínio consultado, confirmando que nada é bloqueado por tabela alheia.
      fastify.prisma.deliveryBlock.findMany = vi.fn().mockResolvedValue([])

      const service = new SchedulesService(fastify)
      await service.createOrdersAtCutoff()

      expect(createOrderFn).toHaveBeenCalledTimes(1)
      // A consulta de bloqueios foi feita no escopo do condomínio + globais.
      expect(fastify.prisma.deliveryBlock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { condominiumId: 'condo-1' },
              { condominiumId: null },
              { condominiumId: { isSet: false } },
            ],
          }),
        }),
      )
    })

    it('idempotente: NÃO recria se já existe order para o slot/dia', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-22T13:00:00Z'))

      const { fastify, createOrderFn } = mockFastifyCutoff({
        condominiums: [tardeCondo],
        schedules: [multiSchedule],
        users: { 'user-cut-1': { id: 'user-cut-1', creditMilli: 10000, condominiumId: 'condo-1', autoRecharge: null, oneSignalPlayerId: null } },
        existingOrder: true,
      })

      const service = new SchedulesService(fastify)
      await service.createOrdersAtCutoff()

      expect(createOrderFn).not.toHaveBeenCalled()
    })

    it('NÃO cria order para slot cujo cutoffTime não casa com a hora atual', async () => {
      // 09:00 BRT — nenhum slot tem corte 09:00
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-22T12:00:00Z'))

      const { fastify, createOrderFn } = mockFastifyCutoff({
        condominiums: [tardeCondo],
        schedules: [multiSchedule],
        users: { 'user-cut-1': { id: 'user-cut-1', creditMilli: 10000, condominiumId: 'condo-1', autoRecharge: null, oneSignalPlayerId: null } },
      })

      const service = new SchedulesService(fastify)
      await service.createOrdersAtCutoff()

      expect(createOrderFn).not.toHaveBeenCalled()
    })

    it('agenda PAUSADA (pausedAt != null) não gera order no corte', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-22T13:00:00Z')) // segunda 10:00 BRT → casa corte da tarde

      const { fastify, createOrderFn } = mockFastifyCutoff({
        condominiums: [tardeCondo],
        schedules: [{ ...multiSchedule, pausedAt: new Date('2026-06-20T00:00:00Z') }],
        users: { 'user-cut-1': { id: 'user-cut-1', creditMilli: 10000, condominiumId: 'condo-1', autoRecharge: null, oneSignalPlayerId: null } },
      })

      const service = new SchedulesService(fastify)
      await service.createOrdersAtCutoff()

      expect(createOrderFn).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Pré-confirmação T-2h (janela + anti-spam) e backfill de cortes perdidos
  // ===========================================================================
  describe('preconfirmAutoRechargeAhead / backfillMissedCutoffs', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      vi.useRealTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    // Condomínio só com o slot da TARDE (corte 10:00, entrega 15:30 no mesmo dia).
    const tardeOnlyCondo = {
      id: 'condo-1',
      name: 'Cond Teste',
      isActive: true,
      deliverySlots: [{ slotId: 'tarde', name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true }],
    }

    function tardeSchedule(qty: number): ScheduleShape {
      return {
        id: 'sched-w-1',
        userId: 'user-w-1',
        condominiumId: 'condo-1',
        isActive: true,
        weeklyQty: { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 },
        deliveryTime: '15:30',
        notifyReconfigure: false,
        days: { tarde: { seg: qty, ter: qty, qua: qty, qui: qty, sex: qty, sab: qty, dom: qty } },
      }
    }

    // Mock com order + user + materializedCycle (backed by Set) + $transaction.
    function mockFastifyWindow(opts: {
      schedules: ScheduleShape[]
      users: Record<string, UserShape>
      createOrderFn?: ReturnType<typeof vi.fn>
    }) {
      const materialized = new Set<string>()
      const createdOrders = new Set<string>() // rastreia orders criadas → idempotência realista
      const createOrderFn =
        opts.createOrderFn ??
        vi.fn().mockImplementation(({ data }: { data: { userId: string; slotId: string } }) => {
          createdOrders.add(`${data.userId}|${data.slotId}`)
          return Promise.resolve({ id: 'o-1' })
        })
      const upsertFn = vi.fn().mockImplementation(({ where }: { where: { condominiumId_slotId_deliveryDate: { condominiumId: string; slotId: string; deliveryDate: string } } }) => {
        const w = where.condominiumId_slotId_deliveryDate
        materialized.add(`${w.condominiumId}|${w.slotId}|${w.deliveryDate}`)
        return Promise.resolve({})
      })
      const transactionFn = vi.fn().mockImplementation(async (cb: (tx: object) => Promise<void>) =>
        cb({
          order: { create: createOrderFn },
          user: { update: vi.fn().mockResolvedValue({}) },
          creditTransaction: { create: vi.fn().mockResolvedValue({}) },
        }),
      )
      const fastify = {
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        prisma: {
          condominium: {
            findMany: vi.fn().mockResolvedValue([tardeOnlyCondo]),
            findUnique: vi.fn().mockResolvedValue(null),
          },
          schedule: { findMany: vi.fn().mockResolvedValue(opts.schedules) },
          setting: { findUnique: vi.fn().mockResolvedValue(null) },
          deliveryBlock: { findMany: vi.fn().mockResolvedValue([]) },
          order: {
            findFirst: vi.fn().mockImplementation(({ where }: { where: { userId: string; slotId: string } }) =>
              Promise.resolve(createdOrders.has(`${where.userId}|${where.slotId}`) ? { id: 'existing' } : null),
            ),
            count: vi.fn().mockResolvedValue(0),
          },
          user: {
            findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
              Promise.resolve(opts.users[where.id] ?? null),
            ),
          },
          materializedCycle: {
            findFirst: vi.fn().mockImplementation(({ where }: { where: { condominiumId: string; slotId: string; deliveryDate: string } }) =>
              Promise.resolve(materialized.has(`${where.condominiumId}|${where.slotId}|${where.deliveryDate}`) ? { id: 'mc' } : null),
            ),
            upsert: upsertFn,
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
          $transaction: transactionFn,
        },
      } as unknown as FastifyInstance
      return { fastify, createOrderFn, upsertFn }
    }

    it('janela T-2h: no máximo 3 cobranças por (user, slot, dia) e push "sem saldo" SUPRIMIDO', async () => {
      // 2026-06-22T11:30:00Z = segunda 08:30 BRT → dentro da janela [08:00, 10:00) do corte 10:00
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-22T11:30:00Z'))

      const { fastify, createOrderFn } = mockFastifyWindow({
        schedules: [tardeSchedule(1)],
        users: { 'user-w-1': { id: 'user-w-1', creditMilli: 0, condominiumId: 'condo-1', autoRecharge: { active: true }, oneSignalPlayerId: 'p1' } },
      })

      const service = new SchedulesService(fastify)
      const chargeSpy = vi
        .spyOn((service as unknown as { payments: { chargeAutoRecharge: (id: string) => Promise<{ ok: boolean }> } }).payments, 'chargeAutoRecharge')
        .mockResolvedValue({ ok: false })
      const pushMock = (OneSignalModule as unknown as { _createNotificationMock: ReturnType<typeof vi.fn> })._createNotificationMock
      pushMock.mockClear()

      // 5 ticks dentro da janela
      for (let i = 0; i < 5; i++) await service.preconfirmAutoRechargeAhead()

      expect(chargeSpy).toHaveBeenCalledTimes(3) // teto anti-spam
      expect(createOrderFn).not.toHaveBeenCalled() // saldo nunca suficiente → sem order
      expect(pushMock).not.toHaveBeenCalled() // push suprimido na janela (o corte avisa 1x)
    })

    it('janela T-2h: cobrança que dá certo confirma a order e para de cobrar', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-22T11:30:00Z'))

      const user = { id: 'user-w-1', creditMilli: 0, condominiumId: 'condo-1', autoRecharge: { active: true }, oneSignalPlayerId: 'p1' }
      const { fastify, createOrderFn } = mockFastifyWindow({ schedules: [tardeSchedule(1)], users: { 'user-w-1': user } })

      const service = new SchedulesService(fastify)
      // 1ª cobrança credita saldo (simula recarga aprovada)
      vi.spyOn((service as unknown as { payments: { chargeAutoRecharge: (id: string) => Promise<{ ok: boolean }> } }).payments, 'chargeAutoRecharge')
        .mockImplementation(async () => {
          // A recarga credita o saldo CANÔNICO (milésimos) — é o que o serviço relê.
          user.creditMilli = 10000
          return { ok: true }
        })

      await service.preconfirmAutoRechargeAhead()
      await service.preconfirmAutoRechargeAhead()

      expect(createOrderFn).toHaveBeenCalledTimes(1) // confirmou 1x; depois idempotência pularia
    })

    it('backfill: materializa o ciclo 1x mesmo chamado várias vezes (marca persistida)', async () => {
      // 2026-06-22T14:00:00Z = segunda 11:00 BRT → corte da tarde (10:00) JÁ passou
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-22T14:00:00Z'))

      const { fastify, createOrderFn, upsertFn } = mockFastifyWindow({
        schedules: [tardeSchedule(1)],
        users: { 'user-w-1': { id: 'user-w-1', creditMilli: 10000, condominiumId: 'condo-1', autoRecharge: null, oneSignalPlayerId: null } },
      })

      const service = new SchedulesService(fastify)
      await service.backfillMissedCutoffs()
      await service.backfillMissedCutoffs()

      expect(createOrderFn).toHaveBeenCalledTimes(1) // só 1 vez apesar de 2 chamadas
      expect(upsertFn).toHaveBeenCalledTimes(1) // marcou o ciclo 1x
    })
  })

  // ===========================================================================
  // sendPausedTooLongReminders — lembrete de agenda pausada há ≥7 dias (semanal)
  // ===========================================================================
  describe('sendPausedTooLongReminders', () => {
    beforeEach(() => vi.clearAllMocks())

    const NOW = new Date('2026-07-03T00:00:00Z')
    const baseSchedule: ScheduleShape = {
      id: 'sched-pause-1',
      userId: 'user-p1',
      condominiumId: 'condo-1',
      isActive: true,
      weeklyQty: { seg: 2, ter: 0, qua: 2, qui: 0, sex: 2, sab: 0, dom: 0 },
      deliveryTime: '07:00',
      notifyReconfigure: false,
    }
    const user: UserShape = {
      id: 'user-p1',
      creditMilli: 10000,
      condominiumId: 'condo-1',
      autoRecharge: null,
      oneSignalPlayerId: 'player-p1',
    }

    function setup(schedule: ScheduleShape) {
      const fastify = createMockFastify({ schedules: [schedule], users: { 'user-p1': user } })
      ;(fastify.prisma.schedule.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([schedule])
      const createAndTrimMock = vi.fn().mockResolvedValue(undefined)
      const service = new SchedulesService(fastify)
      ;(service as unknown as Record<string, unknown>)['notificationsService'] = { createAndTrim: createAndTrimMock }
      return { fastify, service, createAndTrimMock }
    }

    it('NÃO notifica agenda pausada há menos de 7 dias', async () => {
      const { service, createAndTrimMock, fastify } = setup({
        ...baseSchedule,
        pausedAt: new Date('2026-06-30T00:00:00Z'), // 3 dias antes de NOW
      })
      await service.sendPausedTooLongReminders(NOW)
      expect(createAndTrimMock).not.toHaveBeenCalled()
      expect(fastify.prisma.schedule.update).not.toHaveBeenCalled()
    })

    it('notifica (SCHEDULE_PAUSED) e marca lastPauseReminderAt quando pausada há ≥7 dias e nunca lembrada', async () => {
      const { service, createAndTrimMock, fastify } = setup({
        ...baseSchedule,
        pausedAt: new Date('2026-06-25T00:00:00Z'), // 8 dias antes de NOW
        lastPauseReminderAt: null,
      })
      await service.sendPausedTooLongReminders(NOW)
      expect(createAndTrimMock).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-p1', type: 'SCHEDULE_PAUSED' }),
      )
      expect(fastify.prisma.schedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sched-pause-1' },
          data: { lastPauseReminderAt: NOW },
        }),
      )
    })

    it('NÃO repete quando último lembrete foi há menos de 7 dias', async () => {
      const { service, createAndTrimMock } = setup({
        ...baseSchedule,
        pausedAt: new Date('2026-05-01T00:00:00Z'), // pausada há muito tempo
        lastPauseReminderAt: new Date('2026-06-30T00:00:00Z'), // lembrada há 3 dias
      })
      await service.sendPausedTooLongReminders(NOW)
      expect(createAndTrimMock).not.toHaveBeenCalled()
    })

    it('repete quando último lembrete foi há ≥7 dias', async () => {
      const { service, createAndTrimMock } = setup({
        ...baseSchedule,
        pausedAt: new Date('2026-05-01T00:00:00Z'),
        lastPauseReminderAt: new Date('2026-06-25T00:00:00Z'), // lembrada há 8 dias
      })
      await service.sendPausedTooLongReminders(NOW)
      expect(createAndTrimMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SCHEDULE_PAUSED' }),
      )
    })

    it('ignora agendas não pausadas (pausedAt null/ausente)', async () => {
      const { service, createAndTrimMock } = setup({ ...baseSchedule })
      await service.sendPausedTooLongReminders(NOW)
      expect(createAndTrimMock).not.toHaveBeenCalled()
    })
  })
})
