// supplier-products-backfill.test.ts — semeia a matriz de fornecimento a partir do modelo legado.
//
// O que este backfill protege: sem a linha do pão na matriz, no primeiro boot depois do deploy a
// geração do pedido ao fornecedor não acharia fornecedor para o pão — e o pão de amanhã não seria
// comprado. Os testes fixam que o split histórico (75/25) é PRESERVADO, e que as fatias fecham 100.
import { describe, it, expect, vi } from 'vitest'
import { runSupplierProductsBackfill } from '../supplier-products-backfill.js'

interface MockOpts {
  breadProductId?: string | null
  breadExists?: boolean
  suppliers?: Array<{ id: string; pricePerUnit: number; isPrincipal: boolean }>
  splitPct?: string | null
  existingLinks?: Set<string>
}

function makePrisma(o: MockOpts = {}) {
  const {
    breadProductId = 'p-pao',
    breadExists = true,
    suppliers = [{ id: 's1', pricePerUnit: 0.5, isPrincipal: true }],
    splitPct = null,
    existingLinks = new Set<string>(),
  } = o

  const created: Array<Record<string, unknown>> = []
  const prisma = {
    setting: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === 'breadProductId') return Promise.resolve(breadProductId ? { value: breadProductId } : null)
        if (where.key === 'supplierSplitPrincipalPct') return Promise.resolve(splitPct ? { value: splitPct } : null)
        return Promise.resolve(null)
      }),
    },
    product: { findUnique: vi.fn().mockResolvedValue(breadExists ? { id: breadProductId, name: 'Pão Francês' } : null) },
    supplier: { findMany: vi.fn().mockResolvedValue(suppliers) },
    supplierProduct: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { supplierId_productId: { supplierId: string } } }) =>
        Promise.resolve(existingLinks.has(where.supplierId_productId.supplierId) ? { id: 'x' } : null),
      ),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        created.push(data)
        return Promise.resolve(data)
      }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return { prisma, created }
}

describe('runSupplierProductsBackfill', () => {
  it('fornecedor único → 100% nele, com o pricePerUnit legado como custo', async () => {
    const { prisma, created } = makePrisma()
    const r = await runSupplierProductsBackfill(prisma)
    expect(r).toEqual({ created: 1, skipped: 0 })
    expect(created[0]).toMatchObject({
      supplierId: 's1',
      productId: 'p-pao',
      unitCost: 0.5,
      defaultSharePct: 100,
      isPreferred: true,
    })
  })

  it('PRESERVA o split 75/25 histórico (principal + 1 reserva)', async () => {
    const { prisma, created } = makePrisma({
      suppliers: [
        { id: 's1', pricePerUnit: 0.5, isPrincipal: true },
        { id: 's2', pricePerUnit: 0.6, isPrincipal: false },
      ],
    })
    await runSupplierProductsBackfill(prisma)
    const by = new Map(created.map((c) => [c.supplierId as string, c]))
    expect(by.get('s1')).toMatchObject({ defaultSharePct: 75, isPreferred: true, unitCost: 0.5 })
    expect(by.get('s2')).toMatchObject({ defaultSharePct: 25, isPreferred: false, unitCost: 0.6 })
  })

  it('respeita um supplierSplitPrincipalPct customizado', async () => {
    const { prisma, created } = makePrisma({
      splitPct: '60',
      suppliers: [
        { id: 's1', pricePerUnit: 0.5, isPrincipal: true },
        { id: 's2', pricePerUnit: 0.6, isPrincipal: false },
      ],
    })
    await runSupplierProductsBackfill(prisma)
    const by = new Map(created.map((c) => [c.supplierId as string, c.defaultSharePct]))
    expect(by.get('s1')).toBe(60)
    expect(by.get('s2')).toBe(40)
  })

  it('com N reservas, as fatias somam exatamente 100 (sobra na primeira reserva)', async () => {
    const { prisma, created } = makePrisma({
      suppliers: [
        { id: 's1', pricePerUnit: 0.5, isPrincipal: true },
        { id: 's2', pricePerUnit: 0.6, isPrincipal: false },
        { id: 's3', pricePerUnit: 0.7, isPrincipal: false },
        { id: 's4', pricePerUnit: 0.8, isPrincipal: false },
      ],
    })
    await runSupplierProductsBackfill(prisma)
    const total = created.reduce((s, c) => s + (c.defaultSharePct as number), 0)
    expect(total).toBe(100) // 75 + 9 + 8 + 8
    expect(created.filter((c) => c.isPreferred)).toHaveLength(1)
  })

  it('sem fornecedor marcado como principal, o primeiro assume', async () => {
    const { prisma, created } = makePrisma({
      suppliers: [
        { id: 's1', pricePerUnit: 0.5, isPrincipal: false },
        { id: 's2', pricePerUnit: 0.6, isPrincipal: false },
      ],
    })
    await runSupplierProductsBackfill(prisma)
    const by = new Map(created.map((c) => [c.supplierId as string, c]))
    expect(by.get('s1')).toMatchObject({ isPreferred: true, defaultSharePct: 75 })
  })

  it('é idempotente — fornecedor que já tem a linha do pão é pulado', async () => {
    const { prisma, created } = makePrisma({
      suppliers: [
        { id: 's1', pricePerUnit: 0.5, isPrincipal: true },
        { id: 's2', pricePerUnit: 0.6, isPrincipal: false },
      ],
      existingLinks: new Set(['s1']),
    })
    const r = await runSupplierProductsBackfill(prisma)
    expect(r).toEqual({ created: 1, skipped: 1 })
    expect(created.map((c) => c.supplierId)).toEqual(['s2'])
  })

  it('não faz nada (com motivo) quando não há produto-pão configurado', async () => {
    const { prisma } = makePrisma({ breadProductId: null })
    const r = await runSupplierProductsBackfill(prisma)
    expect(r.created).toBe(0)
    expect(r.reason).toContain('breadProductId')
  })

  it('não faz nada (com motivo) quando não há fornecedor ativo', async () => {
    const { prisma } = makePrisma({ suppliers: [] })
    const r = await runSupplierProductsBackfill(prisma)
    expect(r.created).toBe(0)
    expect(r.reason).toContain('fornecedor ativo')
  })
})
