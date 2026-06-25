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
    },
    order: {
      findMany: vi.fn().mockResolvedValue(orders),
      aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 0 }, _count: 0 }),
      count: vi.fn().mockResolvedValue(0),
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
          where: { userId: 'user-01', isActive: true },
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
          data: { isBlocked: true },
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
})
