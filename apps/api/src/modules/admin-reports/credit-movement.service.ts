/**
 * credit-movement.service — movimentação do passivo de crédito (F7).
 *
 * A tela de Passivo responde **quanto** a empresa deve em pão (um saldo). Esta responde **por que
 * ele mudou**: vendido, consumido, concedido, estornado, expirado. Sem ela, um passivo que sobe
 * R$ 3.000 num mês é um número sem causa — e a causa muda completamente a leitura (venda de combo
 * é ótimo; cortesia administrativa em massa, nem tanto).
 *
 * ## Tudo em MILÉSIMOS até o fim
 *
 * `quantityMilli` é a fonte canônica (negativo = débito). Converter para pãezinhos linha a linha e
 * somar depois acumularia arredondamento — o crédito é fracionado, e o erro apareceria justamente
 * no fechamento. Soma em milésimos, converte uma vez no fim.
 *
 * ## 🚩 O achado A2 mora aqui
 *
 * `TransactionType.EXPIRY` está declarado no enum e **nunca é escrito em runtime**: crédito não
 * expira, e o passivo cresce para sempre. A decisão do plano foi assumir o passivo perpétuo na v1 e
 * **nomear o problema** — é o que `inactive` faz: o recorte de saldo parado há mais de 12 meses.
 * Nomear já resolve 80%; a política de validade é decisão de negócio, não de código.
 */
import { FastifyInstance } from 'fastify'
import { fromMilli } from '@cheirin-de-pao/shared'
import {
  toWindow,
  presetOf,
  windowDescriptor,
  type PeriodInput,
  type ReportPeriod,
  type WindowDescriptor,
} from '../../lib/date-range.js'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Há quanto tempo um saldo precisa estar parado para entrar no recorte de inatividade (A2). */
const INACTIVE_MONTHS = 12

/** Rótulo e sinal esperado de cada tipo de movimento. */
const TYPE_META: Record<string, { label: string; kind: 'in' | 'out' }> = {
  PURCHASE: { label: 'Compra de créditos', kind: 'in' },
  ADMIN_GRANT: { label: 'Cortesia concedida', kind: 'in' },
  MARKET_REFUND: { label: 'Estorno de Cestinha', kind: 'in' },
  REFUND: { label: 'Estorno', kind: 'in' },
  DELIVERY: { label: 'Consumo em entrega', kind: 'out' },
  MARKET_PURCHASE: { label: 'Gasto na Cestinha', kind: 'out' },
  ADMIN_DEBIT: { label: 'Ajuste administrativo', kind: 'out' },
  EXPIRY: { label: 'Expiração', kind: 'out' },
  // Indique e Ganhe — bônus do programa entram no passivo como qualquer crédito (§7.10).
  REFERRAL_BONUS: { label: 'Bônus de indicação', kind: 'in' },
  REFERRAL_WELCOME: { label: 'Boas-vindas de indicação', kind: 'in' },
  REFERRAL_GOAL: { label: 'Meta de indicações', kind: 'in' },
}

export interface CreditMovementRow {
  type: string
  label: string
  kind: 'in' | 'out'
  /** Pãezinhos movimentados (sempre positivo — o sentido está em `kind`). */
  credits: number
  /** Quantos lançamentos. */
  count: number
}

export interface CreditMovementReport {
  period?: ReportPeriod
  window: WindowDescriptor
  /** Entradas de passivo: a empresa passou a dever mais pão. */
  issued: number
  /** Saídas de passivo: a empresa entregou o pão (ou o crédito saiu por ajuste). */
  settled: number
  /** `issued − settled`. Positivo = o passivo CRESCEU no período. */
  net: number
  rows: CreditMovementRow[]
  /**
   * 🚩 A2 — saldo parado. Crédito de cliente sem NENHUMA movimentação há mais de 12 meses.
   *
   * Não é cobrado nem expirado: é nomeado. O `TransactionType.EXPIRY` existe no enum e nunca é
   * escrito, então este é o tamanho do problema que a política de validade teria de resolver.
   */
  inactive: {
    months: number
    clients: number
    credits: number
    /** Estimativa em R$ pelo mesmo preço médio histórico do relatório de passivo. */
    estBRL: number
  }
  caveats: string[]
}

export class CreditMovementService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  async getReport(input: PeriodInput, now: Date = new Date()): Promise<CreditMovementReport> {
    const win = toWindow(input)

    const [groups, inactive] = await Promise.all([
      this.prisma.creditTransaction.groupBy({
        by: ['type'],
        where: { createdAt: { gte: win.startDate, lte: win.endDate } },
        _sum: { quantityMilli: true },
        _count: true,
      }),
      this.inactiveBalance(now),
    ])

    let issuedMilli = 0
    let settledMilli = 0

    const rows: CreditMovementRow[] = groups.map((g) => {
      const milli = g._sum.quantityMilli ?? 0
      const meta = TYPE_META[g.type] ?? { label: g.type, kind: milli >= 0 ? 'in' : 'out' }
      // O SINAL do dado manda, não o rótulo: um `ADMIN_GRANT` negativo (correção de cortesia
      // lançada errado) precisa reduzir o passivo, e classificá-lo por tipo o somaria.
      if (milli >= 0) issuedMilli += milli
      else settledMilli += Math.abs(milli)

      return {
        type: g.type,
        label: meta.label,
        kind: milli >= 0 ? 'in' : 'out',
        credits: fromMilli(Math.abs(milli)),
        count: g._count,
      }
    })

    rows.sort((a, b) => b.credits - a.credits)

    const issued = fromMilli(issuedMilli)
    const settled = fromMilli(settledMilli)

    const caveats = [
      'Movimento apurado pela data do LANÇAMENTO do crédito. Entradas fazem o passivo crescer (a empresa passou a dever mais pão); saídas o reduzem.',
      'O saldo total em circulação está na tela de Passivo de crédito — aqui é a variação, não a posição.',
    ]
    if (inactive.credits > 0) {
      caveats.push(
        `Crédito NÃO EXPIRA neste sistema: ${inactive.clients} cliente(s) com saldo parado há mais de ${INACTIVE_MONTHS} meses seguem como dívida em pão. Definir validade é decisão de negócio, não de relatório.`,
      )
    }
    if (win.isPartial) caveats.unshift('Período EM CURSO — os números ainda vão mudar.')

    return {
      period: presetOf(win),
      window: windowDescriptor(win),
      issued,
      settled,
      net: round2(issued - settled),
      rows,
      inactive,
      caveats,
    }
  }

  /**
   * Saldo de clientes sem NENHUM movimento de crédito há mais de {@link INACTIVE_MONTHS} meses.
   *
   * "Sem movimento" e não "sem compra": quem consome pão da agenda está ativo mesmo sem recarregar.
   * A conta é feita em código — a lista de quem movimentou é pequena perto da base, e um
   * `NOT IN` com dezenas de milhares de ids seria pior que a varredura.
   */
  private async inactiveBalance(now: Date): Promise<CreditMovementReport['inactive']> {
    const cutoff = new Date(now)
    cutoff.setUTCMonth(cutoff.getUTCMonth() - INACTIVE_MONTHS)

    const [withBalance, recent, liability] = await Promise.all([
      // `creditMilli: { gt: 0 }` casa só com chave presente e positiva — nunca `{ not: null }`
      // seguido de filtro em código, porque aqui o próprio `gt` já exclui ausente e zero.
      this.prisma.user.findMany({
        where: { role: 'CLIENT', creditMilli: { gt: 0 } },
        select: { id: true, creditMilli: true },
      }),
      this.prisma.creditTransaction.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: cutoff } },
      }),
      this.estPricePerCredit(),
    ])

    const active = new Set(recent.map((r) => r.userId))
    let milli = 0
    let clients = 0
    for (const u of withBalance) {
      if (active.has(u.id)) continue
      milli += u.creditMilli ?? 0
      clients += 1
    }

    const credits = fromMilli(milli)
    return {
      months: INACTIVE_MONTHS,
      clients,
      credits,
      estBRL: round2(credits * liability),
    }
  }

  /**
   * Preço médio histórico por crédito — a mesma base do relatório de passivo, para os dois números
   * não divergirem na mesma tela.
   */
  private async estPricePerCredit(): Promise<number> {
    const agg = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'PAID', comboId: { not: null } },
    })
    const credits = await this.prisma.creditTransaction.aggregate({
      _sum: { quantityMilli: true },
      where: { type: 'PURCHASE' },
    })
    const totalCredits = fromMilli(credits._sum.quantityMilli ?? 0)
    if (!(totalCredits > 0)) return 0
    return round2((agg._sum.amount ?? 0) / totalCredits)
  }
}
