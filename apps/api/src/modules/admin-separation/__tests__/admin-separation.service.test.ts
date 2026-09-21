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
  marketOrders?: unknown[]
  users?: unknown[]
  condos?: unknown[]
  order?: unknown
  count?: number
  finalizedSlots?: string[]
  /** Linhas de `groupBy` do selo de estreia: `{ userId, _min: { scheduledDate } }`. */
  firstBreadDays?: unknown[]
  firstMarketDays?: unknown[]
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
      // Selo de estreia (`lib/first-delivery.ts`). Vazio por padrão = ninguém estreia, então as
      // asserções que não falam de primeiro pedido seguem valendo.
      groupBy: vi.fn().mockResolvedValue(opts.firstBreadDays ?? []),
    },
    // Cestinha pega carona na separação — sem market nestes testes.
    marketOrder: {
      findMany: vi.fn().mockResolvedValue(opts.marketOrders ?? []),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      groupBy: vi.fn().mockResolvedValue(opts.firstMarketDays ?? []),
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

    // Selo de estreia: o board é UM dia, então marca quem tem a primeira entrega nesse dia.
    describe('selo de primeiro pedido', () => {
      const orders = [
        { id: 'o1', userId: 'u1', quantity: 4, slotId: 'manha', type: 'SCHEDULED', condominiumId: 'c1', status: 'SCHEDULED' },
        { id: 'o2', userId: 'u2', quantity: 2, slotId: 'manha', type: 'SCHEDULED', condominiumId: 'c1', status: 'SCHEDULED' },
      ]
      const users = [
        { id: 'u1', name: 'Ana', apartment: '101', block: 'A' },
        { id: 'u2', name: 'Bia', apartment: '102', block: 'A' },
      ]
      const condos = [{ id: 'c1', name: 'Cond 1', deliverySlots: SLOTS }]
      /** Meio-dia BRT de um dia — a convenção de `scheduledDate`. */
      const brtNoon = (d: string) => new Date(`${d}T15:00:00.000Z`)

      it('marca só o cliente cuja primeira entrega é o dia do board', async () => {
        const { fastify } = makeMock({
          orders,
          users,
          condos,
          firstBreadDays: [
            { userId: 'u1', _min: { scheduledDate: brtNoon('2026-06-26') } }, // estreia hoje
            { userId: 'u2', _min: { scheduledDate: brtNoon('2026-05-02') } }, // cliente antigo
          ],
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const board = await new AdminSeparationService(fastify as any).getBoard('2026-06-26')

        const manha = board.condominiums[0].slots.find((s) => s.slotId === 'manha')!
        expect(manha.orders.find((o) => o.orderId === 'o1')!.isFirstOrder).toBe(true)
        expect(manha.orders.find((o) => o.orderId === 'o2')!.isFirstOrder).toBe(false)
      })

      it('cliente sem histórico de entrega não é marcado', async () => {
        const { fastify } = makeMock({ orders, users, condos })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const board = await new AdminSeparationService(fastify as any).getBoard('2026-06-26')

        const manha = board.condominiums[0].slots.find((s) => s.slotId === 'manha')!
        expect(manha.orders.every((o) => o.isFirstOrder === false)).toBe(true)
      })

      // A Cestinha mais antiga que o pão manda: quem já recebeu cestinha antes não estreia hoje.
      it('a Cestinha anterior tira o selo do pedido de pão de hoje', async () => {
        const { fastify } = makeMock({
          orders: [orders[0]],
          users: [users[0]],
          condos,
          firstBreadDays: [{ userId: 'u1', _min: { scheduledDate: brtNoon('2026-06-26') } }],
          firstMarketDays: [{ userId: 'u1', _min: { scheduledDate: brtNoon('2026-06-01') } }],
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const board = await new AdminSeparationService(fastify as any).getBoard('2026-06-26')

        const manha = board.condominiums[0].slots.find((s) => s.slotId === 'manha')!
        expect(manha.orders[0].isFirstOrder).toBe(false)
      })
    })

    it('leva o complemento até a linha do pedido e ordena por ele antes do apartamento', async () => {
      // A pilha de cupons sai nesta ordem — precisa bater com a caminhada do entregador.
      const orders = ['101', '102', '103'].map((apt, i) => ({
        id: `o${i + 1}`,
        userId: `u${i + 1}`,
        quantity: 1,
        slotId: 'manha',
        type: 'SCHEDULED',
        condominiumId: 'c1',
        status: 'SCHEDULED',
      }))
      const users = [
        { id: 'u1', name: 'Ana', apartment: '101', block: 'A', complement: 'Lado A' },
        { id: 'u2', name: 'Bia', apartment: '102', block: 'A', complement: 'Lado B' },
        { id: 'u3', name: 'Caio', apartment: '103', block: 'A', complement: 'Lado A' },
      ]
      const condos = [{ id: 'c1', name: 'Cond 1', deliverySlots: SLOTS }]

      const { fastify } = makeMock({ orders, users, condos })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const board = await new AdminSeparationService(fastify as any).getBoard('2026-06-26')
      const manha = board.condominiums[0].slots.find((s) => s.slotId === 'manha')!

      expect(manha.orders.map((o) => o.complement)).toEqual(['Lado A', 'Lado A', 'Lado B'])
      expect(manha.orders.map((o) => o.apartment)).toEqual(['101', '103', '102'])
    })

    it('devolve complemento vazio para cliente sem o campo (documento antigo no Mongo)', async () => {
      const orders = [
        { id: 'o1', userId: 'u1', quantity: 4, slotId: 'manha', type: 'SCHEDULED', condominiumId: 'c1', status: 'SCHEDULED' },
      ]
      const users = [{ id: 'u1', name: 'Ana', apartment: '101', block: 'A' }]
      const condos = [{ id: 'c1', name: 'Cond 1', deliverySlots: SLOTS }]

      const { fastify } = makeMock({ orders, users, condos })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const board = await new AdminSeparationService(fastify as any).getBoard('2026-06-26')
      expect(board.condominiums[0].slots[0].orders[0].complement).toBe('')
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

    it('mescla várias Cestinhas do mesmo cliente numa parada só-market, guardando todos os ids', async () => {
      // Duas compras do mesmo cliente para o mesmo turno viram UMA parada — e o toggle de
      // separação precisa dos dois ids, senão a segunda cestinha fica presa em SCHEDULED.
      const marketOrders = [
        { id: 'm1', userId: 'u1', condominiumId: 'c1', slotId: 'manha', status: 'SCHEDULED', breadQty: 6, items: [{ productId: 'p1', name: 'Bolo', qty: 1 }] },
        { id: 'm2', userId: 'u1', condominiumId: 'c1', slotId: 'manha', status: 'SCHEDULED', breadQty: 4, items: [{ productId: 'p1', name: 'Bolo', qty: 2 }] },
      ]
      const users = [{ id: 'u1', name: 'Ana', apartment: '101', block: 'A' }]
      const condos = [{ id: 'c1', name: 'Cond 1', deliverySlots: SLOTS }]
      // finalizedSlots vazio de propósito: turno 100% Cestinha não tem PO e entra pela 2ª porta.
      const { fastify } = makeMock({ orders: [], marketOrders, users, condos, finalizedSlots: [] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const board = await new AdminSeparationService(fastify as any).getBoard('2026-07-29')

      const slot = board.condominiums[0].slots[0]
      expect(slot.totalDeliveries).toBe(1)
      expect(slot.orders[0].orderId).toBe('')
      expect(slot.orders[0].marketOrderIds).toEqual(['m1', 'm2'])
      expect(slot.orders[0].quantity).toBe(10) // 6 + 4 pães da cestinha
      expect(slot.orders[0].marketItemCount).toBe(3)
      expect(slot.marketPicklist).toEqual([{ productId: 'p1', name: 'Bolo', qty: 3 }])
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

    it('separa também a Cestinha da mesma parada (via propagação do updateOrderStatus)', async () => {
      const { fastify, prisma } = makeMock({
        order: {
          id: 'o1',
          userId: 'u1',
          status: 'SCHEDULED',
          condominiumId: 'c1',
          slotId: 'manha',
          scheduledDate: new Date('2026-07-29T15:00:00.000Z'),
        },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await new AdminSeparationService(fastify as any).setSeparated('o1', true)
      expect(prisma.marketOrder.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'u1',
          condominiumId: 'c1',
          slotId: 'manha',
          status: 'SCHEDULED',
        }),
        data: { status: 'SEPARATED', separatedAt: expect.any(Date) },
      })
    })
  })

  describe('setMarketSeparated', () => {
    it('marca as Cestinhas da parada SCHEDULED → SEPARATED', async () => {
      const { fastify, prisma } = makeMock({
        marketOrders: [
          { id: 'm1', status: 'SCHEDULED' },
          { id: 'm2', status: 'SCHEDULED' },
        ],
      })
      prisma.marketOrder.updateMany.mockResolvedValue({ count: 2 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminSeparationService(fastify as any).setMarketSeparated(['m1', 'm2'], true)
      expect(r).toEqual({ count: 2, status: 'SEPARATED' })
      expect(prisma.marketOrder.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['m1', 'm2'] }, status: 'SCHEDULED' },
        data: { status: 'SEPARATED', separatedAt: expect.any(Date) },
      })
    })

    it('desfaz a separação limpando separatedAt', async () => {
      const { fastify, prisma } = makeMock({ marketOrders: [{ id: 'm1', status: 'SEPARATED' }] })
      prisma.marketOrder.updateMany.mockResolvedValue({ count: 1 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminSeparationService(fastify as any).setMarketSeparated(['m1'], false)
      expect(r.status).toBe('SCHEDULED')
      expect(prisma.marketOrder.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['m1'] }, status: 'SEPARATED' },
        data: { status: 'SCHEDULED', separatedAt: null },
      })
    })

    it('lança 404 quando nenhuma Cestinha existe', async () => {
      const { fastify } = makeMock({ marketOrders: [] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(new AdminSeparationService(fastify as any).setMarketSeparated(['x'], true)).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('lança 422 quando a Cestinha já saiu para entrega', async () => {
      const { fastify } = makeMock({ marketOrders: [{ id: 'm1', status: 'OUT_FOR_DELIVERY' }] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(new AdminSeparationService(fastify as any).setMarketSeparated(['m1'], true)).rejects.toMatchObject({
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
          where: expect.objectContaining({
            condominiumId: { in: ['c1'] },
            slotId: 'manha',
            status: 'SCHEDULED',
          }),
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

  // Seleção múltipla de condomínios na tela → um pedido só, vários lotes.
  describe('concludeMany', () => {
    it('agrupa os condomínios do mesmo turno num único updateMany', async () => {
      const { fastify, prisma } = makeMock({ count: 4 })
      const r = await new AdminSeparationService(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fastify as any,
      ).concludeMany(
        [
          { condominiumId: 'c1', slotId: 'manha' },
          { condominiumId: 'c2', slotId: 'manha' },
          { condominiumId: 'c3', slotId: 'manha' },
        ],
        '2026-06-26',
      )
      expect(prisma.order.updateMany).toHaveBeenCalledTimes(1)
      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            condominiumId: { in: ['c1', 'c2', 'c3'] },
            slotId: 'manha',
            status: 'SCHEDULED',
          }),
        }),
      )
      expect(r.scopes).toBe(3)
      expect(r.count).toBe(4)
    })

    it('separa a Cestinha dos mesmos condomínios e soma no total', async () => {
      const { fastify, prisma } = makeMock({ count: 2 })
      prisma.marketOrder.updateMany.mockResolvedValue({ count: 3 })
      const r = await new AdminSeparationService(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fastify as any,
      ).concludeMany(
        [
          { condominiumId: 'c1', slotId: 'manha' },
          { condominiumId: 'c2', slotId: 'manha' },
        ],
        '2026-06-26',
      )
      expect(prisma.marketOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ condominiumId: { in: ['c1', 'c2'] }, slotId: 'manha', status: 'SCHEDULED' }),
        }),
      )
      // 2 pedidos de pão + 3 Cestinhas
      expect(r.count).toBe(5)
    })

    it('um updateMany por turno — turnos nunca se misturam num só where', async () => {
      const { fastify, prisma } = makeMock({ count: 1 })
      await new AdminSeparationService(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fastify as any,
      ).concludeMany(
        [
          { condominiumId: 'c1', slotId: 'manha' },
          { condominiumId: 'c2', slotId: 'tarde' },
        ],
        '2026-06-26',
      )
      expect(prisma.order.updateMany).toHaveBeenCalledTimes(2)
      const slots = prisma.order.updateMany.mock.calls.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any[]) => c[0].where.slotId,
      )
      expect(slots).toEqual(['manha', 'tarde'])
    })

    it('deduplica o mesmo lote repetido', async () => {
      const { fastify, prisma } = makeMock({ count: 1 })
      const r = await new AdminSeparationService(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fastify as any,
      ).concludeMany(
        [
          { condominiumId: 'c1', slotId: 'manha' },
          { condominiumId: 'c1', slotId: 'manha' },
        ],
        '2026-06-26',
      )
      expect(r.scopes).toBe(1)
      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ condominiumId: { in: ['c1'] } }) }),
      )
    })

    it('não toca no banco quando não há escopo', async () => {
      const { fastify, prisma } = makeMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminSeparationService(fastify as any).concludeMany([], '2026-06-26')
      expect(r).toEqual({ count: 0, scopes: 0 })
      expect(prisma.order.updateMany).not.toHaveBeenCalled()
      expect(prisma.marketOrder.updateMany).not.toHaveBeenCalled()
    })
  })
})
