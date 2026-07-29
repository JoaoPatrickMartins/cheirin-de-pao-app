/**
 * product-cost.ts — custo unitário de um produto, para CMV e margem (H9 / D-8).
 *
 * O custo mora na RELAÇÃO (fornecedor, produto): o mesmo bolo custa diferente em cada fornecedor.
 * Para falar de margem, porém, é preciso UM número por produto — e a escolha aqui é o **custo
 * esperado pela matriz de fornecimento**: a média das linhas ativas ponderada por
 * `defaultSharePct`, que é exatamente a proporção em que a demanda daquele produto é comprada.
 *
 * Por que não o custo real das compras passadas: o sistema não rastreia lote. Um `PurchaseOrderItem`
 * diz quanto se pagou por 40 potes num dia, não qual pote saiu em qual Cestinha. Amarrar CMV a
 * histórico exigiria controle de lote e daria um número igualmente aproximado, com muito mais
 * máquina. O custo esperado é aproximado e **honesto sobre isso** (`basis`).
 *
 * Produto sem nenhuma linha na matriz não recebe custo `0` — recebe `null` e é **contado à parte**.
 * Zero apareceria como margem de 100%, que é a mentira mais confortável possível.
 */
import type { PrismaClient } from '@prisma/client'

/** De onde saiu o custo unitário. */
export type CostBasis =
  /** Média ponderada por `defaultSharePct` (o mix real de compra). */
  | 'MATRIX_WEIGHTED'
  /** Σ fatias = 0: o rateio manda tudo para um fornecedor só (preferido, senão o primeiro). */
  | 'MATRIX_SINGLE'

export interface ProductCost {
  productId: string
  unitCost: number
  basis: CostBasis
  /** Quantos fornecedores ativos entraram na conta. */
  suppliers: number
}

/**
 * loadUnitCosts — custo unitário esperado por produto.
 *
 * Elegível = linha `SupplierProduct` ativa **com fornecedor ativo** (mesma regra do rateio: um
 * fornecedor desativado sai da conta sem que sua linha seja apagada). Produto sem linha elegível
 * simplesmente NÃO aparece no mapa — o chamador decide o que fazer com "sem custo cadastrado", em
 * vez de receber um zero silencioso.
 */
export async function loadUnitCosts(
  prisma: PrismaClient,
  productIds: string[],
): Promise<Map<string, ProductCost>> {
  const out = new Map<string, ProductCost>()
  if (productIds.length === 0) return out

  const rows = await prisma.supplierProduct.findMany({
    where: { productId: { in: productIds }, isActive: true },
    select: { productId: true, supplierId: true, unitCost: true, defaultSharePct: true, isPreferred: true },
  })
  if (rows.length === 0) return out

  const activeSuppliers = await prisma.supplier.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.supplierId))] }, isActive: true },
    select: { id: true },
  })
  const activeIds = new Set(activeSuppliers.map((s) => s.id))

  const byProduct = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!activeIds.has(r.supplierId)) continue
    const list = byProduct.get(r.productId) ?? []
    list.push(r)
    byProduct.set(r.productId, list)
  }

  for (const [productId, list] of byProduct) {
    out.set(productId, computeUnitCost(productId, list))
  }
  return out
}

/** Média ponderada pelas fatias; sem fatias, o custo de quem levaria tudo no rateio. */
function computeUnitCost(
  productId: string,
  list: Array<{ unitCost: number; defaultSharePct: number; isPreferred: boolean }>,
): ProductCost {
  const totalPct = list.reduce((s, r) => s + Math.max(0, r.defaultSharePct), 0)

  if (totalPct <= 0) {
    // Mesma regra do motor de rateio: tudo vai para o preferido; sem preferido, o primeiro.
    const owner = list.find((r) => r.isPreferred) ?? list[0]
    return { productId, unitCost: round2(owner.unitCost), basis: 'MATRIX_SINGLE', suppliers: list.length }
  }

  const weighted = list.reduce((s, r) => s + r.unitCost * (Math.max(0, r.defaultSharePct) / totalPct), 0)
  return { productId, unitCost: round2(weighted), basis: 'MATRIX_WEIGHTED', suppliers: list.length }
}

/**
 * Margem de venda de um produto: preço − custo. `null` quando não há custo cadastrado — a UI mostra
 * "sem custo", nunca "100% de margem".
 */
export function productMargin(
  price: number,
  unitCost: number | null | undefined,
): { margin: number; marginPct: number } | null {
  if (unitCost == null) return null
  const margin = round2(price - unitCost)
  return { margin, marginPct: price > 0 ? Math.round((margin / price) * 1000) / 10 : 0 }
}

const round2 = (n: number) => Math.round(n * 100) / 100
