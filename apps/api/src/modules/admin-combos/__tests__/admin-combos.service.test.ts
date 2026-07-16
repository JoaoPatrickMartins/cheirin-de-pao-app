// AdminCombosService — testes da cascata de compra automática ao desativar combo.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminCombosService } from '../admin-combos.service.js'

function makeMock(
  opts: {
    existing?: { id: string; name?: string; isActive: boolean } | null
    clients?: Array<{ id: string; autoRecharge: unknown }>
  } = {},
) {
  const existing =
    opts.existing === undefined
      ? { id: 'combo-01', name: 'Combo X', quantity: 10, price: 20, isActive: true }
      : opts.existing
  const clients = opts.clients ?? []

  const prisma = {
    combo: {
      findUnique: vi.fn().mockResolvedValue(existing),
      update: vi
        .fn()
        .mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
          Promise.resolve({ ...(existing ?? {}), ...data, id: where.id }),
        ),
    },
    user: {
      findMany: vi.fn().mockResolvedValue(clients),
      update: vi.fn().mockResolvedValue({}),
    },
    promotion: { findFirst: vi.fn().mockResolvedValue(null) },
  }

  return {
    fastify: { prisma, log: { error: vi.fn(), warn: vi.fn() } } as unknown,
    prisma,
  }
}

describe('AdminCombosService.update — cascata de compra automática', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ao desativar, desliga autoRecharge só dos clientes que usam o combo e conta os afetados', async () => {
    const clients = [
      { id: 'u1', autoRecharge: { active: true, comboId: 'combo-01', mode: 'acabar' } },
      { id: 'u2', autoRecharge: { active: true, comboId: 'outro-combo' } }, // outro combo
      { id: 'u3', autoRecharge: { active: false, comboId: 'combo-01' } }, // já inativo
      { id: 'u4', autoRecharge: null }, // sem recarga
    ]
    const { fastify, prisma } = makeMock({ clients })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminCombosService(fastify as any)

    const result = await service.update('combo-01', { isActive: false })

    expect(prisma.user.update).toHaveBeenCalledTimes(1)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { autoRecharge: { active: false, comboId: 'combo-01', mode: 'acabar' } },
    })
    expect(result.affectedAutoRecharge).toBe(1)
    expect(prisma.combo.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'combo-01' }, data: { isActive: false } }),
    )
  })

  it('ao reativar (isActive:true) não mexe na compra automática', async () => {
    const { fastify, prisma } = makeMock({
      existing: { id: 'combo-01', isActive: false },
      clients: [{ id: 'u1', autoRecharge: { active: true, comboId: 'combo-01' } }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminCombosService(fastify as any)

    const result = await service.update('combo-01', { isActive: true })

    expect(prisma.user.findMany).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(result.affectedAutoRecharge).toBe(0)
  })

  it('update sem isActive não dispara a cascata', async () => {
    const { fastify, prisma } = makeMock({
      clients: [{ id: 'u1', autoRecharge: { active: true, comboId: 'combo-01' } }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminCombosService(fastify as any)

    await service.update('combo-01', { price: 25 })

    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('repassa showEconomy e description para o update do combo', async () => {
    const { fastify, prisma } = makeMock()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminCombosService(fastify as any)

    await service.update('combo-01', { showEconomy: false, description: 'O equilíbrio da casa' })

    expect(prisma.combo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'combo-01' },
        data: { showEconomy: false, description: 'O equilíbrio da casa' },
      }),
    )
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('lança 404 quando o combo não existe', async () => {
    const { fastify } = makeMock({ existing: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminCombosService(fastify as any)

    await expect(service.update('inexistente', { isActive: false })).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('AdminCombosService.list — economia calculada vs. avulso', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calcula economyPercent/economySavings quando showEconomy=true e null quando desligado', async () => {
    const prisma = {
      combo: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'c1', name: 'Família', quantity: 30, price: 24.9, showEconomy: true, isActive: true },
          { id: 'c2', name: 'Simples', quantity: 10, price: 9.0, showEconomy: false, isActive: true },
        ]),
      },
      promotion: { findFirst: vi.fn().mockResolvedValue(null) },
      setting: { findUnique: vi.fn().mockResolvedValue({ key: 'avulsoUnit', value: '1.20' }) },
    }
    const fastify = { prisma, log: { error: vi.fn() } } as unknown

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminCombosService(fastify as any)
    const result = await service.list()

    const comEconomia = result.find((c) => c.id === 'c1')!
    expect(comEconomia.economyPercent).toBe(31) // (36,00 − 24,90) / 36,00
    expect(comEconomia.economySavings).toBeCloseTo(11.1, 2)

    const semEconomia = result.find((c) => c.id === 'c2')!
    expect(semEconomia.economyPercent).toBeNull()
    expect(semEconomia.economySavings).toBeNull()
  })
})
