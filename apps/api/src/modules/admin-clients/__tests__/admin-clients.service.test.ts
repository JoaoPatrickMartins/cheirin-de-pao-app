// AdminClientsService unit tests — Fase 7 / Plano 07-03 (Task 2 TDD)
// Requirements: ADMG-08 (lista de clientes), ADMG-09 (filtro por condomínio),
//               ADMG-10 (bloquear/desbloquear), T-07-03-04 (role check CLIENT no toggle)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminClientsService } from '../admin-clients.service.js'

// ── makeFastifyMock ───────────────────────────────────────────────────────────
function makeFastifyMock(overrides: {
  client?: {
    id?: string
    name?: string
    email?: string
    isBlocked?: boolean
    role?: string
    condominiumId?: string
    apartment?: string
    block?: string
    creditBalance?: number
    createdAt?: Date
  } | null
  clientList?: Array<{
    id: string
    name: string
    condominiumId: string | null
    apartment: string | null
    block: string | null
    creditBalance: number
    isBlocked: boolean
    createdAt: Date
    role: string
  }>
  schedule?: {
    id: string
    userId: string
    condominiumId: string
    weeklyQty: unknown
    isActive: boolean
  } | null
  orders?: Array<{
    id: string
    userId: string
    scheduledDate: Date
    status: string
    quantity: number
  }>
  /** Cestinhas do cliente (Onda E) — default: nenhuma. */
  marketOrders?: Array<Record<string, unknown>>
  lastTransaction?: {
    id: string
    userId: string
    type: string
    createdAt: Date
  } | null
} = {}) {
  const defaultClient = {
    id: 'user-01',
    name: 'João Cliente',
    email: 'joao@email.com',
    isBlocked: false,
    role: 'CLIENT',
    condominiumId: 'condo-01',
    apartment: '101',
    block: 'A',
    creditBalance: 10,
    createdAt: new Date('2024-01-01'),
  }

  const {
    client = defaultClient,
    clientList = client ? [{ ...defaultClient, ...client }] : [],
    schedule = { id: 'schedule-01', userId: 'user-01', condominiumId: 'condo-01', weeklyQty: {}, isActive: true },
    orders = [],
    marketOrders = [],
    lastTransaction = { id: 'tx-01', userId: 'user-01', type: 'PURCHASE', createdAt: new Date('2024-06-01') },
  } = overrides

  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue(clientList),
      findUnique: vi.fn().mockResolvedValue(client),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ ...client, isBlocked: !(client?.isBlocked ?? false) }),
    },
    schedule: {
      findFirst: vi.fn().mockResolvedValue(schedule),
      update: vi.fn().mockResolvedValue({ id: 'schedule-01', isActive: false }),
    },
    order: {
      findMany: vi.fn().mockResolvedValue(orders),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 'ord-1', status: 'CANCELLED' }),
      aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 0 }, _count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    delivery: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    // Cestinhas do cliente (Onda E — CRM unificado). Default vazio → o fluxo do pão fica idêntico
    // ao histórico, mesmo padrão dos stubs de marketOrder das Ondas A, B e F. Filtra por status
    // como o Prisma faria, para que UMA fixture sirva às três consultas do getDetail (recentes,
    // confirmadas e entregues) sem mock por chamada.
    marketOrder: {
      findMany: vi.fn().mockImplementation((args?: { where?: { status?: unknown } }) => {
        const status = args?.where?.status
        let rows = marketOrders
        if (status && typeof status === 'object' && 'in' in status) {
          const allowed = (status as { in: string[] }).in
          rows = rows.filter((o) => allowed.includes(String(o.status)))
        } else if (typeof status === 'string') {
          rows = rows.filter((o) => o.status === status)
        }
        return Promise.resolve(rows)
      }),
    },
    payment: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    savedCard: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    combo: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    condominium: {
      findUnique: vi.fn().mockResolvedValue({ id: 'condo-01', name: 'Condomínio Teste' }),
    },
    session: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 'sess-01', isRevoked: true }),
    },
    adminNote: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'note-01', userId: 'user-01', body: 'nota', createdAt: new Date() }),
      delete: vi.fn().mockResolvedValue({ id: 'note-01' }),
    },
    creditTransaction: {
      findFirst: vi.fn().mockResolvedValue(lastTransaction),
      findMany: vi.fn().mockResolvedValue(
        lastTransaction
          ? [{ userId: lastTransaction.userId, createdAt: lastTransaction.createdAt }]
          : [],
      ),
      create: vi.fn().mockResolvedValue({ id: 'tx-02', userId: 'user-01', type: 'ADMIN_GRANT', quantity: 5 }),
    },
    $transaction: vi.fn().mockResolvedValue([
      { id: 'tx-02', userId: 'user-01', type: 'ADMIN_GRANT', quantity: 5 },
      { id: 'user-01', name: 'João Cliente', creditBalance: 15 },
    ]),
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif-01', userId: 'user-01', type: 'CREDIT_GRANTED', isRead: false }),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    otpCode: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'otp-01', ...data }),
      ),
      update: vi.fn().mockResolvedValue({ id: 'otp-01' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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
describe('AdminClientsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list', () => {
    it('retorna clientes com role=CLIENT sem filtro', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await service.list()

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'CLIENT' }),
        }),
      )
    })

    it('filtra por condominiumId quando passado', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await service.list({ condominiumId: 'condo-01' })

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'CLIENT', condominiumId: 'condo-01' }),
        }),
      )
    })

    it('resolve lastPurchaseAt via CreditTransaction PURCHASE em uma única query (sem N+1)', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const result = await service.list()

      expect(prisma.creditTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: ['user-01'] }, type: 'PURCHASE' },
          orderBy: { createdAt: 'desc' },
        }),
      )
      // Verifica formato paginado e lastPurchaseAt no item
      expect(result.total).toBe(1)
      expect(result.items[0]).toHaveProperty('lastPurchaseAt')
    })

    it('lastPurchaseAt é null quando não há transação', async () => {
      const { fastify } = makeFastifyMock({ lastTransaction: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const result = await service.list()

      expect(result.items[0].lastPurchaseAt).toBeNull()
    })
  })

  describe('getDetail', () => {
    it('retorna cliente com Schedule ativo e Orders dos últimos 30 dias', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const result = await service.getDetail('user-01')

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-01' } })
      expect(prisma.schedule.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-01' },
        }),
      )
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-01' }),
        }),
      )
      expect(result).toHaveProperty('client')
      expect(result).toHaveProperty('schedule')
      expect(result).toHaveProperty('recentOrders')
    })

    it('inclui condomínio e métricas agregadas', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const result = await service.getDetail('user-01')

      expect(prisma.payment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-01', status: 'PAID' } }),
      )
      expect(prisma.order.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-01', status: 'DELIVERED' } }),
      )
      expect(prisma.condominium.findUnique).toHaveBeenCalled()
      expect(result).toHaveProperty('condominium')
      expect(result.metrics).toMatchObject({
        totalSpent: expect.any(Number),
        breadsDelivered: expect.any(Number),
        ordersCount: expect.any(Number),
        weeklyBreads: expect.any(Number),
      })
    })

    it('lança { statusCode: 404 } quando cliente não existe', async () => {
      const { fastify } = makeFastifyMock({ client: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(service.getDetail('id-inexistente')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/não encontrado/i),
      })
    })

    it('lança { statusCode: 404 } quando user existe mas não é CLIENT', async () => {
      const { fastify } = makeFastifyMock({
        client: { id: 'admin-01', name: 'Admin User', role: 'ADMIN', isBlocked: false },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(service.getDetail('admin-01')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/não encontrado/i),
      })
    })
  })

  describe('updateClient', () => {
    it('atualiza nome e contato do cliente', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await service.updateClient('user-01', { name: 'João Editado', phone: '11999990000' })

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-01' },
          data: expect.objectContaining({ name: 'João Editado', phone: '11999990000' }),
        }),
      )
    })

    it('lança { statusCode: 404 } quando cliente não existe', async () => {
      const { fastify } = makeFastifyMock({ client: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(service.updateClient('x', { name: 'Nome' })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('lança { statusCode: 409 } quando telefone já pertence a outro cliente', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'outro-user' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(service.updateClient('user-01', { phone: '11888887777' })).rejects.toMatchObject({
        statusCode: 409,
      })
    })
  })

  describe('getCreditHistory', () => {
    it('busca transações do cliente ordenadas e retorna array', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const result = await service.getCreditHistory('user-01', 25)

      expect(prisma.creditTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-01' },
          orderBy: { createdAt: 'desc' },
          take: 25,
        }),
      )
      expect(Array.isArray(result)).toBe(true)
    })

    it('lança { statusCode: 404 } quando não é CLIENT', async () => {
      const { fastify } = makeFastifyMock({ client: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      await expect(service.getCreditHistory('x')).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('getPayments', () => {
    it('marca refundable e rotula compra avulsa', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.payment.findMany.mockResolvedValueOnce([
        { id: 'pay-1', userId: 'user-01', amount: 50, method: 'PIX', status: 'PAID', stripePaymentIntentId: 'pi_1', comboId: null, customQuantity: 30, createdAt: new Date() },
        { id: 'pay-2', userId: 'user-01', amount: 20, method: 'PIX', status: 'PENDING', stripePaymentIntentId: null, comboId: null, customQuantity: 12, createdAt: new Date() },
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const result = await service.getPayments('user-01')

      expect(result[0]).toMatchObject({ id: 'pay-1', refundable: true, label: 'Compra avulsa', quantity: 30 })
      expect(result[1]).toMatchObject({ id: 'pay-2', refundable: false })
    })
  })

  describe('getPaymentMethods', () => {
    it('retorna cartões e auto-recarga', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const result = await service.getPaymentMethods('user-01')

      expect(result).toHaveProperty('cards')
      expect(result).toHaveProperty('autoRecharge')
      expect(Array.isArray(result.cards)).toBe(true)
    })

    it('lança { statusCode: 404 } quando não é CLIENT', async () => {
      const { fastify } = makeFastifyMock({ client: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      await expect(service.getPaymentMethods('x')).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('getOrders', () => {
    it('mescla dados de entrega (courier, deliveredAt) por pedido', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.order.findMany.mockResolvedValueOnce([
        { id: 'ord-1', userId: 'user-01', type: 'SCHEDULED', quantity: 2, status: 'DELIVERED', scheduledDate: new Date(), slotId: 'manha', deliveryTime: '06:30', courierId: 'cou-1' },
      ])
      prisma.delivery.findMany.mockResolvedValueOnce([
        { orderId: 'ord-1', deliveredAt: new Date('2026-06-20'), confirmedAt: new Date('2026-06-20'), status: 'CONFIRMED' },
      ])
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'cou-1', name: 'Entregador X' }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const result = await service.getOrders('user-01')

      expect(result[0]).toMatchObject({
        id: 'ord-1',
        status: 'DELIVERED',
        courierName: 'Entregador X',
        deliveryStatus: 'CONFIRMED',
      })
      expect(result[0].deliveredAt).toBeTruthy()
    })

    it('lança { statusCode: 404 } quando não é CLIENT', async () => {
      const { fastify } = makeFastifyMock({ client: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      await expect(service.getOrders('x')).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('cancelOrder', () => {
    it('cancela pedido SCHEDULED e devolve créditos quando refundCredits=true', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.order.findUnique.mockResolvedValueOnce({ id: 'ord-1', userId: 'user-01', status: 'SCHEDULED', quantity: 2 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const result = await service.cancelOrder('user-01', 'ord-1', true, 'admin-01')

      expect(prisma.$transaction).toHaveBeenCalled()
      // com refund: cria CreditTransaction REFUND + incrementa saldo
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'REFUND', quantity: 2, adminId: 'admin-01' }) }),
      )
      expect(result).toMatchObject({ id: 'ord-1', status: 'CANCELLED', refundedCredits: 2 })
    })

    it('não cria transação de crédito quando refundCredits=false', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.order.findUnique.mockResolvedValueOnce({ id: 'ord-1', userId: 'user-01', status: 'SCHEDULED', quantity: 2 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const result = await service.cancelOrder('user-01', 'ord-1', false, 'admin-01')

      expect(prisma.creditTransaction.create).not.toHaveBeenCalled()
      expect(result.refundedCredits).toBe(0)
    })

    it('lança 422 quando pedido não é SCHEDULED', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.order.findUnique.mockResolvedValueOnce({ id: 'ord-1', userId: 'user-01', status: 'DELIVERED', quantity: 2 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      await expect(service.cancelOrder('user-01', 'ord-1', true, 'admin-01')).rejects.toMatchObject({ statusCode: 422 })
    })

    it('lança 404 quando pedido pertence a outro cliente', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.order.findUnique.mockResolvedValueOnce({ id: 'ord-1', userId: 'outro', status: 'SCHEDULED', quantity: 2 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      await expect(service.cancelOrder('user-01', 'ord-1', true, 'admin-01')).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('setScheduleActive', () => {
    it('pausa a agenda (isActive=false)', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const result = await service.setScheduleActive('user-01', false)

      expect(prisma.schedule.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'schedule-01' }, data: { isActive: false } }),
      )
      expect(result.isActive).toBe(false)
    })

    it('lança 404 quando não há agenda', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.schedule.findFirst.mockResolvedValueOnce(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      await expect(service.setScheduleActive('user-01', false)).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('sessões', () => {
    it('lista sessões ativas (não revogadas, não expiradas)', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      await service.getSessions('user-01')
      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'user-01', isRevoked: false }) }),
      )
    })

    it('revoga sessão do cliente', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.session.findUnique.mockResolvedValueOnce({ id: 'sess-01', userId: 'user-01' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      const result = await service.revokeSession('user-01', 'sess-01')
      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sess-01' }, data: { isRevoked: true } }),
      )
      expect(result.isRevoked).toBe(true)
    })

    it('lança 404 ao revogar sessão de outro cliente', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.session.findUnique.mockResolvedValueOnce({ id: 'sess-01', userId: 'outro' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      await expect(service.revokeSession('user-01', 'sess-01')).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('notas internas', () => {
    it('cria nota com adminId', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      await service.addNote('user-01', 'Cliente VIP', 'admin-01')
      expect(prisma.adminNote.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId: 'user-01', adminId: 'admin-01', body: 'Cliente VIP' } }),
      )
    })

    it('exclui nota do cliente', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.adminNote.findUnique.mockResolvedValueOnce({ id: 'note-01', userId: 'user-01' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      const result = await service.deleteNote('user-01', 'note-01')
      expect(prisma.adminNote.delete).toHaveBeenCalledWith({ where: { id: 'note-01' } })
      expect(result.deleted).toBe(true)
    })

    it('lança 404 ao excluir nota de outro cliente', async () => {
      const { fastify, prisma } = makeFastifyMock()
      prisma.adminNote.findUnique.mockResolvedValueOnce({ id: 'note-01', userId: 'outro' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      await expect(service.deleteNote('user-01', 'note-01')).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('blockToggle', () => {
    it('altera User.isBlocked para true (bloquear)', async () => {
      const { fastify, prisma } = makeFastifyMock({
        client: {
          id: 'user-01',
          name: 'João Cliente',
          email: 'joao@email.com',
          isBlocked: false,
          role: 'CLIENT',
          condominiumId: 'condo-01',
        },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      const result = await service.blockToggle('user-01')

      expect(result).toBeDefined()
      expect(result.isBlocked).toBe(true)
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-01' },
          data: expect.objectContaining({ isBlocked: true }),
        }),
      )
    })

    it('grava motivo + quem/quando ao bloquear', async () => {
      const { fastify, prisma } = makeFastifyMock({
        client: { id: 'user-01', name: 'João', role: 'CLIENT', isBlocked: false },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      await service.blockToggle('user-01', 'Pagamento pendente', 'admin-01')
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isBlocked: true, blockReason: 'Pagamento pendente', blockedById: 'admin-01' }),
        }),
      )
    })

    it('limpa o contexto de bloqueio ao desbloquear', async () => {
      const { fastify, prisma } = makeFastifyMock({
        client: { id: 'user-01', name: 'João', role: 'CLIENT', isBlocked: true },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      await service.blockToggle('user-01', undefined, 'admin-01')
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isBlocked: false, blockReason: null, blockedAt: null, blockedById: null }),
        }),
      )
    })

    it('lança { statusCode: 404 } quando cliente não existe', async () => {
      const { fastify } = makeFastifyMock({ client: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(service.blockToggle('id-inexistente')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/não encontrado/i),
      })
    })

    it('T-07-03-04: lança { statusCode: 404 } quando user não é CLIENT (ex: ADMIN)', async () => {
      const { fastify } = makeFastifyMock({
        client: { id: 'admin-01', name: 'Admin User', role: 'ADMIN', isBlocked: false },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      // T-07-03-04: blockToggle não pode ser usado para bloquear outros ADMINs ou COURIERs
      await expect(service.blockToggle('admin-01')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/não encontrado/i),
      })
    })

    // Compatibilidade retroativa com teste Wave 0 (blockClient)
    it('blockClient altera User.isBlocked para true', async () => {
      const { fastify } = makeFastifyMock({
        client: {
          id: 'user-01',
          name: 'João Cliente',
          email: 'joao@email.com',
          isBlocked: false,
          role: 'CLIENT',
          condominiumId: 'condo-01',
        },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      const result = await service.blockClient('user-01')

      expect(result).toBeDefined()
      expect(result.isBlocked).toBe(true)
    })
  })

  // ── grantCredits — RED phase (stubs para Plan 10-02 implementar) ──────────────
  describe('grantCredits', () => {
    it('cria CreditTransaction ADMIN_GRANT e incrementa creditBalance via $transaction', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const result = await service.grantCredits('user-01', { quantity: 5, reason: 'Acerto', adminId: 'admin-01' })

      expect(prisma.$transaction).toHaveBeenCalled()
      expect(result.creditBalance).toBe(15)
    })

    it('lança { statusCode: 404 } quando cliente não existe', async () => {
      const { fastify } = makeFastifyMock({ client: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(
        service.grantCredits('id-inexistente', { quantity: 5, reason: 'Acerto', adminId: 'admin-01' }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/não encontrado/i),
      })
    })

    it('lança { statusCode: 404 } quando user não é CLIENT', async () => {
      const { fastify } = makeFastifyMock({
        client: { id: 'admin-01', name: 'Admin User', role: 'ADMIN', isBlocked: false },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(
        service.grantCredits('admin-01', { quantity: 5, reason: 'Acerto', adminId: 'admin-01' }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/não encontrado/i),
      })
    })

    it('lança { statusCode: 400 } quando quantity é menor que 1', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(
        service.grantCredits('user-01', { quantity: 0, reason: 'Acerto', adminId: 'admin-01' }),
      ).rejects.toMatchObject({ statusCode: 400 })
    })
  })

  describe('removeCredits', () => {
    it('cria CreditTransaction ADMIN_DEBIT com quantity negativo e decrementa creditBalance', async () => {
      const { fastify, prisma } = makeFastifyMock() // creditBalance default = 10
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await service.removeCredits('user-01', { quantity: 5, reason: 'Estorno', adminId: 'admin-01' })

      expect(prisma.$transaction).toHaveBeenCalled()
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'ADMIN_DEBIT',
            quantity: -5,
            reason: 'Estorno',
            adminId: 'admin-01',
          }),
        }),
      )
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { creditBalance: { decrement: 5 } },
        }),
      )
    })

    it('lança { statusCode: 422 } quando quantity é maior que o saldo atual', async () => {
      const { fastify, prisma } = makeFastifyMock() // creditBalance default = 10
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(
        service.removeCredits('user-01', { quantity: 20, reason: 'Estorno', adminId: 'admin-01' }),
      ).rejects.toMatchObject({ statusCode: 422 })
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('lança { statusCode: 404 } quando cliente não existe', async () => {
      const { fastify } = makeFastifyMock({ client: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(
        service.removeCredits('id-inexistente', { quantity: 5, reason: 'Estorno', adminId: 'admin-01' }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/não encontrado/i),
      })
    })

    it('lança { statusCode: 400 } quando quantity é menor que 1', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(
        service.removeCredits('user-01', { quantity: 0, reason: 'Estorno', adminId: 'admin-01' }),
      ).rejects.toMatchObject({ statusCode: 400 })
    })
  })

  describe('generateAccessCode', () => {
    it('gera um código admin-manual e retorna { code, expiresAt } para um CLIENT válido', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const { code, expiresAt } = await service.generateAccessCode('user-01', 60, 'admin-01')

      expect(code).toMatch(/^\d{4}$/)
      expect(expiresAt).toBeInstanceOf(Date)
      // grava o OTP com origem admin-manual e purpose LOGIN
      expect(prisma.otpCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ channel: 'admin-manual', purpose: 'LOGIN', userId: 'user-01' }),
        }),
      )
    })

    it('lança { statusCode: 404 } quando o cliente não existe', async () => {
      const { fastify } = makeFastifyMock({ client: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(service.generateAccessCode('inexistente', 60, 'admin-01')).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('lança { statusCode: 404 } quando o usuário não é CLIENT', async () => {
      const { fastify } = makeFastifyMock({ client: { role: 'ADMIN' } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(service.generateAccessCode('user-01', 60, 'admin-01')).rejects.toMatchObject({
        statusCode: 404,
      })
    })

    it('lança { statusCode: 409 } quando o cliente está bloqueado', async () => {
      const { fastify } = makeFastifyMock({
        client: { id: 'user-01', name: 'João', email: 'joao@email.com', role: 'CLIENT', isBlocked: true },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(service.generateAccessCode('user-01', 60, 'admin-01')).rejects.toMatchObject({
        statusCode: 409,
      })
    })

    it('lança { statusCode: 422 } quando o cliente não tem e-mail', async () => {
      const { fastify } = makeFastifyMock({
        client: { id: 'user-01', name: 'João', email: undefined, role: 'CLIENT', isBlocked: false },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      await expect(service.generateAccessCode('user-01', 60, 'admin-01')).rejects.toMatchObject({
        statusCode: 422,
      })
    })
  })

  // ── Onda E — a Cestinha no CRM ──────────────────────────────────────────────
  // Antes disto o suporte não tinha NENHUMA forma de ver uma Cestinha do cliente: o detalhe e a
  // lista de pedidos leem só `Order`.
  describe('Cestinha no detalhe do cliente (E1)', () => {
    const cestinha = (over: Record<string, unknown> = {}) => ({
      id: 'mo-1',
      status: 'DELIVERED',
      scheduledDate: new Date('2026-07-28T15:00:00.000Z'),
      slotId: 'manha',
      deliveryTime: '08:00',
      breadQty: 4,
      items: [{ productId: 'p1', name: 'Bolo', qty: 2, unitPrice: 12 }],
      totalValue: 30,
      creditsApplied: 5,
      moneyAmount: 6,
      ...over,
    })

    it('devolve recentCestinhas com os itens e o itemCount somado', async () => {
      const { fastify } = makeFastifyMock({ marketOrders: [cestinha({ items: [{ productId: 'p1', name: 'Bolo', qty: 2, unitPrice: 12 }, { productId: 'p2', name: 'Geleia', qty: 3, unitPrice: 8 }] })] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = await new AdminClientsService(fastify as any).getDetail('user-01')

      expect(detail.recentCestinhas).toHaveLength(1)
      expect(detail.recentCestinhas[0]).toMatchObject({ id: 'mo-1', breadQty: 4, itemCount: 5 })
      expect(detail.recentCestinhas[0].items).toEqual([{ name: 'Bolo', qty: 2 }, { name: 'Geleia', qty: 3 }])
    })

    it('D-1: breadsDelivered SOMA o breadQty da Cestinha entregue', async () => {
      const { fastify } = makeFastifyMock({ marketOrders: [cestinha({ breadQty: 4 })] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prisma = (fastify as any).prisma
      prisma.order.aggregate = vi.fn().mockResolvedValue({ _sum: { quantity: 10 }, _count: 3 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = await new AdminClientsService(fastify as any).getDetail('user-01')

      expect(detail.metrics.breadsDelivered).toBe(14) // 10 do Order + 4 da Cestinha
      // D-1: itens NUNCA entram no contador de pães.
      expect(detail.metrics.itemsDelivered).toBe(2)
    })

    it('GMV e contagem usam a MESMA população — aguardando pagamento e cancelada ficam fora', async () => {
      const { fastify } = makeFastifyMock({
        marketOrders: [
          cestinha({ id: 'ok-1', status: 'DELIVERED', totalValue: 30, creditsApplied: 5 }),
          cestinha({ id: 'ok-2', status: 'SCHEDULED', totalValue: 20, creditsApplied: 2 }),
          cestinha({ id: 'x-1', status: 'PENDING_PAYMENT', totalValue: 99, creditsApplied: 9 }),
          cestinha({ id: 'x-2', status: 'CANCELLED', totalValue: 77, creditsApplied: 7 }),
        ],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = await new AdminClientsService(fastify as any).getDetail('user-01')

      expect(detail.metrics.cestinhasCount).toBe(2)
      expect(detail.metrics.cestinhaGmv).toBe(50)
      expect(detail.metrics.cestinhaCredits).toBe(7)
      // recentCestinhas mostra TUDO (é auditoria — inclusive o que caiu).
      expect(detail.recentCestinhas).toHaveLength(4)
    })

    it('D-2: totalSpent vem decomposto em crédito × Cestinha (dinheiro), sem GMV', async () => {
      const { fastify } = makeFastifyMock({ marketOrders: [cestinha({ totalValue: 30, moneyAmount: 6 })] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prisma = (fastify as any).prisma
      prisma.payment.aggregate = vi.fn().mockImplementation((args: { where: { purpose?: string } }) => {
        if (args.where.purpose === 'MARKET') return Promise.resolve({ _sum: { amount: 6 }, _count: 1 })
        if ('NOT' in args.where) return Promise.resolve({ _sum: { amount: 120 }, _count: 4 })
        return Promise.resolve({ _sum: { amount: 126 }, _count: 5 })
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = await new AdminClientsService(fastify as any).getDetail('user-01')

      expect(detail.metrics.totalSpent).toBe(126)
      expect(detail.metrics.spentOnCredits).toBe(120)
      expect(detail.metrics.spentOnCestinha).toBe(6)
      // O GMV (30) é grandeza separada e não entra em nenhum "gasto".
      expect(detail.metrics.cestinhaGmv).toBe(30)
    })

    it('cliente sem nenhuma Cestinha → métricas zeradas e lista vazia (sem regressão no pão)', async () => {
      const { fastify } = makeFastifyMock({})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = await new AdminClientsService(fastify as any).getDetail('user-01')

      expect(detail.recentCestinhas).toEqual([])
      expect(detail.metrics).toMatchObject({ cestinhasCount: 0, cestinhaGmv: 0, itemsDelivered: 0 })
    })
  })

  describe('getOrders unificado (E2)', () => {
    const order = (over: Record<string, unknown> = {}) => ({
      id: 'ord-1',
      userId: 'user-01',
      type: 'SINGLE',
      quantity: 6,
      status: 'DELIVERED',
      scheduledDate: new Date('2026-07-20T15:00:00.000Z'),
      slotId: 'manha',
      deliveryTime: '08:00',
      courierId: null,
      ...over,
    })
    const cestinha = (over: Record<string, unknown> = {}) => ({
      id: 'mo-1',
      userId: 'user-01',
      status: 'SCHEDULED',
      scheduledDate: new Date('2026-07-25T15:00:00.000Z'),
      slotId: 'tarde',
      deliveryTime: '15:00',
      courierId: null,
      breadQty: 4,
      items: [{ productId: 'p1', name: 'Bolo', qty: 2, unitPrice: 12 }],
      totalValue: 30,
      creditsApplied: 5,
      moneyAmount: 6,
      deliveredAt: null,
      ...over,
    })

    it('une pão e Cestinha ordenados por data desc, com kind', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { fastify } = makeFastifyMock({ orders: [order()] as any, marketOrders: [cestinha()] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await new AdminClientsService(fastify as any).getOrders('user-01')

      expect(rows.map((r) => [r.kind, r.id])).toEqual([
        ['CESTINHA', 'mo-1'], // 25/07 é mais recente
        ['BREAD', 'ord-1'],
      ])
    })

    it('linha da Cestinha: type MARKET, quantity = breadQty (D-1) e itens à parte', async () => {
      const { fastify } = makeFastifyMock({ marketOrders: [cestinha()] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await new AdminClientsService(fastify as any).getOrders('user-01')

      expect(rows[0]).toMatchObject({
        kind: 'CESTINHA',
        type: 'MARKET', // nunca 'SINGLE' — a tela chamaria a Cestinha de "Avulso"
        quantity: 4,
        itemCount: 2,
        totalValue: 30,
        creditsApplied: 5,
        moneyAmount: 6,
      })
      expect(rows[0].items).toEqual([{ name: 'Bolo', qty: 2 }])
    })

    it('linha de pão continua sem campos de Cestinha (null/vazio), sem regressão', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { fastify } = makeFastifyMock({ orders: [order()] as any })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await new AdminClientsService(fastify as any).getOrders('user-01')

      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ kind: 'BREAD', type: 'SINGLE', quantity: 6, itemCount: 0, totalValue: null })
      expect(rows[0].items).toEqual([])
    })

    it('refundedCredits vem das MARKET_REFUND do pedido', async () => {
      const { fastify } = makeFastifyMock({ marketOrders: [cestinha({ status: 'CANCELLED' })] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(fastify as any).prisma.creditTransaction.findMany = vi
        .fn()
        .mockResolvedValue([{ referenceId: 'mo-1', quantity: 6 }])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await new AdminClientsService(fastify as any).getOrders('user-01')

      expect(rows[0].refundedCredits).toBe(6)
    })

    it('limit corta a janela DEPOIS de unir — não N de cada coleção', async () => {
      const { fastify } = makeFastifyMock({
        orders: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          order({ id: 'ord-antigo', scheduledDate: new Date('2026-07-01T15:00:00.000Z') }) as any,
        ],
        marketOrders: [
          cestinha({ id: 'mo-novo', scheduledDate: new Date('2026-07-28T15:00:00.000Z') }),
          cestinha({ id: 'mo-meio', scheduledDate: new Date('2026-07-27T15:00:00.000Z') }),
        ],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await new AdminClientsService(fastify as any).getOrders('user-01', 2)

      // As 2 linhas mais recentes do conjunto UNIDO são as duas Cestinhas — o pedido de pão
      // antigo fica fora, mesmo sendo o único da sua coleção.
      expect(rows.map((r) => r.id)).toEqual(['mo-novo', 'mo-meio'])
    })
  })
})
