/**
 * gateway.service — conciliação de gateway (F6 da Fase 3 do plano-financeiro-vendas).
 *
 * Responde a pergunta que nenhum relatório respondia: **"faturei X, quanto caiu na conta?"**
 * Antes desta onda, todo número financeiro do admin era bruto, e a diferença — que num negócio de
 * ticket baixo e volume alto é uma das maiores linhas do DRE — simplesmente não existia.
 *
 * Toda linha declara a BASE (real do provedor × estimada pelo Setting), porque exibir os dois
 * misturados sem dizer qual é qual daria ao relatório uma precisão que ele não tem.
 */
import { FastifyInstance } from 'fastify'
import type { PaymentMethod, PaymentPurpose } from '@prisma/client'
import {
  loadFeeRates,
  summarizeFees,
  resolveFee,
  type FeeSummary,
  type FeeRates,
} from '../../lib/gateway-fee.js'
import {
  toWindow,
  presetOf,
  windowDescriptor,
  type PeriodInput,
  type ReportPeriod,
  type WindowDescriptor,
} from '../../lib/date-range.js'

const round2 = (n: number) => Math.round(n * 100) / 100

export interface GatewayReport {
  period?: ReportPeriod
  window: WindowDescriptor
  /** Consolidado do período — TODOS os pagamentos aprovados, qualquer finalidade. */
  total: FeeSummary
  /** Alíquotas em uso (%), para a tela poder dizer de onde saiu a estimativa. */
  rates: Record<PaymentMethod, number>
  byMethod: Array<{ method: PaymentMethod } & FeeSummary>
  /** Por finalidade: crédito, gancho e Cestinha têm mixes de método diferentes. */
  byPurpose: Array<{ purpose: 'CREDITS' | 'HOOK' | 'MARKET' } & FeeSummary>
  /**
   * Estornos do período — dinheiro que VOLTOU.
   *
   * Em linha própria e **fora** de `total`: o gateway normalmente não devolve a taxa de um
   * pagamento estornado, então somar o estorno ao bruto embaralharia duas coisas distintas.
   */
  refunds: { amount: number; count: number }
}

export class GatewayService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  async getReport(input: PeriodInput): Promise<GatewayReport> {
    const win = toWindow(input)
    const { startDate, endDate } = win

    const [rates, paid, refundAgg] = await Promise.all([
      loadFeeRates(this.prisma),
      this.prisma.payment.findMany({
        where: { status: 'PAID', createdAt: { gte: startDate, lte: endDate } },
        select: {
          amount: true,
          method: true,
          purpose: true,
          gatewayFee: true,
          feeBasis: true,
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { status: 'REFUNDED', updatedAt: { gte: startDate, lte: endDate } },
      }),
    ])

    return {
      period: presetOf(win),
      window: windowDescriptor(win),
      total: summarizeFees(paid, rates),
      rates: rates.pct,
      byMethod: this.groupBy(paid, rates, (p) => p.method).map(([method, summary]) => ({
        method: method as PaymentMethod,
        ...summary,
      })),
      // `purpose` nulo = compra de crédito: o campo nasceu depois do fluxo de créditos, e
      // documento antigo simplesmente não tem a chave (nunca gravou 'CREDITS').
      byPurpose: this.groupBy(paid, rates, (p) => (p.purpose ?? 'CREDITS') as string).map(
        ([purpose, summary]) => ({
          purpose: purpose as 'CREDITS' | 'HOOK' | 'MARKET',
          ...summary,
        }),
      ),
      refunds: {
        amount: round2(refundAgg._sum.amount ?? 0),
        count: refundAgg._count,
      },
    }
  }

  /** Agrupa e resume, descartando grupos vazios. */
  private groupBy<T extends { amount: number; method: PaymentMethod; gatewayFee?: number | null; feeBasis?: string | null }>(
    rows: T[],
    rates: FeeRates,
    keyOf: (row: T) => string,
  ): Array<[string, FeeSummary]> {
    const buckets = new Map<string, T[]>()
    for (const row of rows) {
      const key = keyOf(row)
      const list = buckets.get(key)
      if (list) list.push(row)
      else buckets.set(key, [row])
    }
    return [...buckets.entries()]
      .map(([key, list]) => [key, summarizeFees(list, rates)] as [string, FeeSummary])
      .sort((a, b) => b[1].gross - a[1].gross)
  }

  /**
   * Taxa total do período — o que a linha de dedução do DRE consome.
   *
   * Separado de `getReport` porque o DRE precisa de UM número e não da quebra inteira; e porque
   * ele roda duas vezes quando há comparativo.
   */
  async getFeeTotal(input: PeriodInput): Promise<FeeSummary> {
    const { startDate, endDate } = toWindow(input)
    const [rates, paid] = await Promise.all([
      loadFeeRates(this.prisma),
      this.prisma.payment.findMany({
        where: { status: 'PAID', createdAt: { gte: startDate, lte: endDate } },
        select: { amount: true, method: true, gatewayFee: true, feeBasis: true },
      }),
    ])
    return summarizeFees(paid, rates)
  }

  /** Taxa de um pagamento avulso — usado pelo detalhe de pagamento no admin. */
  async resolveOne(payment: {
    amount: number
    method: PaymentMethod
    gatewayFee?: number | null
    feeBasis?: string | null
  }) {
    return resolveFee(payment, await loadFeeRates(this.prisma))
  }
}

/** Reexportado para o controller tipar o purpose sem reimportar do Prisma. */
export type { PaymentPurpose }
