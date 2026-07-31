/**
 * product-demand.ts — demanda de COMPRA por produto de um (turno, dia de entrega).
 *
 * Complementa `bread-demand.ts`: aquele responde "quantos pães e quantas paradas" (operação de
 * entrega); este responde "o que eu preciso comprar", já agrupado por produto — o insumo do motor
 * de rateio (`supplier-split.ts`).
 *
 * Duas fontes, uma saída (D-1 — pão e item são coisas diferentes, mas ambos são COMPRA):
 *   - PÃO: `Order.quantity` (pedidos de pão) + `MarketOrder.breadQty` (pão vendido na Cestinha),
 *     tudo somado no produto apontado por `Setting.breadProductId`.
 *   - PRODUTOS: `Σ MarketOrder.items[].qty` por `productId`.
 *
 * Só demanda CONFIRMADA entra: previstos da agenda ainda podem não materializar e Cestinha em
 * `PENDING_PAYMENT` pode morrer no sweep — comprar por eles é comprar por um pedido que não existe.
 */
import type { PrismaClient } from '@prisma/client'
import { brtDayRange } from './cutoff.js'
import { CONFIRMED_MARKET_STATUSES } from './bread-demand.js'

const BREAD_PRODUCT_KEY = 'breadProductId'

/** Demanda de compra de um produto. */
export interface ProductDemand {
  productId: string
  productName: string
  qty: number
  /** true no produto-pão — o único cuja demanda também vem de `Order` (D-1). */
  isBread: boolean
}

/**
 * buildProductDemand — demanda de compra do turno para o dia, agrupada por produto.
 *
 * Ordena com o pão primeiro (é o item principal da operação), depois por nome.
 *
 * @param slotId turno (obrigatório — o pipeline de compra é por turno)
 * @param deliveryDate qualquer Date que caia no dia BRT alvo (meio-dia BRT é seguro)
 */
export async function buildProductDemand(
  prisma: PrismaClient,
  slotId: string,
  deliveryDate: Date,
): Promise<ProductDemand[]> {
  const { start, end } = brtDayRange(deliveryDate)

  const [breadRow, orderAgg, marketOrders] = await Promise.all([
    prisma.setting.findUnique({ where: { key: BREAD_PRODUCT_KEY } }),
    prisma.order.aggregate({
      _sum: { quantity: true },
      where: { scheduledDate: { gte: start, lte: end }, status: { not: 'CANCELLED' }, slotId },
    }),
    prisma.marketOrder.findMany({
      where: {
        scheduledDate: { gte: start, lte: end },
        status: { in: [...CONFIRMED_MARKET_STATUSES] },
        slotId,
      },
      select: { breadQty: true, items: { select: { productId: true, name: true, qty: true } } },
    }),
  ])

  const breadProductId = breadRow?.value ?? null
  const breadFromOrders = orderAgg._sum.quantity ?? 0
  const breadFromMarket = marketOrders.reduce((s, m) => s + m.breadQty, 0)

  const byProduct = new Map<string, ProductDemand>()

  // Pão: as duas origens somam no MESMO produto (D-1).
  if (breadProductId && breadFromOrders + breadFromMarket > 0) {
    byProduct.set(breadProductId, {
      productId: breadProductId,
      productName: 'Pão Francês',
      qty: breadFromOrders + breadFromMarket,
      isBread: true,
    })
  }

  // Produtos do mercadinho. O pão nunca chega como item (o checkout o separa em `breadQty`), mas
  // se chegasse, somaria na linha do pão em vez de criar uma duplicada.
  for (const m of marketOrders) {
    for (const it of m.items) {
      const cur = byProduct.get(it.productId)
      if (cur) {
        cur.qty += it.qty
        continue
      }
      byProduct.set(it.productId, {
        productId: it.productId,
        productName: it.name,
        qty: it.qty,
        isBread: it.productId === breadProductId,
      })
    }
  }

  // Nome real do produto-pão (o snapshot acima é só um fallback legível).
  if (breadProductId && byProduct.has(breadProductId)) {
    const p = await prisma.product.findUnique({ where: { id: breadProductId }, select: { name: true } })
    if (p) byProduct.get(breadProductId)!.productName = p.name
  }

  return [...byProduct.values()].sort((a, b) => {
    if (a.isBread !== b.isBread) return a.isBread ? -1 : 1
    return a.productName.localeCompare(b.productName, 'pt-BR')
  })
}

/**
 * loadSourcingOptions — opções de fornecimento elegíveis por produto (matriz `SupplierProduct`).
 *
 * Elegível = linha ativa **e** fornecedor ativo. Um fornecedor desativado sai do rateio sem que o
 * admin precise apagar a linha (o custo cadastrado continua lá para quando ele voltar).
 */
export async function loadSourcingOptions(
  prisma: PrismaClient,
  productIds: string[],
): Promise<Map<string, import('./supplier-split.js').SourcingOption[]>> {
  const out = new Map<string, import('./supplier-split.js').SourcingOption[]>()
  if (productIds.length === 0) return out

  const rows = await prisma.supplierProduct.findMany({
    where: { productId: { in: productIds }, isActive: true },
  })
  if (rows.length === 0) return out

  const supplierIds = [...new Set(rows.map((r) => r.supplierId))]
  const suppliers = await prisma.supplier.findMany({
    where: { id: { in: supplierIds }, isActive: true },
    select: { id: true, name: true },
  })
  const supplierById = new Map(suppliers.map((s) => [s.id, s]))

  for (const r of rows) {
    const s = supplierById.get(r.supplierId)
    if (!s) continue // fornecedor inativo → fora do rateio
    const list = out.get(r.productId) ?? []
    list.push({
      supplierId: r.supplierId,
      supplierName: s.name,
      unitCost: r.unitCost,
      defaultSharePct: r.defaultSharePct,
      isPreferred: r.isPreferred,
      minOrderQty: r.minOrderQty,
    })
    out.set(r.productId, list)
  }

  // Ordem estável (preferido primeiro, depois nome) — o rateio é determinístico e a tela também.
  for (const list of out.values()) {
    list.sort((a, b) => {
      if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1
      return a.supplierName.localeCompare(b.supplierName, 'pt-BR')
    })
  }
  return out
}
