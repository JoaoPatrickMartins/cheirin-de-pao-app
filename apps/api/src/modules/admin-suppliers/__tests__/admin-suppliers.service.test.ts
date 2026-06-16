// AdminSuppliersService unit tests — Fase 7 / Plano 07-03 (Task 1 TDD RED)
// Requirements: ADMG-05 (CRUD fornecedores), ADMG-06 (isPrincipal único)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminSuppliersService } from '../admin-suppliers.service.js'

// ── makeFastifyMock ───────────────────────────────────────────────────────────
function makeFastifyMock(overrides: {
  supplier?: {
    id?: string
    name?: string
    cnpj?: string
    phone?: string | null
    email?: string | null
    pricePerUnit?: number
    isPrincipal?: boolean
    isActive?: boolean
    address?: {
      street: string
      number: string
      city: string
      state: string
      zip: string
    }
  } | null
  supplierList?: Array<{
    id: string
    name: string
    cnpj: string
    isPrincipal: boolean
  }>
} = {}) {
  const defaultSupplier = {
    id: 'supplier-01',
    name: 'Padaria Central',
    cnpj: '12345678000190',
    phone: '(11) 99999-0000',
    email: 'padaria@email.com',
    pricePerUnit: 1.5,
    isPrincipal: false,
    isActive: true,
    address: {
      street: 'Rua das Flores',
      number: '100',
      city: 'São Paulo',
      state: 'SP',
      zip: '01310-100',
    },
  }

  const {
    supplier = defaultSupplier,
    supplierList = supplier ? [supplier] : [],
  } = overrides

  const prisma = {
    supplier: {
      findMany: vi.fn().mockResolvedValue(supplierList),
      findUnique: vi.fn().mockResolvedValue(supplier),
      create: vi.fn().mockResolvedValue(supplier),
      update: vi.fn().mockResolvedValue(supplier),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue(supplier),
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
describe('AdminSuppliersService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list', () => {
    it('retorna lista de fornecedores ordenada por nome', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSuppliersService(fastify as any)
      const result = await service.list()

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      )
      expect(result).toBeInstanceOf(Array)
    })
  })

  describe('create', () => {
    it('cria fornecedor com isPrincipal=false sem desativar outros', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSuppliersService(fastify as any)

      await service.create({
        name: 'Padaria Central',
        cnpj: '12345678000190',
        pricePerUnit: 1.5,
        isPrincipal: false,
        address: { street: 'Rua das Flores', number: '100', city: 'SP', state: 'SP', zip: '01310-100' },
      })

      expect(prisma.supplier.updateMany).not.toHaveBeenCalled()
      expect(prisma.supplier.create).toHaveBeenCalledTimes(1)
    })

    it('quando isPrincipal=true, desativa outros antes de criar', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSuppliersService(fastify as any)

      await service.create({
        name: 'Nova Padaria Principal',
        cnpj: '98765432000100',
        pricePerUnit: 2.0,
        isPrincipal: true,
        address: { street: 'Av. Paulista', number: '1000', city: 'SP', state: 'SP', zip: '01310-100' },
      })

      // updateMany deve ser chamado antes do create para desativar os outros
      expect(prisma.supplier.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPrincipal: true },
          data: { isPrincipal: false },
        }),
      )
      expect(prisma.supplier.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('update', () => {
    it('lança { statusCode: 404 } quando fornecedor não existe', async () => {
      const { fastify } = makeFastifyMock({ supplier: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSuppliersService(fastify as any)

      await expect(service.update('id-inexistente', { name: 'Novo Nome' })).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/não encontrado/i),
      })
    })

    it('quando isPrincipal=true no update, desativa outros antes', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSuppliersService(fastify as any)

      await service.update('supplier-01', { isPrincipal: true })

      expect(prisma.supplier.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPrincipal: true },
          data: { isPrincipal: false },
        }),
      )
    })
  })

  describe('remove', () => {
    it('lança { statusCode: 404 } quando fornecedor não existe', async () => {
      const { fastify } = makeFastifyMock({ supplier: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSuppliersService(fastify as any)

      await expect(service.remove('id-inexistente')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringMatching(/não encontrado/i),
      })
    })

    it('chama prisma.supplier.delete quando fornecedor existe', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSuppliersService(fastify as any)

      await service.remove('supplier-01')

      expect(prisma.supplier.delete).toHaveBeenCalledWith({ where: { id: 'supplier-01' } })
    })
  })
})
