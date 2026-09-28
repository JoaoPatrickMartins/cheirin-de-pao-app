/**
 * customers.service — Top clientes, LTV e novos × recorrentes (V7/V8 da Fase 6).
 *
 * Responde "quem sustenta o faturamento" — a pergunta que o ranking de condomínios não alcança,
 * porque um condomínio forte pode ser um cliente só comprando muito.
 *
 * ## Duas medidas de cliente, de propósito
 *
 *   - **`revenue`** — o que o cliente pagou NO PERÍODO. É a régua do ranking.
 *   - **`ltv`** — o que ele pagou DESDE SEMPRE, sem janela. É o que diz se o campeão do mês é um
 *     cliente fiel ou alguém que fez uma compra grande e sumiu.
 *
 * O LTV é buscado só para os clientes que aparecem no topo, não para a base inteira: o número só
 * é lido ao lado da linha do ranking, e varrer todo o histórico de todo cliente para exibir vinte
 * linhas seria caro à toa.
 *
 * ## `novo` é por CADASTRO, não por primeira compra
 *
 * `User.createdAt` dentro da janela = cliente novo. A alternativa (primeira compra dentro da
 * janela) exigiria varrer o histórico inteiro de pagamentos de todo comprador para descobrir se
 * aquela foi a primeira — e as duas definições só divergem para quem se cadastrou num período e
 * comprou noutro. A escolha viaja declarada em `caveats`, em vez de o número parecer exato.
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

const round2 = (n: number) => Math.round(n * 100) / 100

/** Quantos clientes o topo traz. Acima disso vira lista de base, não ranking. */
const TOP_LIMIT = 25

export interface TopCustomer {
  userId: string
  name: string
  condominiumName: string | null
  /** Receita do cliente NO PERÍODO — a régua do ranking. */
  revenue: number
  orders: number
  /** Ticket médio do cliente no período. */
  avgTicket: number
  /** Receita acumulada DESDE SEMPRE. Sem janela. */
  ltv: number
  /** Fatia do cliente na receita do período (0..1). */
  share: number
  /** `true` quando o cadastro é do próprio período. */
  isNew: boolean
}

export interface CustomersReport {
  period?: ReportPeriod
  window: WindowDescriptor
  /** Clientes DISTINTOS que pagaram algo no período. */
  buyers: number
  revenue: number
  /** Receita e contagem dos clientes cadastrados DENTRO da janela. */
  newCustomers: { clients: number; revenue: number; share: number }
  /** O resto — base existente. */
  returning: { clients: number; revenue: number; share: number }
  /** Concentração: fatia da receita nos 5 e nos 10 maiores. O risco de depender de poucos. */
  concentration: { top5: number; top10: number }
  top: TopCustomer[]
  caveats: string[]
}

export class CustomersService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  async getCustomersReport(input: PeriodInput): Promise<CustomersReport> {
    const win = toWindow(input)
    const { startDate, endDate } = win

    // Receita por cliente no período — todas as finalidades, que é o consolidado que o mix de
    // canal também usa. Um cliente que só comprou Cestinha é cliente igual.
    const groups = await this.prisma.payment.groupBy({
      by: ['userId'],
      where: { status: 'PAID', createdAt: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      _count: true,
    })

    const revenue = round2(groups.reduce((s, g) => s + (g._sum.amount ?? 0), 0))
    const ranked = [...groups].sort((a, b) => (b._sum.amount ?? 0) - (a._sum.amount ?? 0))

    const share = (value: number) => (revenue > 0 ? Math.round((value / revenue) * 10000) / 10000 : 0)
    const sumOfTop = (n: number) =>
      ranked.slice(0, n).reduce((s, g) => s + (g._sum.amount ?? 0), 0)

    if (groups.length === 0) {
      return {
        period: presetOf(win),
        window: windowDescriptor(win),
        buyers: 0,
        revenue: 0,
        newCustomers: { clients: 0, revenue: 0, share: 0 },
        returning: { clients: 0, revenue: 0, share: 0 },
        concentration: { top5: 0, top10: 0 },
        top: [],
        caveats: this.caveats(win.isPartial),
      }
    }

    const topIds = ranked.slice(0, TOP_LIMIT).map((g) => g.userId)

    const [users, ltvGroups, newUsers] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: topIds } },
        select: { id: true, name: true, createdAt: true, condominiumId: true },
      }),
      // LTV só do topo — ver o cabeçalho.
      this.prisma.payment.groupBy({
        by: ['userId'],
        where: { status: 'PAID', userId: { in: topIds } },
        _sum: { amount: true },
      }),
      // Quem, entre os compradores do período, se cadastrou DENTRO dele.
      this.prisma.user.findMany({
        where: {
          id: { in: groups.map((g) => g.userId) },
          createdAt: { gte: startDate, lte: endDate },
        },
        select: { id: true },
      }),
    ])

    const condoIds = [...new Set(users.map((u) => u.condominiumId).filter((id): id is string => id != null))]
    const condos =
      condoIds.length > 0
        ? await this.prisma.condominium.findMany({
            where: { id: { in: condoIds } },
            select: { id: true, name: true },
          })
        : []
    const condoName = new Map(condos.map((c) => [c.id, c.name]))
    const userById = new Map(users.map((u) => [u.id, u]))
    const ltvById = new Map(ltvGroups.map((g) => [g.userId, round2(g._sum.amount ?? 0)]))
    const newIds = new Set(newUsers.map((u) => u.id))

    const top: TopCustomer[] = ranked.slice(0, TOP_LIMIT).map((g) => {
      const u = userById.get(g.userId)
      const value = round2(g._sum.amount ?? 0)
      return {
        userId: g.userId,
        // Cliente apagado continua no ranking: a receita existiu, e sumir com a linha faria a soma
        // do topo não bater com o total.
        name: u?.name ?? 'Cliente removido',
        condominiumName: u?.condominiumId ? (condoName.get(u.condominiumId) ?? null) : null,
        revenue: value,
        orders: g._count,
        avgTicket: g._count > 0 ? round2(value / g._count) : 0,
        ltv: ltvById.get(g.userId) ?? value,
        share: share(value),
        isNew: newIds.has(g.userId),
      }
    })

    const newRevenue = round2(
      groups.filter((g) => newIds.has(g.userId)).reduce((s, g) => s + (g._sum.amount ?? 0), 0),
    )

    return {
      period: presetOf(win),
      window: windowDescriptor(win),
      buyers: groups.length,
      revenue,
      newCustomers: { clients: newIds.size, revenue: newRevenue, share: share(newRevenue) },
      returning: {
        clients: groups.length - newIds.size,
        revenue: round2(revenue - newRevenue),
        share: share(revenue - newRevenue),
      },
      concentration: { top5: share(sumOfTop(5)), top10: share(sumOfTop(10)) },
      top,
      caveats: this.caveats(win.isPartial),
    }
  }

  private caveats(isPartial: boolean): string[] {
    const out = [
      '"Novo" é quem se CADASTROU no período, não quem comprou pela primeira vez — as duas definições divergem para quem se cadastrou antes e só comprou agora.',
      'A receita por cliente é consolidada: crédito, Cestinha e gancho de porta somados.',
      `O LTV é a receita acumulada desde sempre e só é calculado para os ${TOP_LIMIT} maiores do período.`,
    ]
    if (isPartial) out.unshift('Período EM CURSO — os números ainda vão mudar.')
    return out
  }
}
