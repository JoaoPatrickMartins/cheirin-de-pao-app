// AdminCouriersService unit tests — Fase 7 / Plano 07-03 (Task 1 TDD RED)
// Requirements: ADMG-07 (cadastro de entregadores), ADMG-08 (toggle ativo/inativo)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminCouriersService } from '../admin-couriers.service.js'

// ── makeFastifyMock ───────────────────────────────────────────────────────────
function makeFastifyMock(overrides: {
  courier?: {
    id?: string
    name?: string
    cpf?: string
    phone?: string | null
    email?: string | null
    isBlocked?: boolean
    role?: string
  } | null
  courierList?: Array<{
    id: string
    name: string
    cpf: string
    phone?: string | null
    email?: string | null
    isBlocked: boolean
    role: string
  }>
} = {}) {
  const defaultCourier = {
    id: 'courier-01',
    name: 'João Entregador',
    cpf: '12345678901',
    phone: '(11) 98888-0000',
    email: 'joao@courier.com',
    isBlocked: false,
    role: 'COURIER',
  }

  const {
    courier = defaultCourier,
    courierList = courier ? [courier] : [],
  } = overrides

  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue(courierList),
      findFirst: vi.fn().mockResolvedValue(courier),
      create: vi.fn().mockResolvedValue(courier),
      update: vi.fn().mockResolvedValue({ ...courier, isBlocked: !(courier?.isBlocked ?? false) }),
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
describe('AdminCouriersService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list', () => {
    it('retorna usuários com role=COURIER', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminCouriersService(fastify as any)
      await service.list()

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'COURIER' },
        }),
      )
    })
  })

  describe('create', () => {
    it('cria usuário com role=COURIER', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminCouriersService(fastify as any)

      await service.create({
        name: 'Maria Entregadora',
        cpf: '98765432100',
        phone: '(11) 97777-0000',
        email: 'maria@courier.com',
      })

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'COURIER',
            name: 'Maria Entregadora',
            cpf: '98765432100',
          }),
        }),
      )
    })
  })

  describe('toggle', () => {
    it('alterna isBlocked do entregador de false para true', async () => {
      const { fastify, prisma } = makeFastifyMock({
        courier: {
          id: 'courier-01',
          name: 'João Entregador',
          cpf: '12345678901',
          isBlocked: false,
          role: 'COURIER',
        },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminCouriersService(fastify as any)

      const result = await service.toggle('courier-01')

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'courier-01' },
          data: { isBlocked: true },
        }),
      )
      expect(result).toBeDefined()
    })

    it('lança { statusCode: 404 } quando entregador não existe', async () => {
      const { fastify } = makeFastifyMock({ courier: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminCouriersService(fastify as any)

      await expect(service.toggle('id-inexistente')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/não encontrado/i),
      })
    })

    it('lança { statusCode: 400 } quando user não é COURIER', async () => {
      const { fastify } = makeFastifyMock({
        courier: {
          id: 'admin-01',
          name: 'Admin User',
          cpf: '11111111111',
          isBlocked: false,
          role: 'ADMIN',
        },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminCouriersService(fastify as any)

      await expect(service.toggle('admin-01')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(/COURIER/i),
      })
    })
  })

  describe('updateCourier', () => {
    it('lança { statusCode: 404 } quando entregador não existe', async () => {
      const { fastify } = makeFastifyMock({ courier: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminCouriersService(fastify as any)

      await expect(service.updateCourier('id-inexistente', { name: 'Novo Nome' })).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/não encontrado/i),
      })
    })

    it('atualiza entregador sem alterar cpf', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminCouriersService(fastify as any)

      await service.updateCourier('courier-01', { name: 'Novo Nome' })

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'courier-01' },
          data: expect.not.objectContaining({ cpf: expect.anything() }),
        }),
      )
    })
  })
})
