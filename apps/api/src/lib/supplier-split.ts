/**
 * supplier-split.ts — motor de rateio: transforma demanda por produto em linhas
 * (produto, fornecedor, quantidade) usando a matriz de fornecimento (D-7).
 *
 * Antes disto o rateio era um percentual GLOBAL do negócio (`supplierSplitPrincipalPct`) aplicado
 * ao único produto que o sistema sabia comprar (o pão). Agora cada produto tem seus fornecedores,
 * sua fatia padrão e seu custo — e o pão é apenas a primeira linha dessa matriz.
 *
 * Regras (§3-B.4 do plano):
 *   1. Elegíveis = linhas `SupplierProduct` ativas do produto, com o `Supplier` também ativo.
 *   2. Rateio por `defaultSharePct`; **o resto do arredondamento vai para o `isPreferred`** (ou,
 *      sem preferido, para a maior fatia) → resultado determinístico e a soma SEMPRE fecha a demanda.
 *   3. `Σ defaultSharePct == 0` → 100% no `isPreferred`; sem preferido → o primeiro elegível.
 *   4. Produto com demanda > 0 e nenhum fornecedor elegível NÃO é silenciado: sai em `unsourced`
 *      para o chamador bloquear (geração manual) ou avisar (rede de segurança).
 */

/** Uma linha da matriz de fornecimento, na forma que o motor precisa. */
export interface SourcingOption {
  supplierId: string
  supplierName: string
  unitCost: number
  defaultSharePct: number
  isPreferred: boolean
  minOrderQty?: number | null
}

/** Demanda de um produto a ratear. */
export interface ProductDemandLine {
  productId: string
  productName: string
  qty: number
}

/** Uma linha resultante: quanto pedir de um produto a um fornecedor. */
export interface SplitLine {
  productId: string
  productName: string
  supplierId: string
  supplierName: string
  quantity: number
  unitCost: number
  /** true quando a quantidade fica abaixo do pedido mínimo do fornecedor (aviso, não bloqueio). */
  belowMinimum: boolean
}

/** Produto com demanda e sem fornecedor elegível — nunca omitido em silêncio (regra 4). */
export interface UnsourcedProduct {
  productId: string
  productName: string
  qty: number
}

export interface SplitResult {
  lines: SplitLine[]
  unsourced: UnsourcedProduct[]
  /** Total de unidades rateadas (soma das linhas). */
  totalQuantity: number
  /** Custo total das linhas em R$. */
  totalValue: number
}

/**
 * splitDemandBySupplier — rateia a demanda de cada produto entre seus fornecedores.
 *
 * @param demand    demanda por produto (qty > 0; itens com qty <= 0 são ignorados)
 * @param optionsBy mapa productId → opções de fornecimento elegíveis
 */
export function splitDemandBySupplier(
  demand: ProductDemandLine[],
  optionsBy: Map<string, SourcingOption[]>,
): SplitResult {
  const lines: SplitLine[] = []
  const unsourced: UnsourcedProduct[] = []

  for (const d of demand) {
    if (d.qty <= 0) continue
    const options = optionsBy.get(d.productId) ?? []
    if (options.length === 0) {
      unsourced.push({ productId: d.productId, productName: d.productName, qty: d.qty })
      continue
    }

    const alloc = allocate(d.qty, options)
    for (const [supplierId, quantity] of alloc) {
      if (quantity <= 0) continue
      const opt = options.find((o) => o.supplierId === supplierId)!
      lines.push({
        productId: d.productId,
        productName: d.productName,
        supplierId,
        supplierName: opt.supplierName,
        quantity,
        unitCost: opt.unitCost,
        belowMinimum: opt.minOrderQty != null && opt.minOrderQty > 0 && quantity < opt.minOrderQty,
      })
    }
  }

  return {
    lines,
    unsourced,
    totalQuantity: lines.reduce((s, l) => s + l.quantity, 0),
    totalValue: round2(lines.reduce((s, l) => s + l.quantity * l.unitCost, 0)),
  }
}

/**
 * Distribui `qty` entre as opções pelas fatias, garantindo que a soma seja exatamente `qty`.
 * O "dono do resto" (preferido, senão a maior fatia, senão o primeiro) absorve a diferença do
 * arredondamento — determinístico, sem depender da ordem de iteração de floats.
 */
function allocate(qty: number, options: SourcingOption[]): Map<string, number> {
  const out = new Map<string, number>()
  const totalPct = options.reduce((s, o) => s + Math.max(0, o.defaultSharePct), 0)

  // Dono do resto: o preferido; sem preferido, a maior fatia; empate → o primeiro da lista.
  const remainderOwner =
    options.find((o) => o.isPreferred) ??
    [...options].sort((a, b) => b.defaultSharePct - a.defaultSharePct)[0] ??
    options[0]

  // Regra 3: sem rateio definido, tudo vai para um só.
  if (totalPct <= 0) {
    out.set(remainderOwner.supplierId, qty)
    return out
  }

  let assigned = 0
  for (const o of options) {
    if (o.supplierId === remainderOwner.supplierId) continue
    const share = Math.floor((qty * Math.max(0, o.defaultSharePct)) / totalPct)
    out.set(o.supplierId, share)
    assigned += share
  }
  // O preferido leva a sua fatia + tudo que sobrou do arredondamento.
  out.set(remainderOwner.supplierId, qty - assigned)
  return out
}

const round2 = (n: number) => Math.round(n * 100) / 100
