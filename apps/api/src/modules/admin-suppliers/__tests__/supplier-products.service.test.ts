// supplier-products.service.test.ts — matriz de fornecimento (Onda H2).
//
// As três regras que protegem o pedido ao fornecedor de sair errado em silêncio:
//   - Σ das fatias por produto tem de fechar em 0% ou 100%;
//   - só um fornecedor preferido por produto (é o dono do resto do arredondamento);
//   - não deixar um produto COM DEMANDA FUTURA sem nenhum fornecedor.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminSuppliersService } from '../admin-suppliers.service.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMock(over: Record<string, any> = {}) {
  const {
    supplier = { id: 's1', name: 'Padaria Central', isActive: true, isPrincipal: true, pricePerUnit: 0.5 },
    currentRows = [],
    otherShares = [],
    products = [{ id: 'p-pao', name: 'Pão Francês', isActive: true, stockType: 'DAILY' }],
    pendingMarketOrder = null,
  } = over

  const prisma = {
    supplier: {
      findUnique: vi.fn().mockResolvedValue(supplier),
      findMany: vi.fn().mockResolvedValue([supplier]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn().mockResolvedValue(supplier),
    },
    supplierProduct: {
      findMany: vi.fn().mockImplementation(({ where }: { where?: Record<string, unknown> }) => {
        // findOtherSharesForProduct usa `supplierId: { not }`; findProductsOfSupplier não.
        const isOthers = where && typeof where.supplierId === 'object' && where.supplierId !== null
        return Promise.resolve(isOthers ? otherShares : currentRows)
      }),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    product: { findMany: vi.fn().mockResolvedValue(products), findUnique: vi.fn().mockResolvedValue(products[0]) },
    marketOrder: { findFirst: vi.fn().mockResolvedValue(pendingMarketOrder) },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { fastify: { prisma, log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } } as any, prisma }
}

const PAO = { productId: 'p-pao', unitCost: 0.5, defaultSharePct: 100, isPreferred: true, isActive: true }

describe('AdminSuppliersService — matriz de fornecimento', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aceita fatia 100% quando é o único fornecedor do produto', async () => {
    const { fastify, prisma } = makeMock()
    await new AdminSuppliersService(fastify).setProductsOfSupplier('s1', { products: [PAO] })
    expect(prisma.supplierProduct.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { supplierId_productId: { supplierId: 's1', productId: 'p-pao' } },
        create: expect.objectContaining({ unitCost: 0.5, defaultSharePct: 100, isPreferred: true }),
      }),
    )
  })

  it('aceita Σ = 0 (ninguém definiu fatia → o padrão leva tudo)', async () => {
    const { fastify } = makeMock({ otherShares: [{ supplierId: 's2', defaultSharePct: 0 }] })
    await expect(
      new AdminSuppliersService(fastify).setProductsOfSupplier('s1', {
        products: [{ ...PAO, defaultSharePct: 0 }],
      }),
    ).resolves.toBeDefined()
  })

  it('aceita 75/25 fechando com o outro fornecedor', async () => {
    const { fastify } = makeMock({ otherShares: [{ supplierId: 's2', defaultSharePct: 25 }] })
    await expect(
      new AdminSuppliersService(fastify).setProductsOfSupplier('s1', {
        products: [{ ...PAO, defaultSharePct: 75 }],
      }),
    ).resolves.toBeDefined()
  })

  it('rejeita (409) quando as fatias somam menos de 100 — diz quanto falta', async () => {
    const { fastify } = makeMock({ otherShares: [{ supplierId: 's2', defaultSharePct: 25 }] })
    await expect(
      new AdminSuppliersService(fastify).setProductsOfSupplier('s1', {
        products: [{ ...PAO, defaultSharePct: 65 }],
      }),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('faltam 10%') })
  })

  it('rejeita (409) quando as fatias passam de 100 — diz quanto sobra', async () => {
    const { fastify } = makeMock({ otherShares: [{ supplierId: 's2', defaultSharePct: 40 }] })
    await expect(
      new AdminSuppliersService(fastify).setProductsOfSupplier('s1', {
        products: [{ ...PAO, defaultSharePct: 75 }],
      }),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('sobram 15%') })
  })

  it('linha INATIVA não entra na soma das fatias', async () => {
    // 100 (outro) + 100 (este, mas inativo) não deve estourar: o inativo está fora do rateio.
    const { fastify } = makeMock({ otherShares: [{ supplierId: 's2', defaultSharePct: 100 }] })
    await expect(
      new AdminSuppliersService(fastify).setProductsOfSupplier('s1', {
        products: [{ ...PAO, defaultSharePct: 100, isActive: false }],
      }),
    ).resolves.toBeDefined()
  })

  it('rejeita produto repetido no payload', async () => {
    const { fastify } = makeMock()
    await expect(
      new AdminSuppliersService(fastify).setProductsOfSupplier('s1', { products: [PAO, PAO] }),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('duas vezes') })
  })

  it('rejeita (404) produto inexistente', async () => {
    const { fastify } = makeMock({ products: [] })
    await expect(
      new AdminSuppliersService(fastify).setProductsOfSupplier('s1', { products: [PAO] }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('marcar preferido desmarca o dos OUTROS fornecedores do produto', async () => {
    const { fastify, prisma } = makeMock()
    await new AdminSuppliersService(fastify).setProductsOfSupplier('s1', { products: [PAO] })
    expect(prisma.supplierProduct.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ productId: 'p-pao', isPreferred: true }),
        data: { isPreferred: false },
      }),
    )
  })

  it('remover um produto do fornecedor apaga a linha', async () => {
    // Tinha bolo; envia lista sem ele → sai da matriz.
    const { fastify, prisma } = makeMock({
      currentRows: [{ supplierId: 's1', productId: 'p-bolo', defaultSharePct: 100, unitCost: 4, isPreferred: true, isActive: true, minOrderQty: null }],
      otherShares: [{ supplierId: 's2', defaultSharePct: 0 }], // sobra alguém fornecendo o bolo
    })
    await new AdminSuppliersService(fastify).setProductsOfSupplier('s1', { products: [] })
    expect(prisma.supplierProduct.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { supplierId: 's1', productId: { in: ['p-bolo'] } } }),
    )
  })

  it('BARRA remover o ÚNICO fornecedor de um produto com pedido confirmado à frente', async () => {
    // Sem isto, o bolo vendido para amanhã ficaria sem quem fornecer e o pedido sairia incompleto.
    const { fastify, prisma } = makeMock({
      currentRows: [{ supplierId: 's1', productId: 'p-bolo', defaultSharePct: 100, unitCost: 4, isPreferred: true, isActive: true, minOrderQty: null }],
      otherShares: [], // ninguém mais fornece
      products: [{ id: 'p-bolo', name: 'Bolo de Fubá', isActive: true, stockType: 'DAILY' }],
      pendingMarketOrder: { id: 'mo1' },
    })
    await expect(
      new AdminSuppliersService(fastify).setProductsOfSupplier('s1', { products: [] }),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('único fornecedor') })
    expect(prisma.supplierProduct.deleteMany).not.toHaveBeenCalled()
  })

  it('permite remover o único fornecedor quando NÃO há pedido confirmado à frente', async () => {
    const { fastify, prisma } = makeMock({
      currentRows: [{ supplierId: 's1', productId: 'p-bolo', defaultSharePct: 100, unitCost: 4, isPreferred: true, isActive: true, minOrderQty: null }],
      otherShares: [],
      products: [{ id: 'p-bolo', name: 'Bolo de Fubá', isActive: true, stockType: 'DAILY' }],
      pendingMarketOrder: null,
    })
    await new AdminSuppliersService(fastify).setProductsOfSupplier('s1', { products: [] })
    expect(prisma.supplierProduct.deleteMany).toHaveBeenCalled()
  })

  it('apagar o fornecedor apaga a matriz dele (sem linhas órfãs)', async () => {
    const { fastify, prisma } = makeMock()
    await new AdminSuppliersService(fastify).remove('s1')
    expect(prisma.supplierProduct.deleteMany).toHaveBeenCalledWith({ where: { supplierId: 's1' } })
    expect(prisma.supplier.delete).toHaveBeenCalled()
  })
})
