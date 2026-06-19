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
      update: vi.fn().mockResolvedValue({ ...client, isBlocked: !(client?.isBlocked ?? false) }),
    },
    schedule: {
      findFirst: vi.fn().mockResolvedValue(schedule),
    },
    order: {
      findMany: vi.fn().mockResolvedValue(orders),
    },
    creditTransaction: {
      findFirst: vi.fn().mockResolvedValue(lastTransaction),
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

      await service.list('condo-01')

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'CLIENT', condominiumId: 'condo-01' }),
        }),
      )
    })

    it('busca último CreditTransaction tipo PURCHASE para cada cliente', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const result = await service.list()

      expect(prisma.creditTransaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-01', type: 'PURCHASE' },
          orderBy: { createdAt: 'desc' },
        }),
      )
      // Verifica que lastPurchaseAt está no retorno
      expect(result[0]).toHaveProperty('lastPurchaseAt')
    })

    it('lastPurchaseAt é null quando não há transação', async () => {
      const { fastify } = makeFastifyMock({ lastTransaction: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)

      const result = await service.list()

      expect(result[0].lastPurchaseAt).toBeNull()
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
