/**
 * sales.service — Vendas & performance (V1–V4, V6, V9 da Fase 6 do plano-financeiro-vendas).
 *
 * **Compõe, não reagrega**, como o DRE e o painel: o mix de canal sai de `AdminFinancialService`,
 * as contagens de pedido de `AdminReportsService.getPaymentsReport`, o ranking de
 * `getCondominiumRanking`, e os itens de `lib/period-sales.ts`. Se este serviço somasse `Payment`
 * por conta própria, a receita daqui e a da tela de Receita divergiriam no primeiro ajuste de
 * regra — e o admin teria dois números para a mesma pergunta.
 *
 * ## As duas bases, e por que elas NÃO fecham
 *
 * O relatório cruza duas medições que respondem a perguntas diferentes:
 *
 *   - **`sales`** — o que foi VENDIDO para cada dia de entrega (`scheduledDate`). É volume: pães,
 *     itens, produtos mais vendidos, sazonalidade.
 *   - **`channel` / `ticket` / `combos`** — o DINHEIRO que entrou (`Payment.createdAt`). É receita.
 *
 * Num modelo **pré-pago elas não podem fechar**: o cliente compra 30 pãezinhos hoje e consome ao
 * longo de semanas. O pão entregue em agosto foi pago em julho. Juntar as duas bases numa soma só
 * produziria um número que não é receita nem volume — por isso elas viajam separadas no payload,
 * e `caveats` diz isso em português para quem abre a tela.
 *
 * `sales.totalRevenue` em particular valoriza o pão ao preço de TABELA (`avulsoUnit`): é o valor
 * do que saiu pela porta, não o que foi faturado. Quem quer faturamento lê `channel`.
 */
import { FastifyInstance } from 'fastify'
import {
  toWindow,
  presetOf,
  previousWindow,
  percentDelta,
  windowDescriptor,
  type PeriodInput,
  type ReportPeriod,
  type WindowDescriptor,
} from '../../lib/date-range.js'
import { buildPeriodSales, withAbc, type PeriodSales, type PeriodSalesLine, type AbcLine } from '../../lib/period-sales.js'
import { AdminFinancialService } from '../admin-financial/admin-financial.service.js'
import { AdminReportsService } from './admin-reports.service.js'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Um canal de venda no mix (V4). */
export interface ChannelSlice {
  key: 'combos' | 'avulso' | 'market' | 'hook'
  label: string
  revenue: number
  /** Fatia do consolidado (0..1). */
  share: number
  /** Variação vs. a janela anterior equivalente. `null` quando a base era zero. */
  deltaPct: number | null
}

/** Ticket médio de uma população de pedidos (V3). */
export interface TicketSlice {
  orders: number
  revenue: number
  /** `revenue / orders`. Zero quando não houve pedido — nunca `NaN` numa tela. */
  avg: number
}

export interface ComboSlice {
  comboId: string
  name: string
  /** Pãezinhos do combo no momento da leitura (o cadastro pode ter mudado desde a venda). */
  quantity: number
  price: number
  orders: number
  revenue: number
  share: number
  /** R$ por pãezinho vendido nesse combo — o que compara combos de tamanhos diferentes. */
  pricePerCredit: number | null
}

export interface CondoPerformance {
  condominiumId: string
  condominiumName: string
  revenue: number
  activeClients: number
  breadsDelivered: number
  /** Receita ÷ clientes ativos. O número que diz se vale expandir ou cortar. */
  revenuePerClient: number
  /** Pães entregues ÷ clientes ativos. */
  breadsPerClient: number
}

export interface SalesReport {
  period?: ReportPeriod
  window: WindowDescriptor
  previous?: WindowDescriptor
  /** Lado da ENTREGA (`scheduledDate`) — volume e itens. Ver o cabeçalho. */
  sales: Omit<PeriodSales, 'lines'> & { lines: Array<PeriodSalesLine & AbcLine> }
  /** Lado do DINHEIRO (`Payment.createdAt`) — receita. */
  channel: {
    total: number
    deltaPct: number | null
    slices: ChannelSlice[]
  }
  ticket: {
    /** Compra de crédito (combo ou avulso). */
    credit: TicketSlice & { deltaPct: number | null }
    /** Cestinha — pelo VALOR MOVIMENTADO, não pela receita nova (ver o comentário no código). */
    market: TicketSlice
    /** Receita consolidada ÷ clientes distintos que compraram. */
    perClient: TicketSlice
  }
  combos: ComboSlice[]
  condominiums: CondoPerformance[]
  /** Ressalvas que viajam com o número — a tela as exibe, não as esconde. */
  caveats: string[]
}

export class SalesService {
  private financial: AdminFinancialService
  private reports: AdminReportsService

  constructor(private fastify: FastifyInstance) {
    this.financial = new AdminFinancialService(fastify)
    this.reports = new AdminReportsService(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  async getSalesReport(input: PeriodInput, compare = true): Promise<SalesReport> {
    const win = toWindow(input)
    const prev = compare ? previousWindow(win) : null

    const [sales, revenue, payments, condos, combos, buyers, prevRevenue, prevPayments] =
      await Promise.all([
        buildPeriodSales(this.prisma, win),
        this.financial.getRevenue(win),
        this.reports.getPaymentsReport(win),
        this.reports.getCondominiumRanking(win),
        this.combosBreakdown(win.startDate, win.endDate),
        this.distinctBuyers(win.startDate, win.endDate),
        prev ? this.financial.getRevenue(prev) : null,
        prev ? this.reports.getPaymentsReport(prev) : null,
      ])

    // ── Mix de canal (V4) ────────────────────────────────────────────────────
    const total = revenue.totalConsolidated
    const prevOf = (key: ChannelSlice['key']): number => {
      if (!prevRevenue) return 0
      if (key === 'combos') return prevRevenue.byType.combos
      if (key === 'avulso') return prevRevenue.byType.avulso
      if (key === 'market') return prevRevenue.market.revenue
      return prevRevenue.hook.revenue
    }
    const slice = (key: ChannelSlice['key'], label: string, value: number): ChannelSlice => ({
      key,
      label,
      revenue: round2(value),
      share: total > 0 ? Math.round((value / total) * 10000) / 10000 : 0,
      deltaPct: prev ? percentDelta(value, prevOf(key)) : null,
    })
    const slices = [
      slice('combos', 'Combos', revenue.byType.combos),
      slice('avulso', 'Compra personalizada', revenue.byType.avulso),
      slice('market', '🧺 Cestinha', revenue.market.revenue),
      slice('hook', 'Gancho de porta', revenue.hook.revenue),
    ].filter((s) => s.revenue > 0 || s.deltaPct != null)

    // ── Ticket médio (V3) ────────────────────────────────────────────────────
    const creditPaid = payments.byPurpose.find((p) => p.purpose === 'CREDITS')
    const creditOrders = creditPaid?.paid ?? 0
    const prevCredit = prevPayments?.byPurpose.find((p) => p.purpose === 'CREDITS')

    // A Cestinha usa o GMV, não `market.revenue`: o ticket responde "quanto vale um pedido", e um
    // pedido pago metade em pãezinhos vale o que o cliente levou, não só a parte em dinheiro.
    // Somar ESTE número à receita seria o erro (D-2) — aqui ele não é somado a nada.
    const marketTicket: TicketSlice = {
      orders: revenue.market.orders,
      revenue: revenue.market.gmv,
      avg: revenue.market.orders > 0 ? round2(revenue.market.gmv / revenue.market.orders) : 0,
    }

    // ── Performance por condomínio (V9) ──────────────────────────────────────
    const condominiums: CondoPerformance[] = condos.items.map((c) => ({
      condominiumId: c.condominiumId,
      condominiumName: c.condominiumName,
      revenue: c.revenue,
      activeClients: c.activeClients,
      breadsDelivered: c.breadsDelivered,
      revenuePerClient: c.activeClients > 0 ? round2(c.revenue / c.activeClients) : 0,
      breadsPerClient:
        c.activeClients > 0 ? Math.round((c.breadsDelivered / c.activeClients) * 10) / 10 : 0,
    }))

    // ── Ressalvas ────────────────────────────────────────────────────────────
    const caveats: string[] = [
      'Itens vendidos são apurados pelo DIA DE ENTREGA; a receita, pela DATA DO PAGAMENTO. No modelo pré-pago os dois lados não fecham entre si — o pão entregue neste período pode ter sido pago em outro.',
      `O pão é valorizado ao preço do avulso (R$ ${sales.breads.unitPrice.toFixed(2)}): é o valor do que saiu pela porta, não o que foi faturado.`,
    ]
    if (win.isPartial) {
      caveats.unshift('Período EM CURSO — os números ainda vão mudar até o fim da janela.')
    }
    if (sales.breads.unitPrice === 0) {
      caveats.push('`avulsoUnit` não está configurado: o pão entra com valor ZERO e a curva ABC ignora a linha do pão.')
    }

    return {
      period: presetOf(win),
      window: windowDescriptor(win),
      previous: prev ? windowDescriptor(prev) : undefined,
      sales: { ...sales, lines: withAbc(sales.lines) },
      channel: {
        total,
        deltaPct: prevRevenue ? percentDelta(total, prevRevenue.totalConsolidated) : null,
        slices,
      },
      ticket: {
        credit: {
          orders: creditOrders,
          revenue: round2(revenue.total),
          avg: creditOrders > 0 ? round2(revenue.total / creditOrders) : 0,
          deltaPct:
            prevCredit && prevCredit.paid > 0
              ? percentDelta(
                  creditOrders > 0 ? revenue.total / creditOrders : 0,
                  prevCredit.amount / prevCredit.paid,
                )
              : null,
        },
        market: marketTicket,
        perClient: {
          orders: buyers,
          revenue: total,
          avg: buyers > 0 ? round2(total / buyers) : 0,
        },
      },
      combos,
      condominiums,
      caveats,
    }
  }

  /**
   * Receita por combo (V6) — a única agregação nova do relatório.
   *
   * Nova porque nenhum serviço existente quebra `Payment` por `comboId`; tudo o mais aqui é
   * composição. `pricePerCredit` é o que torna a lista comparável: um combo de 30 pães e outro de
   * 10 não se comparam por receita bruta, e sim por quanto a casa recebe por pãozinho vendido.
   */
  private async combosBreakdown(startDate: Date, endDate: Date): Promise<ComboSlice[]> {
    const groups = await this.prisma.payment.groupBy({
      by: ['comboId'],
      where: {
        status: 'PAID',
        createdAt: { gte: startDate, lte: endDate },
        // Nunca `comboId: null` no Mongo — a chave pode simplesmente não existir no documento.
        comboId: { not: null },
      },
      _sum: { amount: true },
      _count: true,
    })
    if (groups.length === 0) return []

    const ids = groups.map((g) => g.comboId).filter((id): id is string => id != null)
    const combos = await this.prisma.combo.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, quantity: true, price: true },
    })
    const byId = new Map(combos.map((c) => [c.id, c]))

    const total = groups.reduce((s, g) => s + (g._sum.amount ?? 0), 0)

    return groups
      .map((g) => {
        const id = g.comboId as string
        const combo = byId.get(id)
        const revenue = round2(g._sum.amount ?? 0)
        const credits = (combo?.quantity ?? 0) * g._count
        return {
          comboId: id,
          // Combo apagado não some do relatório: a venda aconteceu, e omiti-la faria a soma dos
          // combos não bater com a receita de combos do mix de canal.
          name: combo?.name ?? 'Combo removido',
          quantity: combo?.quantity ?? 0,
          price: combo?.price ?? 0,
          orders: g._count,
          revenue,
          share: total > 0 ? Math.round((revenue / total) * 10000) / 10000 : 0,
          pricePerCredit: credits > 0 ? round2(revenue / credits) : null,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
  }

  /**
   * Clientes DISTINTOS que pagaram algo no período — o divisor do ticket médio por cliente.
   *
   * Conta todas as finalidades (crédito, Cestinha e gancho) porque o numerador é a receita
   * CONSOLIDADA: dividir o consolidado só pelos compradores de crédito inflaria o ticket de quem
   * só comprou Cestinha no período.
   */
  private async distinctBuyers(startDate: Date, endDate: Date): Promise<number> {
    const groups = await this.prisma.payment.groupBy({
      by: ['userId'],
      where: { status: 'PAID', createdAt: { gte: startDate, lte: endDate } },
    })
    return groups.length
  }
}
