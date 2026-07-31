/**
 * restock-demand.ts — o que repor de inventário (`stockType: FIXED`) e quanto comprar.
 *
 * Complementa `product-demand.ts`. A diferença é o REGIME de compra (D-9), não o cálculo:
 * - **`DELIVERY_BATCH`** — produto `DAILY` (pão, bolo). Quantidade **derivada da demanda** do
 *   (dia, turno): compra-se exatamente o que foi vendido para aquela entrega.
 * - **`RESTOCK`** — produto `FIXED` (geleia, café). **Não tem demanda diária**: é inventário. Não
 *   se compra 3 potes porque 3 pessoas pediram hoje; repõe-se quando está acabando. Até a Onda H8
 *   não existia NENHUM caminho para comprar isto.
 *
 * A sugestão é por **cobertura**: a que ritmo o produto vendeu nos últimos `windowDays`, quantos
 * dias se quer cobrir, quanto falta para chegar lá. Sem histórico o cálculo não tem base, e aí a
 * sugestão é declaradamente um chute (`basis: 'FALLBACK'`) — um produto esgotado há duas semanas
 * vende zero justamente porque está esgotado, e uma sugestão de "0" seria a pior resposta possível.
 */
import type { PrismaClient } from '@prisma/client'
import { CONFIRMED_MARKET_STATUSES } from './bread-demand.js'
import { LOW_STOCK_THRESHOLD } from './market-stock-alerts.js'

/** Janela de histórico usada para medir o ritmo de venda. */
export const RESTOCK_WINDOW_DAYS = 30
/** Dias de estoque que a sugestão tenta cobrir. */
export const RESTOCK_COVER_DAYS = 30

/** De onde saiu a quantidade sugerida. */
export type RestockBasis =
  /** Ritmo de venda medido na janela. */
  | 'CONSUMPTION'
  /** Sem venda na janela — a sugestão é um piso, não uma previsão. */
  | 'FALLBACK'

export interface RestockCandidate {
  productId: string
  productName: string
  /** Estoque atual. */
  stock: number
  /** Unidades vendidas na janela (Cestinhas confirmadas). */
  sold: number
  /** Média diária de venda na janela. */
  dailyRate: number
  /** Dias de estoque que o ritmo atual sustenta (`null` quando não há venda medida). */
  coverDays: number | null
  /** Quantidade sugerida de compra. */
  suggestedQty: number
  basis: RestockBasis
  /** true quando o estoque já está na faixa crítica (mesmo limiar do alerta ao admin — F5). */
  lowStock: boolean
  /** true quando zerou. */
  outOfStock: boolean
}

export interface BuildRestockOptions {
  /** Dias de cobertura desejados (default `RESTOCK_COVER_DAYS`). */
  coverDays?: number
  /** Janela de histórico (default `RESTOCK_WINDOW_DAYS`). */
  windowDays?: number
  /** "Agora" — injetável para teste. */
  now?: Date
}

/**
 * buildRestockCandidates — produtos de inventário que merecem reposição, com quanto comprar.
 *
 * Candidato = produto `FIXED` ativo que está na faixa crítica **ou** cujo estoque não cobre os dias
 * pedidos. Ordenado pela urgência (esgotado primeiro, depois menor cobertura).
 */
export async function buildRestockCandidates(
  prisma: PrismaClient,
  opts: BuildRestockOptions = {},
): Promise<RestockCandidate[]> {
  const coverDays = opts.coverDays ?? RESTOCK_COVER_DAYS
  const windowDays = opts.windowDays ?? RESTOCK_WINDOW_DAYS
  const now = opts.now ?? new Date()
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)

  const [products, orders] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, stockType: 'FIXED' },
      select: { id: true, name: true, stock: true },
    }),
    // Consumo real: itens de Cestinhas CONFIRMADAS (a que morreu no sweep ou foi cancelada devolveu
    // o estoque, então não consumiu nada).
    prisma.marketOrder.findMany({
      where: { createdAt: { gte: since }, status: { in: [...CONFIRMED_MARKET_STATUSES] } },
      select: { items: { select: { productId: true, qty: true } } },
    }),
  ])
  if (products.length === 0) return []

  const soldBy = new Map<string, number>()
  for (const o of orders) {
    for (const it of o.items) soldBy.set(it.productId, (soldBy.get(it.productId) ?? 0) + it.qty)
  }

  const out: RestockCandidate[] = []
  for (const p of products) {
    const stock = Math.max(0, p.stock ?? 0)
    const sold = soldBy.get(p.id) ?? 0
    const dailyRate = windowDays > 0 ? sold / windowDays : 0
    const target = Math.ceil(dailyRate * coverDays)
    const lowStock = stock <= LOW_STOCK_THRESHOLD

    let suggestedQty = Math.max(0, target - stock)
    let basis: RestockBasis = 'CONSUMPTION'
    if (sold === 0) {
      // Sem base para projetar. Só sugere algo se o estoque já está crítico — e o piso é o próprio
      // limiar, o mínimo para sair da zona de alerta.
      basis = 'FALLBACK'
      suggestedQty = lowStock ? Math.max(1, LOW_STOCK_THRESHOLD + 1 - stock) : 0
    }

    if (!lowStock && suggestedQty === 0) continue

    out.push({
      productId: p.id,
      productName: p.name,
      stock,
      sold,
      dailyRate: Math.round(dailyRate * 100) / 100,
      coverDays: dailyRate > 0 ? Math.round((stock / dailyRate) * 10) / 10 : null,
      suggestedQty,
      basis,
      lowStock,
      outOfStock: stock <= 0,
    })
  }

  // Urgência: esgotado primeiro; depois menor cobertura (null = sem venda medida, vai para o fim).
  return out.sort((a, b) => {
    if (a.outOfStock !== b.outOfStock) return a.outOfStock ? -1 : 1
    const ca = a.coverDays ?? Number.POSITIVE_INFINITY
    const cb = b.coverDays ?? Number.POSITIVE_INFINITY
    if (ca !== cb) return ca - cb
    return a.productName.localeCompare(b.productName, 'pt-BR')
  })
}
