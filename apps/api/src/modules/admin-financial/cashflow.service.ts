/**
 * cashflow.service — fluxo de caixa realizado (F5 da Fase 5 do plano-financeiro-vendas).
 *
 * Diferente do DRE, e a diferença é o ponto: o DRE responde **"o período deu lucro?"**; este
 * responde **"o dinheiro entrou e saiu quando?"**. Num modelo pré-pago os dois divergem muito —
 * um mês de campanha tem caixa forte e resultado normal, porque o combo vendido é dinheiro hoje e
 * pão a entregar depois.
 *
 * Tudo aqui é **realizado**, nunca projetado: entrada é `Payment` aprovado, saída é despesa com
 * `paidAt` e compra ao fornecedor finalizada. O que está por vir vive em contas a pagar.
 */
import { FastifyInstance } from 'fastify'
import {
  toWindow,
  presetOf,
  windowDescriptor,
  type PeriodInput,
  type ReportPeriod,
  type WindowDescriptor,
} from '../../lib/date-range.js'
import { loadFeeRates, summarizeFees, resolveFee } from '../../lib/gateway-fee.js'

const round2 = (n: number) => Math.round(n * 100) / 100
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** "AAAA-MM-DD" do dia BRT de um instante. */
function dayKeyBrt(at: Date): string {
  const s = new Date(at.getTime() - BRT_OFFSET_MS)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`
}

export interface CashflowReport {
  period?: ReportPeriod
  window: WindowDescriptor

  /** Entradas: o LÍQUIDO que caiu na conta (bruto − taxa), que é o que o extrato mostra. */
  inflow: number
  /** Bruto faturado, para conciliar com a receita do DRE. */
  inflowGross: number
  gatewayFee: number
  /** Estornos — dinheiro que voltou ao cliente. */
  refunds: number

  /** Saídas: despesas pagas + compras ao fornecedor finalizadas. */
  outflow: number
  expensesPaid: number
  supplierPurchases: number

  /** `inflow − outflow`. Pode ser negativo — e um caixa negativo precisa aparecer como tal. */
  net: number

  /**
   * Série diária com saldo ACUMULADO dentro da janela.
   *
   * O acumulado parte de zero: é a variação do período, não o saldo bancário — o sistema não
   * conhece o extrato, e fingir um saldo inicial seria inventar número.
   */
  daily: Array<{
    day: string
    inflow: number
    outflow: number
    net: number
    cumulative: number
  }>

  /** Maior e menor dia, para a tela destacar sem recalcular. */
  bestDay: { day: string; net: number } | null
  worstDay: { day: string; net: number } | null
}

export class CashflowService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  async getReport(input: PeriodInput): Promise<CashflowReport> {
    const win = toWindow(input)
    const { startDate, endDate } = win

    const [rates, payments, refundAgg, expenses, purchases] = await Promise.all([
      loadFeeRates(this.prisma),
      this.prisma.payment.findMany({
        where: { status: 'PAID', createdAt: { gte: startDate, lte: endDate } },
        select: { amount: true, method: true, createdAt: true, gatewayFee: true, feeBasis: true },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'REFUNDED', updatedAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.expense.findMany({
        // `paidAt` e não competência: aqui a pergunta é quando o dinheiro SAIU.
        where: { status: 'PAID', paidAt: { gte: startDate, lt: endDate } },
        select: { amount: true, paidAt: true },
      }),
      // B5 — a saída de caixa é o PAGAMENTO, não a finalização do pedido. `paidAt ?? date` mantém
      // toda compra anterior ao campo exatamente onde ela já estava: sem esse fallback, o caixa de
      // todos os meses passados mudaria sozinho no dia do deploy.
      //
      // O `OR` busca as duas pontas e o filtro fino fica em código, porque `paidAt ?? date` não se
      // expressa num `where` do Mongo.
      this.prisma.purchaseOrder.findMany({
        where: {
          status: 'FINALIZED',
          OR: [
            { date: { gte: startDate, lte: endDate } },
            { paidAt: { gte: startDate, lte: endDate } },
          ],
        },
        select: { id: true, date: true, paidAt: true, totalValue: true },
      }),
    ])

    const fees = summarizeFees(payments, rates)
    const refunds = round2(refundAgg._sum.amount ?? 0)

    // `totalValue` só existe em pedido criado depois da matriz de fornecimento; nos antigos é nulo
    // e o custo precisa vir dos itens. Buscar os itens SEMPRE seria caro à toa.
    // Só as compras cuja data EFETIVA de caixa cai na janela.
    const inWindow = purchases.filter((p) => {
      const effective = p.paidAt ?? p.date
      return effective >= startDate && effective <= endDate
    })
    const purchasesTotal = await this.purchaseTotals(inWindow)

    const expensesPaid = round2(expenses.reduce((s, e) => s + e.amount, 0))
    const supplierPurchases = round2([...purchasesTotal.values()].reduce((s, v) => s + v, 0))

    const inflow = fees.net
    const outflow = round2(expensesPaid + supplierPurchases + refunds)

    // ── Série diária ───────────────────────────────────────────────────────
    const inByDay = new Map<string, number>()
    for (const p of payments) {
      const day = dayKeyBrt(p.createdAt)
      // O acumulado é do LÍQUIDO, como as entradas — misturar bruto na série e líquido no total
      // faria os dois não fecharem.
      const net = resolveFee(p, rates).net
      inByDay.set(day, round2((inByDay.get(day) ?? 0) + net))
    }

    const outByDay = new Map<string, number>()
    for (const e of expenses) {
      if (e.paidAt == null) continue
      const day = dayKeyBrt(e.paidAt)
      outByDay.set(day, round2((outByDay.get(day) ?? 0) + e.amount))
    }
    for (const po of inWindow) {
      // Mesmo `paidAt ?? date` do total: a série tem de somar exatamente o mesmo conjunto, senão
      // o gráfico e o card do topo discordariam.
      const day = dayKeyBrt(po.paidAt ?? po.date)
      const value = purchasesTotal.get(po.id) ?? 0
      outByDay.set(day, round2((outByDay.get(day) ?? 0) + value))
    }

    const daily = this.buildSeries(startDate, endDate, inByDay, outByDay)

    // Dias sem movimento não concorrem a melhor/pior: um domingo parado não é "o pior dia".
    const moving = daily.filter((d) => d.inflow !== 0 || d.outflow !== 0)
    const best = moving.reduce<(typeof moving)[number] | null>(
      (acc, d) => (acc == null || d.net > acc.net ? d : acc),
      null,
    )
    const worst = moving.reduce<(typeof moving)[number] | null>(
      (acc, d) => (acc == null || d.net < acc.net ? d : acc),
      null,
    )

    return {
      period: presetOf(win),
      window: windowDescriptor(win),
      inflow,
      inflowGross: fees.gross,
      gatewayFee: fees.fee,
      refunds,
      outflow,
      expensesPaid,
      supplierPurchases,
      net: round2(inflow - outflow),
      daily,
      bestDay: best ? { day: best.day, net: best.net } : null,
      worstDay: worst ? { day: worst.day, net: worst.net } : null,
    }
  }

  /**
   * Custo por pedido ao fornecedor.
   *
   * `totalValue` é o caminho rápido; pedido legado sem o campo cai nos itens. O fallback é feito
   * numa consulta só, para os antigos, em vez de uma por pedido.
   */
  private async purchaseTotals(
    orders: Array<{ id: string; totalValue: number | null }>,
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>()
    const missing: string[] = []

    for (const o of orders) {
      if (o.totalValue != null) out.set(o.id, round2(o.totalValue))
      else missing.push(o.id)
    }
    if (missing.length === 0) return out

    const items = await this.prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId: { in: missing } },
      select: { purchaseOrderId: true, quantity: true, unitPrice: true },
    })
    for (const it of items) {
      const prev = out.get(it.purchaseOrderId) ?? 0
      out.set(it.purchaseOrderId, round2(prev + it.quantity * it.unitPrice))
    }
    // Pedido finalizado sem item e sem total fica em zero explicitamente — some da soma, não da
    // série.
    for (const id of missing) if (!out.has(id)) out.set(id, 0)
    return out
  }

  /**
   * Série contínua dia a dia, incluindo os dias SEM movimento.
   *
   * Pular dia vazio quebraria o gráfico: a linha do acumulado saltaria e a distância entre pontos
   * deixaria de significar tempo.
   */
  private buildSeries(
    start: Date,
    end: Date,
    inByDay: Map<string, number>,
    outByDay: Map<string, number>,
  ): CashflowReport['daily'] {
    const out: CashflowReport['daily'] = []
    let cumulative = 0

    // Teto de 366 dias: a série é para leitura visual, e um intervalo de anos viraria um gráfico
    // ilegível e um payload grande à toa.
    const maxDays = 366
    let cursor = new Date(start.getTime())

    for (let i = 0; i < maxDays && cursor < end; i++) {
      const day = dayKeyBrt(cursor)
      const inflow = inByDay.get(day) ?? 0
      const outflow = outByDay.get(day) ?? 0
      const net = round2(inflow - outflow)
      cumulative = round2(cumulative + net)
      out.push({ day, inflow, outflow, net, cumulative })
      cursor = new Date(cursor.getTime() + DAY_MS)
    }
    return out
  }
}
