// CourierService unit tests — Fase 6 / Plano 06-01
// Requirements: COUR-01 (filtro por courierId), COUR-02 (confirmDelivery),
//               COUR-03 (getRoute graceful degradation), COUR-04 (ordenação)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearRouteCache } from '../../../lib/route-engine.js'
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
    scheduledDate?: Date
    slotId?: string
    condominiumId?: string | null
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
    order = { id: 'order-01', userId: 'user-01', courierId: 'courier-01', quantity: 3, status: 'SCHEDULED', scheduledDate: new Date('2026-10-01T15:00:00Z') },
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
      // firstDeliveryDayByUser (selo "1ª entrega" do resumo da parada)
      groupBy: vi.fn().mockResolvedValue([]),
    },
    // Cestinha (Além do Pãozin) pega carona na rota — sem market nestes testes.
    marketOrder: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    // Resumo da parada (gancho) e comprovante (DeliveryProof) — app do entregador, Onda 2.
    hookRequest: {
      findFirst: vi.fn().mockResolvedValue(null),
      // Selos da parada na rota do dia (Onda 8): já tem gancho / gancho nesta rota.
      findMany: vi.fn().mockResolvedValue([]),
    },
    // E11: problema já reportado nas realizadas (Onda 8).
    courierReport: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    deliveryProof: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockImplementation(async ({ data }) => ({ status: 'PENDING', required: true, outcome: 'DELIVERED', photoAt: null, note: null, ...data })),
    },
    // getTodayOrders carrega clientes e condomínios em LOTE (findMany); findUnique segue para os
    // fluxos de confirmação (push do AdminOrdersService).
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      findMany: vi.fn().mockResolvedValue(user ? [user] : []),
    },
    condominium: {
      findUnique: vi.fn().mockResolvedValue(condominium),
      findMany: vi.fn().mockResolvedValue(condominium ? [condominium] : []),
    },
    // getGlobalDeliverySlots (rótulos de turno) consulta setting.findUnique;
    // null => usa DEFAULT_DELIVERY_SLOTS.
    setting: {
      findUnique: vi.fn().mockResolvedValue(null),
      // getRouteConfig (foto visível ao cliente → link do comprovante no aviso de entrega)
      findMany: vi.fn().mockResolvedValue([]),
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif-new' }),
      findMany: vi.fn().mockResolvedValue(makeNotifications(notificationCount)),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    // Rota do dia e rota salva (Onda 5). Sem registro por padrão.
    courierRun: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(async ({ create }) => ({ id: 'run-1', ...create })),
      update: vi.fn().mockImplementation(async ({ data }) => ({ id: 'run-1', ...data })),
    },
    courierRouteTemplate: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(async ({ create }) => ({ id: 'tpl-1', acceptedAt: null, ...create })),
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
    // O motor de rota guarda os traçados em memória — cada teste começa sem cache.
    clearRouteCache()
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
  // Onda 8: selos da parada (1ª entrega, gancho, gancho na rota, recados desligados), acesso do
  // prédio e "reportado" nas realizadas.
  describe('getTodayOrders — selos, acesso e reportado (Onda 8)', () => {
    it('marca 1ª entrega, gancho na rota, recados desligados e o acesso do prédio', async () => {
      const now = new Date()
      const { fastify, prisma } = makeFastifyMock({
        orders: [{ id: 'order-01', userId: 'user-01', courierId: 'courier-01', quantity: 3, status: 'OUT_FOR_DELIVERY', scheduledDate: now, slotId: 'manha', condominiumId: 'condo-01' } as never],
      })
      prisma.user.findMany.mockResolvedValue([{ id: 'user-01', name: 'Maria', condominiumId: 'condo-01', apartment: '101', block: null, complement: null, courierMessagesOff: true }])
      prisma.condominium.findMany.mockResolvedValue([
        { id: 'condo-01', name: 'Residencial Jardins', address: null, lat: -23.5, lng: -46.6, courierAccess: { portaria: '24 h', portao: 'Interfone 0', obs: '' } },
      ])
      prisma.order.groupBy.mockResolvedValue([{ userId: 'user-01', _min: { scheduledDate: now } }])
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
      prisma.hookRequest.findMany.mockImplementation(async ({ where }: { where: { status: string } }) =>
        where.status === 'DELIVERED' ? [] : [{ id: 'hook-01', userId: 'user-01', routeSlotId: 'manha', routeDate: todayStr }],
      )
      vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ code: 'Ok', routes: [] }) } as Response)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await new CourierService(fastify as any).getTodayOrders('courier-01')
      const condo = result.condos[0]
      expect(condo.access).toEqual({ portaria: '24 h', temPorteiro: null, portao: 'Interfone 0', parar: null, obs: null, fotoUrl: null })
      expect(condo.stops[0]).toMatchObject({ isFirstOrder: true, hasHook: false, hookToDeliver: { id: 'hook-01' }, messagesOff: true })
      expect((prisma.hookRequest.findMany.mock.calls as unknown as Array<[{ where: { routeDate?: string } }]>).some(([a]) => a.where.routeDate === todayStr)).toBe(true)
    })
  })

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
          scheduledDate: new Date('2026-10-01T15:00:00Z'),
        },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)

      // Deve resolver sem lancar — AdminOrdersService chama prisma.order.update — e devolve o resumo
      await expect(service.confirmDelivery('order-01', 'courier-01')).resolves.toMatchObject({ kind: 'BREAD', orderId: 'order-01' })

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

      expect(result.routes[0].route).toBeNull()
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

      // Clientes com condominiumId e apartment corretos por usuario (carregados em lote)
      const prismaRef = (fastify as { prisma: typeof makeFastifyMock extends (...args: any[]) => { prisma: infer P } ? P : never }).prisma
      prismaRef.user.findMany.mockResolvedValue([
        { id: 'user-01', name: 'Cliente 101', condominiumId: 'condo-01', apartment: '101', block: null },
        { id: 'user-02', name: 'Cliente 9', condominiumId: 'condo-01', apartment: '9', block: null },
        { id: 'user-03', name: 'Cliente 10', condominiumId: 'condo-01', apartment: '10', block: null },
      ] as never)

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

    it('agrupa por complemento antes do apartamento — o entregador não atravessa o bloco a cada porta', async () => {
      const { fastify } = makeFastifyMock({
        orders: ['101', '102', '103'].map((apt, i) => ({
          id: `order-${apt}`,
          userId: `user-0${i + 1}`,
          courierId: 'courier-01',
          quantity: 1,
          status: 'SCHEDULED',
          scheduledDate: new Date(),
          condominiumId: 'condo-01',
          apartment: apt,
          block: 'A',
        })),
      })

      const fetchMock = vi.mocked(fetch)
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [{ lat: '-23.5', lon: '-46.6' }] } as Response)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ routes: [{ distance: 5000, duration: 600, geometry: { coordinates: [] } }] }),
      } as Response)

      // Intercalados de propósito: 101 (Lado A), 102 (Lado B), 103 (Lado A).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prismaRef = (fastify as any).prisma
      prismaRef.user.findMany.mockResolvedValue([
        { id: 'user-01', name: 'C1', condominiumId: 'condo-01', apartment: '101', block: 'A', complement: 'Lado A' },
        { id: 'user-02', name: 'C2', condominiumId: 'condo-01', apartment: '102', block: 'A', complement: 'Lado B' },
        { id: 'user-03', name: 'C3', condominiumId: 'condo-01', apartment: '103', block: 'A', complement: 'Lado A' },
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)
      const stops = (await service.getTodayOrders('courier-01')).condos[0].stops

      expect(stops.map((s) => s.complement)).toEqual(['Lado A', 'Lado A', 'Lado B'])
      expect(stops.map((s) => s.apartment)).toEqual(['101', '103', '102'])
    })
  })

  // G-10 / G-7 do levantamento do app do entregador
  describe('getTodayOrders — consultas em lote e uma rota por turno', () => {
    const condoAt = (id: string, lat: number, lng: number) => ({
      id,
      name: `Cond ${id}`,
      address: { street: 'Rua', number: '1', city: 'SP', state: 'SP', zip: '00000000' },
      lat,
      lng,
    })
    const order = (id: string, userId: string, slotId: string) => ({
      id,
      userId,
      courierId: 'courier-01',
      quantity: 2,
      status: 'OUT_FOR_DELIVERY',
      slotId,
    })
    const osrmOk = (distance: number) =>
      ({
        ok: true,
        json: async () => ({ routes: [{ distance, duration: 600, geometry: { coordinates: [[-46.6, -23.5]] } }] }),
      }) as Response

    function setup() {
      // Zera respostas de fetch enfileiradas por testes anteriores (clearAllMocks não limpa a fila).
      vi.mocked(fetch).mockReset()
      const { fastify, prisma } = makeFastifyMock({
        orders: [
          order('o1', 'u1', 'manha'),
          order('o2', 'u2', 'manha'),
          order('o3', 'u3', 'tarde'),
          order('o4', 'u4', 'tarde'),
        ] as never,
      })
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'U1', condominiumId: 'cA', apartment: '1', block: null },
        { id: 'u2', name: 'U2', condominiumId: 'cB', apartment: '2', block: null },
        { id: 'u3', name: 'U3', condominiumId: 'cC', apartment: '3', block: null },
        { id: 'u4', name: 'U4', condominiumId: 'cA', apartment: '4', block: null },
      ] as never)
      prisma.condominium.findMany.mockResolvedValue([
        condoAt('cA', -23.51, -46.61),
        condoAt('cB', -23.52, -46.62),
        condoAt('cC', -23.53, -46.63),
      ] as never)
      // Ativas = os 4 pedidos; concluídas = nenhum.
      prisma.order.findMany.mockReset()
      prisma.order.findMany
        .mockResolvedValueOnce([order('o1', 'u1', 'manha'), order('o2', 'u2', 'manha'), order('o3', 'u3', 'tarde'), order('o4', 'u4', 'tarde')])
        .mockResolvedValueOnce([])
      return { fastify, prisma }
    }

    it('carrega clientes e condomínios com UMA consulta por coleção (sem findUnique por parada)', async () => {
      const { fastify, prisma } = setup()
      vi.mocked(fetch).mockResolvedValue(osrmOk(5000))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await new CourierService(fastify as any).getTodayOrders('courier-01')

      expect(prisma.user.findMany).toHaveBeenCalledTimes(1)
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['u1', 'u2', 'u3', 'u4'] } } }),
      )
      expect(prisma.condominium.findMany).toHaveBeenCalledTimes(1)
      // Só leituras do PRÓPRIO entregador (regras, nome no aviso da sugestão) — nenhuma por parada.
      expect(prisma.user.findUnique.mock.calls.every(([a]) => a.where.id === 'courier-01')).toBe(true)
      expect(prisma.condominium.findUnique).not.toHaveBeenCalled()
    })

    // OSRM simulado: matriz pela quantidade de pontos; traçado com km conforme os prédios.
    const osrmByUrl = (fail?: string) => (url: string) => {
      if (fail && url.includes(fail)) return Promise.reject(new Error('OSRM fora'))
      const n = url.split('/driving/')[1].split('?')[0].split(';').length
      if (url.includes('/table/')) {
        return Promise.resolve({ ok: true, json: async () => ({ code: 'Ok', durations: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Math.abs(i - j) * 60)) }) } as Response)
      }
      const distance = url.includes('-46.630000') ? 7000 : 4000
      return Promise.resolve(
        { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance, duration: 600, geometry: { coordinates: [[-46.6, -23.5]] }, legs: Array.from({ length: n - 1 }, () => ({ duration: 300 })) }] }) } as Response,
      )
    }

    it('calcula uma rota por turno, só com os condomínios daquele turno, e já deixa a 1ª sugestão para o admin', async () => {
      const { fastify, prisma } = setup()
      vi.mocked(fetch).mockImplementation(osrmByUrl() as never)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await new CourierService(fastify as any).getTodayOrders('courier-01')

      expect(result.routes.map((r) => r.slotId)).toEqual(['manha', 'tarde'])
      expect(result.routes[0].condominiumIds).toEqual(['cA', 'cB'])
      expect(result.routes[1].condominiumIds).toEqual(['cA', 'cC'])
      expect(result.routes[0].route?.distanceKm).toBe('4.0')
      expect(result.routes[1].route?.distanceKm).toBe('7.0')
      expect(result.routes[0]).toMatchObject({ state: 'pronta', run: null, label: 'Manhã', reorderedToday: false })
      // Cada turno leva só os prédios dele ao OSRM.
      const routeUrls = vi.mocked(fetch).mock.calls.map((c) => String(c[0])).filter((u) => u.includes('/route/'))
      expect(routeUrls.some((u) => u.includes('-46.610000,-23.510000;-46.620000,-23.520000?'))).toBe(true)
      expect(routeUrls.some((u) => u.includes('-46.610000,-23.510000;-46.630000,-23.530000?'))).toBe(true)
      // Sem rota salva: a 1ª sugestão fica gravada para o admin aprovar (uma por turno).
      expect(prisma.courierRouteTemplate.upsert).toHaveBeenCalledTimes(2)
      expect(prisma.courierRouteTemplate.upsert.mock.calls[0][0].create.suggestion).toMatchObject({ reason: 'FIRST', condominiumIds: ['cA', 'cB'] })
      // Hora prevista de cada prédio (trajeto + 1 min por porta).
      expect(result.routes[0].eta.map((e) => e.condominiumId)).toEqual(['cA', 'cB'])
      expect(result.routes[0].eta.every((e) => /^\d{2}:\d{2}$/.test(e.time ?? ''))).toBe(true)
    })

    it('falha do OSRM num turno não derruba a rota do outro', async () => {
      const { fastify } = setup()
      vi.mocked(fetch).mockImplementation(osrmByUrl('-46.620000') as never)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await new CourierService(fastify as any).getTodayOrders('courier-01')

      expect(result.routes[0].route).toBeNull()
      expect(result.routes[0].condominiumIds).toEqual(['cA', 'cB'])
      expect(result.routes[1].route?.distanceKm).toBe('7.0')
    })

    it('rota iniciada usa a ordem do dia (reordenada) e o estado "em rota"', async () => {
      const { fastify, prisma } = setup()
      vi.mocked(fetch).mockImplementation(osrmByUrl() as never)
      prisma.courierRun.findUnique.mockImplementation(async ({ where }: { where: { courierId_date_slotId: { slotId: string } } }) =>
        where.courierId_date_slotId.slotId === 'manha'
          ? { id: 'run-m', status: 'STARTED', condominiumIds: ['cB', 'cA'], reordered: true, startedAt: new Date(), endedAt: null, startMode: 'GPS' }
          : null,
      )
      prisma.courierRouteTemplate.findUnique.mockResolvedValue({ id: 't', acceptedAt: new Date(), condominiumIds: ['cA', 'cB', 'cC'], suggestion: null })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await new CourierService(fastify as any).getTodayOrders('courier-01')

      expect(result.routes[0]).toMatchObject({ condominiumIds: ['cB', 'cA'], state: 'em_rota', reorderedToday: true, run: { id: 'run-m', startMode: 'GPS' } })
      // Tarde segue a rota salva (cA antes de cC) e nenhum prédio novo → sem sugestão.
      expect(result.routes[1].condominiumIds).toEqual(['cA', 'cC'])
      expect(prisma.courierRouteTemplate.upsert).not.toHaveBeenCalled()
    })
  })

  // ── Onda 2 do app do entregador: resumo da parada, 409, idempotência e busca por código ──
  describe('confirmDelivery — resumo da parada (pop-up do scan)', () => {
    const day = new Date('2026-10-01T15:00:00Z')
    const outOrder = { id: '66f1a2b3c4d5e6f7a8b9c0d1', userId: 'user-01', courierId: 'courier-01', quantity: 4, status: 'OUT_FOR_DELIVERY', slotId: 'manha', scheduledDate: day, condominiumId: 'condo-01' }
    const client = { id: 'user-01', name: 'Maria Souza', condominiumId: 'condo-01', apartment: '101', block: '1', complement: 'Lado A' }

    function setup(order: Record<string, unknown> = outOrder) {
      const { fastify, prisma } = makeFastifyMock({ order: order as never, condominium: { id: 'condo-01', name: 'Residencial Jardins' } as never })
      // Validação do entregador e a do AdminOrdersService leem o pedido em rota; a releitura após a
      // transição já o vê entregue.
      prisma.order.findUnique
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce(order)
        .mockResolvedValue({ ...order, status: 'DELIVERED', deliveredAt: new Date('2026-10-01T08:31:00Z') })
      prisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === 'courier-01' ? { courierRules: null } : client,
      )
      prisma.marketOrder.findMany.mockResolvedValue([{ id: 'm1', breadQty: 2, status: 'DELIVERED', deliveredAt: null, failedAt: null, items: [{ name: 'Café 250 g', qty: 1 }] }])
      return { fastify, prisma }
    }

    it('devolve apto, bloco, complemento, cliente, condomínio, pães + Cestinha e foto obrigatória (padrão)', async () => {
      const { fastify } = setup()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const summary = await new CourierService(fastify as any).confirmDelivery(outOrder.id, 'courier-01', { via: 'SCAN' })
      expect(summary).toMatchObject({
        kind: 'BREAD',
        orderId: outOrder.id,
        clientName: 'Maria Souza',
        condominiumName: 'Residencial Jardins',
        apartment: '101',
        block: '1',
        complement: 'Lado A',
        quantity: 6, // 4 do pão + 2 da Cestinha
        marketItems: [{ name: 'Café 250 g', qty: 1 }],
        marketOrderIds: ['m1'],
        proofRequired: true,
        status: 'DELIVERED',
      })
    })

    it('registra o comprovante PENDENTE da parada com o modo e o id da operação', async () => {
      const { fastify, prisma } = setup()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await new CourierService(fastify as any).confirmDelivery(outOrder.id, 'courier-01', { via: 'CODE', clientOpId: 'op-12345678' })
      const call = prisma.deliveryProof.upsert.mock.calls[0][0]
      expect(call.where.courierId_userId_slotId_date_outcome).toEqual({ courierId: 'courier-01', userId: 'user-01', slotId: 'manha', date: '2026-10-01', outcome: 'DELIVERED' })
      expect(call.create).toMatchObject({ status: 'PENDING', required: true, confirmedVia: 'CODE', lastClientOpId: 'op-12345678', orderId: outOrder.id, condominiumId: 'condo-01' })
    })

    it('grava o modo da confirmação e o horário real limitado a agora', async () => {
      const { fastify, prisma } = setup()
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await new CourierService(fastify as any).confirmDelivery(outOrder.id, 'courier-01', { via: 'SCAN', occurredAt: future })
      const extra = prisma.order.update.mock.calls.find((c: Array<{ data: Record<string, unknown> }>) => 'confirmedVia' in c[0].data)
      expect(extra![0].data.confirmedVia).toBe('SCAN')
      expect((extra![0].data.deliveredAt as Date).getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('leitura NOVA de parada já entregue → 409 com o resumo, sem nova transição', async () => {
      const { fastify, prisma } = setup({ ...outOrder, status: 'DELIVERED', deliveredAt: new Date('2026-10-01T09:42:00Z') })
      prisma.deliveryProof.findUnique.mockResolvedValue({ lastClientOpId: 'op-antiga-123' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = await new CourierService(fastify as any).confirmDelivery(outOrder.id, 'courier-01', { clientOpId: 'op-nova-4567' }).catch((e) => e)
      expect(err).toMatchObject({ statusCode: 409, message: 'Essa entrega já foi confirmada' })
      expect(err.summary).toMatchObject({ apartment: '101', deliveredAt: '2026-10-01T09:42:00.000Z' })
      expect(prisma.order.update).not.toHaveBeenCalled()
    })

    it('reenvio da MESMA operação (fila offline) → sucesso silencioso', async () => {
      const { fastify, prisma } = setup({ ...outOrder, status: 'DELIVERED', deliveredAt: new Date('2026-10-01T09:42:00Z') })
      prisma.deliveryProof.findUnique.mockResolvedValue({ lastClientOpId: 'op-12345678' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(new CourierService(fastify as any).confirmDelivery(outOrder.id, 'courier-01', { clientOpId: 'op-12345678' })).resolves.toMatchObject({ apartment: '101' })
      expect(prisma.order.update).not.toHaveBeenCalled()
    })

    it('parada já marcada como não entregue → 409 com o texto certo', async () => {
      const { fastify } = setup({ ...outOrder, status: 'NOT_DELIVERED', failedAt: new Date() })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(new CourierService(fastify as any).confirmDelivery(outOrder.id, 'courier-01')).rejects.toMatchObject({ statusCode: 409, message: 'Essa parada já foi marcada como não entregue' })
    })

    it('Cestinha já entregue → 409 (antes era 422 sem resumo)', async () => {
      const { fastify, prisma } = setup()
      prisma.marketOrder.findUnique.mockResolvedValue({ id: 'm1', userId: 'user-01', courierId: 'courier-01', status: 'DELIVERED', slotId: 'manha', scheduledDate: day, condominiumId: 'condo-01' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(new CourierService(fastify as any).confirmMarketDelivery('m1', 'courier-01')).rejects.toMatchObject({ statusCode: 409 })
    })
  })

  describe('lookupStopsByCode — digitar código (E3)', () => {
    const day = new Date('2026-10-01T15:00:00Z')
    const bread = { id: '66f1a2b3c4d5e6f7a8b9c0d1', userId: 'u1', slotId: 'manha', scheduledDate: day, quantity: 4, status: 'OUT_FOR_DELIVERY', deliveredAt: null, failedAt: null }

    function setup(markets: Array<Record<string, unknown>> = []) {
      const { fastify, prisma } = makeFastifyMock({ condominium: { id: 'c1', name: 'Cond' } as never })
      prisma.order.findMany.mockResolvedValue([bread])
      prisma.marketOrder.findMany.mockImplementation(async (args: { select?: { breadQty?: boolean } }) =>
        args.select?.breadQty ? [] : markets,
      )
      return { fastify, prisma }
    }

    it('código de 6 casa com o pão da parada', async () => {
      const { fastify } = setup()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = await new CourierService(fastify as any).lookupStopsByCode('courier-01', '#b9c0d1')
      expect(m).toHaveLength(1)
      expect(m[0]).toMatchObject({ kind: 'BREAD', id: bread.id })
    })

    it('código de 4 (cupom antigo) também casa', async () => {
      const { fastify } = setup()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(await new CourierService(fastify as any).lookupStopsByCode('courier-01', 'C0D1')).toHaveLength(1)
    })

    it('cupom da Cestinha de parada combinada aponta para o pão (uma entrada por parada)', async () => {
      const { fastify } = setup([{ id: '66f1a2b3c4d5e6f7a8ffffff', userId: 'u1', slotId: 'manha', scheduledDate: day }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = await new CourierService(fastify as any).lookupStopsByCode('courier-01', 'FFFFFF')
      expect(m).toEqual([expect.objectContaining({ kind: 'BREAD', id: bread.id })])
    })

    it('parada só-Cestinha devolve o id da Cestinha', async () => {
      const { fastify } = setup([{ id: '66f1a2b3c4d5e6f7a8aaaaaa', userId: 'u2', slotId: 'tarde', scheduledDate: day }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = await new CourierService(fastify as any).lookupStopsByCode('courier-01', 'AAAAAA')
      expect(m).toEqual([expect.objectContaining({ kind: 'MARKET', id: '66f1a2b3c4d5e6f7a8aaaaaa' })])
    })

    it('nada casa → lista vazia; formato inválido → 400', async () => {
      const { fastify } = setup()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)
      expect(await service.lookupStopsByCode('courier-01', '123456')).toEqual([])
      await expect(service.lookupStopsByCode('courier-01', 'A7K2QX')).rejects.toMatchObject({ statusCode: 400 })
      await expect(service.lookupStopsByCode('courier-01', '12')).rejects.toMatchObject({ statusCode: 400 })
    })
  })

  describe('markNotDelivered', () => {
    it('marca NOT_DELIVERED com motivo quando o pedido é do entregador', async () => {
      const { fastify, prisma } = makeFastifyMock({
        order: { id: 'order-01', userId: 'user-01', courierId: 'courier-01', quantity: 3, status: 'OUT_FOR_DELIVERY', scheduledDate: new Date('2026-10-01T15:00:00Z') },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)
      // App antigo: só o texto (vira "Outro" com o texto dele).
      await service.markNotDelivered('order-01', 'courier-01', { reason: 'Cliente ausente' })

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

  // ── Cestinha (Além do Pãozin) — parada só-market ────────────────────────────
  const marketStop = (over: Record<string, unknown> = {}) => ({
    id: 'm1',
    userId: 'user-01',
    condominiumId: 'condo-01',
    slotId: 'manha',
    scheduledDate: new Date('2026-07-29T15:00:00.000Z'),
    courierId: 'courier-01',
    status: 'OUT_FOR_DELIVERY',
    breadQty: 4,
    ...over,
  })

  describe('confirmMarketDelivery', () => {
    it('conclui TODAS as Cestinhas da parada (cliente + condomínio + turno + dia)', async () => {
      // A tela funde as Cestinhas do cliente numa parada; concluir só o id recebido deixava as
      // outras em OUT_FOR_DELIVERY e elas voltavam para a rota no refresh.
      const { fastify, prisma } = makeFastifyMock()
      prisma.marketOrder.findUnique.mockResolvedValue(marketStop())
      prisma.marketOrder.updateMany.mockResolvedValue({ count: 3 })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await new CourierService(fastify as any).confirmMarketDelivery('m1', 'courier-01')

      expect(prisma.marketOrder.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-01',
          condominiumId: 'condo-01',
          slotId: 'manha',
          courierId: 'courier-01',
          status: 'OUT_FOR_DELIVERY',
        }),
        data: { status: 'DELIVERED', deliveredAt: expect.any(Date) },
      })
      // Nunca por id único — era exatamente o que deixava a parada pela metade.
      expect(prisma.marketOrder.update).not.toHaveBeenCalled()
    })

    it('lança 403 quando a Cestinha é de outro entregador', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.marketOrder.findUnique.mockResolvedValue(marketStop({ courierId: 'outro-courier' }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)
      await expect(service.confirmMarketDelivery('m1', 'courier-01')).rejects.toMatchObject({ statusCode: 403 })
      expect(prisma.marketOrder.updateMany).not.toHaveBeenCalled()
    })

    it('lança 422 quando a Cestinha não está em rota', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.marketOrder.findUnique.mockResolvedValue(marketStop({ status: 'SEPARATED' }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new CourierService(fastify as any)
      await expect(service.confirmMarketDelivery('m1', 'courier-01')).rejects.toMatchObject({ statusCode: 422 })
      expect(prisma.marketOrder.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('markMarketNotDelivered', () => {
    it('marca a parada inteira como NOT_DELIVERED com o motivo', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.marketOrder.findUnique.mockResolvedValue(marketStop())
      prisma.marketOrder.updateMany.mockResolvedValue({ count: 2 })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await new CourierService(fastify as any).markMarketNotDelivered('m1', 'courier-01', { reason: 'Portão fechado' })

      expect(prisma.marketOrder.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ userId: 'user-01', status: 'OUT_FOR_DELIVERY' }),
        data: { status: 'NOT_DELIVERED', failedAt: expect.any(Date), failureReason: 'Portão fechado' },
      })
    })
  })

  describe('getTodayOrders — Cestinha na rota', () => {
    const condo = { id: 'condo-01', name: 'Cond 1', address: { street: 'Rua A', number: '1' } }
    const mkRow = (over: Record<string, unknown>) => ({
      id: 'm1',
      userId: 'user-01',
      breadQty: 4,
      status: 'OUT_FOR_DELIVERY',
      slotId: 'manha',
      items: [{ name: 'Bolo', qty: 1 }],
      ...over,
    })

    it('uma parada só-Cestinha carrega TODOS os ids das cestinhas do turno', async () => {
      const { fastify, prisma } = makeFastifyMock({ orders: [], condominium: condo as never })
      prisma.marketOrder.findMany
        .mockResolvedValueOnce([mkRow({ id: 'm1' }), mkRow({ id: 'm2', items: [{ name: 'Bolo', qty: 2 }] })])
        .mockResolvedValueOnce([])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await new CourierService(fastify as any).getTodayOrders('courier-01')

      expect(result.totalStops).toBe(1)
      const stop = result.condos[0].stops[0]
      expect(stop.orderId).toBe('')
      expect(stop.marketOrderIds).toEqual(['m1', 'm2'])
      expect(stop.marketOrderId).toBe('m1') // endereça a parada; o backend expande o escopo
      expect(stop.quantity).toBe(8) // 4 + 4 pães das cestinhas
      expect(stop.marketItemCount).toBe(3)
    })

    it('não mistura turnos: Cestinha da manhã e da tarde são paradas distintas', async () => {
      const { fastify, prisma } = makeFastifyMock({ orders: [], condominium: condo as never })
      prisma.marketOrder.findMany
        .mockResolvedValueOnce([mkRow({ id: 'm1', slotId: 'manha' }), mkRow({ id: 'm2', slotId: 'tarde' })])
        .mockResolvedValueOnce([])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await new CourierService(fastify as any).getTodayOrders('courier-01')

      expect(result.totalStops).toBe(2)
      expect(result.totalBreads).toBe(8) // sem contar os pães da cestinha duas vezes
      expect(result.condos[0].stops.map((s) => s.slotId).sort()).toEqual(['manha', 'tarde'])
    })

    it('cliente com pão na manhã mantém a parada só-Cestinha da tarde', async () => {
      // Antes o filtro era por cliente: a parada da tarde era descartada como "tem pão" e os
      // itens dela apareciam na parada da manhã.
      const { fastify, prisma } = makeFastifyMock({
        orders: [
          { id: 'order-01', userId: 'user-01', courierId: 'courier-01', quantity: 6, status: 'OUT_FOR_DELIVERY', slotId: 'manha' } as never,
        ],
        condominium: condo as never,
      })
      prisma.order.findMany.mockResolvedValueOnce([
        { id: 'order-01', userId: 'user-01', courierId: 'courier-01', quantity: 6, status: 'OUT_FOR_DELIVERY', slotId: 'manha' },
      ]).mockResolvedValueOnce([])
      prisma.marketOrder.findMany.mockResolvedValueOnce([mkRow({ id: 'm2', slotId: 'tarde' })]).mockResolvedValueOnce([])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await new CourierService(fastify as any).getTodayOrders('courier-01')

      expect(result.totalStops).toBe(2)
      const manha = result.condos[0].stops.find((s) => s.slotId === 'manha')!
      const tarde = result.condos[0].stops.find((s) => s.slotId === 'tarde')!
      expect(manha.marketItemCount).toBe(0) // itens da tarde não vazam para a manhã
      expect(manha.quantity).toBe(6)
      expect(tarde.marketOrderIds).toEqual(['m2'])
      expect(tarde.quantity).toBe(4)
    })

    it('Realizadas: entregue e não entregue do mesmo cliente são linhas separadas', async () => {
      const { fastify, prisma } = makeFastifyMock({ orders: [], condominium: condo as never })
      prisma.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])
      prisma.marketOrder.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
        mkRow({ id: 'm1', status: 'DELIVERED', deliveredAt: new Date('2026-07-29T20:16:00.000Z') }),
        mkRow({ id: 'm2', status: 'NOT_DELIVERED', failedAt: new Date('2026-07-29T20:20:00.000Z') }),
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await new CourierService(fastify as any).getTodayOrders('courier-01')

      expect(result.completedTotal).toBe(2)
      const stops = result.completed[0].stops
      expect(stops.map((s) => s.status).sort()).toEqual(['DELIVERED', 'NOT_DELIVERED'])
      expect(stops.find((s) => s.status === 'DELIVERED')!.marketOrderIds).toEqual(['m1'])
      expect(stops.find((s) => s.status === 'NOT_DELIVERED')!.marketOrderIds).toEqual(['m2'])
    })
  })
})
