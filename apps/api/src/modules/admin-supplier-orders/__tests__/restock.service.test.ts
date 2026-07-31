// Onda H8 — compra de REPOSIÇÃO de inventário (RESTOCK, D-9). Os testes fixam as três coisas que,
// se saírem erradas, contaminam o resto da operação:
//   1. `totalQuantity` fica 0 (esse campo é "pães" e alimenta o relatório de desperdício);
//   2. `slotId` fica null (é o que mantém o RESTOCK fora do gate da Separação e do "turno gerado");
//   3. só produto FIXED que o fornecedor realmente fornece entra (custo vem da matriz — D-8).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('../../schedules/schedules.service.js', () => ({
  SchedulesService: class {
    constructor(_f: unknown) {}
    materializeOrdersForSlot = vi.fn()
  },
}))

import { AdminSupplierOrdersService } from '../admin-supplier-orders.service.js'

type ProductRow = { name: string; stockType: string; isActive: boolean } | null

function makeFastify(over: {
  supplier?: { id: string; name: string; isActive: boolean } | null
  product?: ProductRow
  link?: { unitCost: number } | null
  breadProductId?: string | null
  /** Candidatos de reposição (para getRestockSuggestion). */
  products?: Array<{ id: string; name: string; stock: number }>
  soldItems?: Array<{ productId: string; qty: number }>
  supplierProducts?: Array<Record<string, unknown>>
  suppliers?: Array<{ id: string; name: string }>
} = {}) {
  const {
    supplier = { id: 'sup-1', name: 'Fornecedor A', isActive: true },
    product = { name: 'Geleia', stockType: 'FIXED', isActive: true },
    link = { unitCost: 8.5 },
    breadProductId = 'bread-1',
    products = [],
    soldItems = [],
    supplierProducts = [],
    suppliers = [],
  } = over

  const created = { id: 'po-1' }
  const purchaseOrderCreate = vi.fn().mockResolvedValue(created)
  const purchaseOrderItemCreateMany = vi.fn().mockResolvedValue({ count: 1 })
  const finalize = vi.fn().mockResolvedValue({ id: 'po-1', status: 'FINALIZED' })

  const prisma = {
    setting: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key === 'breadProductId' && breadProductId ? { value: breadProductId } : null),
      ),
    },
    supplier: {
      findUnique: vi.fn().mockResolvedValue(supplier),
      findMany: vi.fn().mockResolvedValue(suppliers),
    },
    product: {
      findUnique: vi.fn().mockResolvedValue(product),
      findMany: vi.fn().mockResolvedValue(products),
    },
    supplierProduct: {
      findUnique: vi.fn().mockResolvedValue(link),
      findMany: vi.fn().mockResolvedValue(supplierProducts),
    },
    marketOrder: { findMany: vi.fn().mockResolvedValue([{ items: soldItems }]) },
    purchaseOrder: { create: purchaseOrderCreate, update: finalize },
    purchaseOrderItem: { createMany: purchaseOrderItemCreateMany },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn().mockImplementation((cb: any) =>
      cb({
        purchaseOrder: { create: purchaseOrderCreate },
        purchaseOrderItem: { createMany: purchaseOrderItemCreateMany },
      }),
    ),
  }

  return {
    service: new AdminSupplierOrdersService({
      prisma,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    } as unknown as FastifyInstance),
    purchaseOrderCreate,
    purchaseOrderItemCreateMany,
    finalize,
  }
}

const item = { supplierId: 'sup-1', productId: 'prod-1', quantity: 12 }

describe('createRestock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('grava kind RESTOCK, sem turno, com totalQuantity ZERO', async () => {
    const { service, purchaseOrderCreate, finalize } = makeFastify()
    const r = await service.createRestock({ items: [item] })

    expect(r).toEqual({ id: 'po-1', totalItems: 12, totalValue: 102 }) // 12 × 8,50
    const data = purchaseOrderCreate.mock.calls[0][0].data
    expect(data).toMatchObject({
      kind: 'RESTOCK',
      slotId: null,
      slotLabel: null,
      totalQuantity: 0, // "pães" — um RESTOCK de geleia aqui viraria desperdício de pão
      totalItems: 12,
      totalValue: 102,
      status: 'DRAFT',
    })
    // Finaliza na hora: o admin comprou, não redigiu rascunho (e o histórico só lista FINALIZED).
    expect(finalize).toHaveBeenCalled()
  })

  it('custo vem da matriz de fornecimento, não do pricePerUnit do fornecedor (D-8)', async () => {
    const { service, purchaseOrderItemCreateMany } = makeFastify({ link: { unitCost: 3.25 } })
    await service.createRestock({ items: [{ ...item, quantity: 4 }] })

    expect(purchaseOrderItemCreateMany.mock.calls[0][0].data[0]).toMatchObject({
      productId: 'prod-1',
      productName: 'Geleia',
      quantity: 4,
      unitPrice: 3.25,
    })
  })

  it('recusa produto DAILY — capacidade por dia se compra pela demanda do turno', async () => {
    const { service } = makeFastify({ product: { name: 'Bolo de Fubá', stockType: 'DAILY', isActive: true } })
    await expect(service.createRestock({ items: [item] })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('recusa o produto-pão explicitamente', async () => {
    const { service } = makeFastify({ breadProductId: 'prod-1' })
    await expect(service.createRestock({ items: [item] })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('pão'),
    })
  })

  it('recusa (409) produto que o fornecedor NÃO fornece — sem inventar custo', async () => {
    const { service } = makeFastify({ link: null })
    await expect(service.createRestock({ items: [item] })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('recusa fornecedor inexistente (404) e inativo (400)', async () => {
    const semFornecedor = makeFastify({ supplier: null })
    await expect(semFornecedor.service.createRestock({ items: [item] })).rejects.toMatchObject({ statusCode: 404 })

    const inativo = makeFastify({ supplier: { id: 'sup-1', name: 'Fornecedor A', isActive: false } })
    await expect(inativo.service.createRestock({ items: [item] })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('nada é criado quando uma linha é inválida', async () => {
    const { service, purchaseOrderCreate } = makeFastify({ link: null })
    await expect(service.createRestock({ items: [item] })).rejects.toBeTruthy()
    expect(purchaseOrderCreate).not.toHaveBeenCalled()
  })
})

describe('getRestockSuggestion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('junta candidato + matriz de fornecimento + rateio, com o custo de cada fornecedor', async () => {
    const { service } = makeFastify({
      products: [{ id: 'p1', name: 'Geleia', stock: 0 }],
      soldItems: [{ productId: 'p1', qty: 30 }], // 1/dia → alvo 30
      supplierProducts: [
        { supplierId: 'sup-1', productId: 'p1', unitCost: 8, defaultSharePct: 100, isPreferred: true, minOrderQty: null, isActive: true },
      ],
      suppliers: [{ id: 'sup-1', name: 'Fornecedor A' }],
    })
    const r = await service.getRestockSuggestion(30)

    expect(r.coverDays).toBe(30)
    expect(r.products).toHaveLength(1)
    expect(r.products[0]).toMatchObject({ productName: 'Geleia', suggestedQty: 30, outOfStock: true })
    expect(r.products[0].options[0]).toMatchObject({ supplierId: 'sup-1', unitCost: 8, suggested: 30 })
    expect(r.totalQuantity).toBe(30)
    expect(r.totalValue).toBe(240)
  })

  it('produto que precisa de reposição e não tem fornecedor sai em unsourced — nunca em silêncio', async () => {
    const { service } = makeFastify({
      products: [{ id: 'p1', name: 'Geleia', stock: 0 }],
      soldItems: [{ productId: 'p1', qty: 30 }],
      supplierProducts: [], // ninguém fornece
    })
    const r = await service.getRestockSuggestion()

    expect(r.unsourced).toEqual([{ productId: 'p1', productName: 'Geleia', qty: 30 }])
    expect(r.products[0].options).toEqual([])
    expect(r.totalQuantity).toBe(0)
  })

  it('sem candidato → resposta vazia (não é erro)', async () => {
    const { service } = makeFastify({ products: [] })
    const r = await service.getRestockSuggestion()
    expect(r).toMatchObject({ products: [], unsourced: [], totalQuantity: 0, totalValue: 0 })
  })
})
