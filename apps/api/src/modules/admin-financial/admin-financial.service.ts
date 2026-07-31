import { FastifyInstance } from 'fastify'
import { fromMilli } from '@cheirin-de-pao/shared'
import { excludeNonCreditPurpose, nonCreditPurposeMatchRaw } from '../../lib/revenue.js'
import { CONFIRMED_MARKET_STATUSES } from '../../lib/bread-demand.js'
import { loadUnitCosts } from '../../lib/product-cost.js'

const BREAD_PRODUCT_KEY = 'breadProductId'

/**
 * A Cestinha no financeiro (D-2) — TRÊS números, nunca um.
 *
 * `revenue` e `gmv` medem coisas diferentes e a diferença é o ponto: a Cestinha pode ser paga em
 * pãezinhos, e esse dinheiro **já foi faturado** quando o cliente comprou o combo. Somar o GMV à
 * receita contaria a mesma nota duas vezes.
 */
interface MarketRevenue {
  /** Dinheiro NOVO que entrou pela Cestinha — `Payment` PAID com `purpose = MARKET`. */
  revenue: number
  /** Valor movimentado — Σ `MarketOrder.totalValue` confirmado. **Nunca** somar à receita. */
  gmv: number
  /** Recorte do GMV pago em dinheiro (Σ `moneyAmount`). */
  moneyPart: number
  /** Recorte do GMV pago em pãezinhos — o que NÃO é receita nova. */
  creditPart: number
  /** Pãezinhos usados como pagamento. */
  credits: number
  /** Quantas Cestinhas confirmadas no período. */
  orders: number
  /**
   * CMV (H9) — custo esperado do que foi vendido: itens do mercadinho **e** o pão da Cestinha
   * (D-1: o pão dela é pão, e tem custo). Sai da matriz de fornecimento (D-8) via `loadUnitCosts`.
   */
  cmv: number
  /** `gmv − cmv`. Margem sobre o movimentado, não sobre a receita nova. */
  margin: number
  /** Margem em % do GMV. */
  marginPct: number
  /**
   * Unidades vendidas cujo produto NÃO tem custo cadastrado. Enquanto isto for > 0, a margem é
   * PARCIAL — e a tela precisa dizer isso em vez de exibir um número redondo e errado.
   */
  unitsWithoutCost: number
}

/** Dinheiro que SAIU no período: pedidos ao fornecedor finalizados (H9). */
interface PurchasesSummary {
  /** Custo total dos pedidos finalizados no período (R$). */
  total: number
  /** Recorte gasto com pão. */
  breadCost: number
  /** Recorte gasto com produtos do mercadinho. */
  itemsCost: number
  /** Quantos pedidos ao fornecedor entraram na conta. */
  orders: number
}

/**
 * AdminFinancialService — receita por período, tipo e condomínio
 *
 * ADMF-01: receita por dia/semana/mês
 * ADMF-02: filtrar por condomínio via $runCommandRaw com $lookup
 * ADMF-03: receita por tipo — combos vs avulso
 *
 * Segurança (T-07-05-01): role check ADMIN no controller.
 * T-07-05-05: $runCommandRaw sempre usa $match com date range antes do $lookup.
 */
/** Centavos, sem lixo de ponto flutuante (0.1 + 0.2 em R$ não pode virar 0.30000000000000004). */
const round2 = (n: number) => Math.round(n * 100) / 100

export class AdminFinancialService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Calcula startDate e endDate em UTC com base no período e offset BRT (-3h).
   * BRT = UTC-3 → hora local BRT = UTC - 3h
   */
  private getDateRange(period: 'day' | 'week' | 'month'): { startDate: Date; endDate: Date } {
    // Offset BRT: -3h em ms
    const BRT_OFFSET = 3 * 60 * 60 * 1000

    const nowUtc = new Date()
    // Hora atual em BRT (UTC-3)
    const nowBrt = new Date(nowUtc.getTime() - BRT_OFFSET)

    let startBrt: Date

    if (period === 'day') {
      // Início do dia BRT (00:00 BRT = 03:00 UTC)
      startBrt = new Date(
        Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth(), nowBrt.getUTCDate()),
      )
    } else if (period === 'week') {
      // Segunda-feira desta semana em BRT
      const dayOfWeek = nowBrt.getUTCDay() // 0=Dom, 1=Seg, ...
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      startBrt = new Date(
        Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth(), nowBrt.getUTCDate() - daysFromMonday),
      )
    } else {
      // Primeiro dia do mês em BRT
      startBrt = new Date(Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth(), 1))
    }

    // Converter de volta para UTC (startBrt está em UTC mas representa hora BRT)
    // Adicionamos BRT_OFFSET para obter o UTC real correspondente ao início do dia BRT
    const startDate = new Date(startBrt.getTime() + BRT_OFFSET)
    const endDate = nowUtc

    return { startDate, endDate }
  }

  /**
   * getRevenue — agrega receita por período com breakdown por tipo e condomínio.
   *
   * Onda D1 — a Cestinha entra aqui pela primeira vez. Antes, TODOS os números aplicavam
   * `excludeNonCreditPurpose`, então o mercadinho simplesmente não existia no financeiro; agora
   * `market` (D-2) traz receita nova, GMV e a composição, e `totalConsolidated` soma **só as duas
   * receitas**. `total` e `byType` continuam sendo exatamente o que eram (receita de crédito) —
   * quem já lia esses campos não vê número mudar.
   *
   * @param period - 'day' | 'week' | 'month'
   * @param condominiumId - filtra por condomínio (opcional; afeta só `byCondominium`, como antes)
   */
  async getRevenue(
    period: 'day' | 'week' | 'month',
    condominiumId?: string,
  ): Promise<{
    total: number
    byType: { combos: number; avulso: number }
    market: MarketRevenue
    /** Receita de crédito + receita da Cestinha. GMV **não** entra (D-2). */
    totalConsolidated: number
    /** Compras ao fornecedor finalizadas no período — o outro lado do caixa (H9). */
    purchases: PurchasesSummary
    byCondominium: Array<{
      condominiumId: string
      condominiumName?: string
      total: number
      cestinhaGmv: number
    }>
  }> {
    const { startDate, endDate } = this.getDateRange(period)

    // ── Total geral ──────────────────────────────────────────────────────────
    // §4.7: exclui HOOK/MARKET — receita de crédito (pão) apenas.
    const totalResult = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PAID',
        createdAt: { gte: startDate, lte: endDate },
        ...excludeNonCreditPurpose,
      },
    })
    const total = totalResult._sum.amount ?? 0

    // ── Por tipo: combos ─────────────────────────────────────────────────────
    const combosResult = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PAID',
        createdAt: { gte: startDate, lte: endDate },
        comboId: { not: null },
        ...excludeNonCreditPurpose,
      },
    })
    const combos = combosResult._sum.amount ?? 0

    // ── Por tipo: avulso ─────────────────────────────────────────────────────
    const avulsoResult = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PAID',
        createdAt: { gte: startDate, lte: endDate },
        customQuantity: { not: null },
        ...excludeNonCreditPurpose,
      },
    })
    const avulso = avulsoResult._sum.amount ?? 0

    // ── Cestinha — D-2 (receita nova × valor movimentado) ────────────────────
    // A janela é a da COMPRA (`createdAt`), não a da entrega: é assim que `market.revenue`
    // (Payment) e `market.gmv` (MarketOrder) medem o mesmo período e reconciliam entre si.
    // `CONFIRMED_MARKET_STATUSES` exclui `PENDING_PAYMENT` (pode morrer no sweep) e `CANCELLED`
    // (foi estornado) — a mesma população que o CRM usa (Onda E), para os números baterem.
    const [marketRevenueAgg, marketOrdersAgg, soldOrders] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID', purpose: 'MARKET', createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.marketOrder.aggregate({
        _sum: { totalValue: true, moneyAmount: true, creditsAppliedMilli: true },
        _count: true,
        where: {
          status: { in: [...CONFIRMED_MARKET_STATUSES] },
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      // Linhas vendidas — insumo do CMV (H9). Precisa dos itens, então não dá para agregar.
      this.prisma.marketOrder.findMany({
        where: {
          status: { in: [...CONFIRMED_MARKET_STATUSES] },
          createdAt: { gte: startDate, lte: endDate },
        },
        select: { breadQty: true, items: { select: { productId: true, qty: true } } },
      }),
    ])
    const gmv = round2(marketOrdersAgg._sum.totalValue ?? 0)
    const moneyPart = round2(marketOrdersAgg._sum.moneyAmount ?? 0)
    const { cmv, unitsWithoutCost } = await this.computeMarketCmv(soldOrders)
    const market: MarketRevenue = {
      revenue: round2(marketRevenueAgg._sum.amount ?? 0),
      gmv,
      moneyPart,
      // Por construção do checkout, `moneyAmount = totalValue - creditsApplied × avulsoUnit`, então
      // a parte em pãezinhos é exatamente a diferença — sem depender do preço avulso de hoje (que
      // pode ter mudado desde a compra).
      creditPart: round2(gmv - moneyPart),
      // Soma em MILÉSIMOS e converte no fim: o espelho legado arredonda por pedido, então somar
      // `creditsApplied` daria alguns pãezinhos de diferença no fechamento.
      credits: fromMilli(marketOrdersAgg._sum.creditsAppliedMilli ?? 0),
      orders: marketOrdersAgg._count,
      cmv,
      margin: round2(gmv - cmv),
      marginPct: gmv > 0 ? Math.round(((gmv - cmv) / gmv) * 1000) / 10 : 0,
      unitsWithoutCost,
    }
    const totalConsolidated = round2(total + market.revenue)
    const purchases = await this.computePurchases(startDate, endDate)

    // ── Por condomínio (via $runCommandRaw — T-07-05-05: $match com date range primeiro) ──
    const pipeline: unknown[] = [
      {
        $match: {
          status: 'PAID',
          createdAt: {
            $gte: { $date: startDate.toISOString() },
            $lte: { $date: endDate.toISOString() },
          },
          ...nonCreditPurposeMatchRaw, // §4.7: exclui HOOK/MARKET
        },
      },
      {
        $lookup: {
          from: 'User',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
    ]

    // Filtrar por condomínio se informado
    if (condominiumId) {
      pipeline.push({
        $match: {
          'user.condominiumId': { $oid: condominiumId },
        },
      })
    }

    pipeline.push({
      $group: {
        _id: '$user.condominiumId',
        total: { $sum: '$amount' },
      },
    })

    // $runCommandRaw retorna Extended JSON: o _id (ObjectId) volta como { $oid: "..." },
    // não como string. Normalizamos para a string hex antes de usar no Prisma.
    const rawResult = await this.prisma.$runCommandRaw({
      aggregate: 'Payment',
      pipeline: pipeline as unknown as import('@prisma/client/runtime/library').InputJsonValue,
      cursor: {},
    }) as { cursor?: { firstBatch?: Array<{ _id: unknown; total: number }> } }

    const firstBatch = rawResult?.cursor?.firstBatch ?? []

    const extractId = (raw: unknown): string => {
      if (typeof raw === 'string') return raw
      if (raw && typeof raw === 'object' && '$oid' in raw) {
        return String((raw as { $oid: unknown }).$oid ?? '')
      }
      return ''
    }

    // GMV por condomínio — `MarketOrder.condominiumId` é denormalizado, então sai num groupBy
    // direto (sem o $lookup que a receita de crédito precisa fazer em User).
    const marketByCondo = await this.prisma.marketOrder.groupBy({
      by: ['condominiumId'],
      where: {
        status: { in: [...CONFIRMED_MARKET_STATUSES] },
        createdAt: { gte: startDate, lte: endDate },
        ...(condominiumId ? { condominiumId } : {}),
      },
      _sum: { totalValue: true },
    })

    // A linha do condomínio é a UNIÃO das duas fontes: um condomínio que só comprou Cestinha não
    // tem `Payment` de crédito no período e desapareceria da quebra se ela viesse só do pipeline.
    const rows = new Map<string, { total: number; cestinhaGmv: number }>()
    const ensure = (id: string) => {
      let r = rows.get(id)
      if (!r) {
        r = { total: 0, cestinhaGmv: 0 }
        rows.set(id, r)
      }
      return r
    }
    for (const row of firstBatch) {
      const id = extractId(row._id)
      if (id) ensure(id).total = row.total ?? 0
    }
    for (const g of marketByCondo) {
      if (g.condominiumId) ensure(g.condominiumId).cestinhaGmv = round2(g._sum.totalValue ?? 0)
    }

    // Buscar nomes dos condomínios
    const condoIds = [...rows.keys()]
    const condominiums = condoIds.length > 0
      ? await this.prisma.condominium.findMany({
          where: { id: { in: condoIds } },
          select: { id: true, name: true },
        })
      : []

    const condoNameMap = new Map(condominiums.map((c) => [c.id, c.name]))

    const byCondominium = [...rows.entries()].map(([id, r]) => ({
      condominiumId: id,
      condominiumName: condoNameMap.get(id) ?? undefined,
      total: r.total,
      cestinhaGmv: r.cestinhaGmv,
    }))

    return { total, byType: { combos, avulso }, market, totalConsolidated, purchases, byCondominium }
  }

  /**
   * CMV das Cestinhas vendidas (H9) — itens do mercadinho **mais** o pão vendido dentro delas.
   *
   * O pão da Cestinha entra porque ele é pão (D-1) e tem custo: deixá-lo fora inflaria a margem
   * exatamente nos pedidos com mais pão. Unidades de produto sem custo cadastrado não viram custo
   * zero — são contadas em `unitsWithoutCost`, e a margem passa a ser declaradamente parcial.
   */
  private async computeMarketCmv(
    orders: Array<{ breadQty: number; items: { productId: string; qty: number }[] }>,
  ): Promise<{ cmv: number; unitsWithoutCost: number }> {
    const breadProductId =
      (await this.prisma.setting.findUnique({ where: { key: BREAD_PRODUCT_KEY } }))?.value ?? null

    const soldBy = new Map<string, number>()
    const add = (productId: string, qty: number) => soldBy.set(productId, (soldBy.get(productId) ?? 0) + qty)
    for (const o of orders) {
      for (const it of o.items) add(it.productId, it.qty)
      if (breadProductId && o.breadQty > 0) add(breadProductId, o.breadQty)
    }
    if (soldBy.size === 0) return { cmv: 0, unitsWithoutCost: 0 }

    const costs = await loadUnitCosts(this.prisma, [...soldBy.keys()])
    let cmv = 0
    let unitsWithoutCost = 0
    for (const [productId, qty] of soldBy) {
      const cost = costs.get(productId)
      if (!cost) {
        unitsWithoutCost += qty
        continue
      }
      cmv += cost.unitCost * qty
    }
    return { cmv: round2(cmv), unitsWithoutCost }
  }

  /**
   * Compras finalizadas no período (H9) — o dinheiro que SAIU, separado em pão × produtos.
   *
   * Usa `PurchaseOrderItem.unitPrice`, que é o snapshot do custo no momento da compra: aqui não faz
   * sentido usar o custo esperado da matriz (isto é o que foi pago de fato, não uma projeção).
   * Inclui as reposições de inventário (`kind: RESTOCK`, H8) — é gasto igual.
   */
  private async computePurchases(startDate: Date, endDate: Date): Promise<PurchasesSummary> {
    const breadProductId =
      (await this.prisma.setting.findUnique({ where: { key: BREAD_PRODUCT_KEY } }))?.value ?? null

    const orders = await this.prisma.purchaseOrder.findMany({
      where: { status: 'FINALIZED', date: { gte: startDate, lte: endDate } },
      select: { id: true },
    })
    if (orders.length === 0) return { total: 0, breadCost: 0, itemsCost: 0, orders: 0 }

    const items = await this.prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId: { in: orders.map((o) => o.id) } },
      select: { productId: true, quantity: true, unitPrice: true },
    })

    let breadCost = 0
    let itemsCost = 0
    for (const it of items) {
      const value = it.quantity * it.unitPrice
      // Item legado sem `productId` é pão (era o único produto que o sistema sabia comprar).
      const isBread = (it.productId ?? breadProductId) === breadProductId
      if (isBread) breadCost += value
      else itemsCost += value
    }

    return {
      total: round2(breadCost + itemsCost),
      breadCost: round2(breadCost),
      itemsCost: round2(itemsCost),
      orders: orders.length,
    }
  }
}
