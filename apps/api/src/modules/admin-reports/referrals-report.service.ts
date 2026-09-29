/**
 * referrals-report.service — relatório "Indicações" do Indique e Ganhe (A6, §7.10).
 *
 * Duas leituras no mesmo relatório, e cada número declara a sua:
 *
 *   1. **Coorte do período** — as indicações CADASTRADAS na janela: funil (visitas → cadastros →
 *      confirmados → recompensados), conversão e distribuição por estado. É o que responde "o
 *      programa converte?": uma indicação feita no fim do mês só recompensa no seguinte, e contar
 *      pela data da recompensa misturaria coortes.
 *   2. **Fluxo do período** — o que ACONTECEU na janela: pãezins creditados (e o custo deles), a
 *      receita dos indicados e o top 5 (quem mais teve indicação valendo no período). É o que
 *      responde "quanto custou e quanto trouxe" neste mês.
 *
 * O custo em R$ é pães × preço médio pago (`estimateBreadUnitPrice`) — a mesma base da linha
 * "Bonificações de indicação" do DRE.
 */
import { FastifyInstance } from 'fastify'
import type { TransactionType } from '@prisma/client'
import { fromMilli } from '@cheirin-de-pao/shared'
import { windowDescriptor, type DateWindow, type WindowDescriptor } from '../../lib/date-range.js'
import { estimateBreadUnitPrice } from '../../lib/bread-price.js'
import { referralStateKey, type ReferralStateKey } from '../../lib/referral.js'

const round2 = (n: number) => Math.round(n * 100) / 100

const REFERRAL_TX_TYPES: TransactionType[] = ['REFERRAL_BONUS', 'REFERRAL_WELCOME', 'REFERRAL_GOAL']

/** Tamanho do ranking de indicadores. */
const TOP_SIZE = 5

export interface ReferralsReport {
  window: WindowDescriptor
  /** Coorte: indicações cadastradas no período. */
  signups: number
  /** Coorte: dessas, as já recompensadas. */
  rewarded: number
  /** `rewarded ÷ signups` (fração); `null` sem cadastros. */
  conversion: number | null
  /** Fluxo: pãezins creditados no período. Metas contam para quem indicou. */
  breads: { referrer: number; friends: number; total: number }
  /** Quanto vale um pãozin em R$ (preço médio pago). */
  unitPrice: number
  /** `breads × unitPrice`. */
  cost: { referrer: number; friends: number; total: number }
  /** Fluxo: pagamentos reais (sem gancho) dos indicados no período. */
  revenue: number
  /** "Cada R$ 1 em bônus trouxe R$ X" — `revenue ÷ cost.total`; `null` sem custo. */
  revenuePerReal: number | null
  /** Coorte: visitantes únicos pelo link → cadastros → confirmados (1º login) → recompensados. */
  funnel: { visits: number; signups: number; verified: number; rewarded: number }
  /** Fluxo: quem mais teve indicação valendo no período, com os pãezins que ganhou nele. */
  top: Array<{ id: string; name: string; rewarded: number; earnedBreads: number }>
  /** Coorte: indicações do período por estado (§4.2). */
  byState: Record<ReferralStateKey, number>
  caveats: string[]
}

export class ReferralsReportService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  async getReport(win: DateWindow): Promise<ReferralsReport> {
    const prisma = this.prisma
    const inWindow = { gte: win.startDate, lte: win.endDate }

    const [cohort, rewardedInWindow, txs, visitors, referred, unitPrice] = await Promise.all([
      prisma.referral.findMany({ where: { createdAt: inWindow }, select: { status: true, verifiedAt: true } }),
      prisma.referral.findMany({ where: { status: 'REWARDED', rewardedAt: inWindow }, select: { referrerId: true } }),
      prisma.creditTransaction.findMany({
        where: { type: { in: REFERRAL_TX_TYPES }, createdAt: inWindow },
        select: { userId: true, type: true, quantityMilli: true },
      }),
      // `not: null` também deixa de fora o evento antigo, sem a chave — é o que se quer aqui.
      prisma.analyticsEvent.findMany({
        where: { type: 'ACCESS', refCode: { not: null }, createdAt: inWindow },
        select: { visitorId: true },
        distinct: ['visitorId'],
      }),
      // Recusada não entra: o admin decidiu que aquela pessoa não veio pelo programa.
      prisma.referral.findMany({ where: { status: { not: 'REJECTED' } }, select: { referredId: true } }),
      estimateBreadUnitPrice(prisma),
    ])

    // ── Coorte ──────────────────────────────────────────────────────────
    const byState: Record<ReferralStateKey, number> = { cadastro: 0, aguardando: 0, analise: 0, ganhou: 0, recusada: 0, expirou: 0 }
    for (const r of cohort) byState[referralStateKey(r)]++
    const signups = cohort.length
    const rewarded = byState.ganhou
    const verified = cohort.filter((r) => r.verifiedAt).length

    // ── Fluxo: pãezins e custo (soma em milésimos, converte no fim) ──────
    let referrerMilli = 0
    let friendsMilli = 0
    const earnedMilliBy = new Map<string, number>()
    for (const t of txs) {
      const milli = t.quantityMilli ?? 0
      if (t.type === 'REFERRAL_WELCOME') {
        friendsMilli += milli
      } else {
        referrerMilli += milli
        earnedMilliBy.set(t.userId, (earnedMilliBy.get(t.userId) ?? 0) + milli)
      }
    }
    const breads = {
      referrer: fromMilli(referrerMilli),
      friends: fromMilli(friendsMilli),
      total: fromMilli(referrerMilli + friendsMilli),
    }
    const cost = {
      referrer: round2(breads.referrer * unitPrice),
      friends: round2(breads.friends * unitPrice),
      total: round2(breads.total * unitPrice),
    }

    // ── Fluxo: receita dos indicados ────────────────────────────────────
    const referredIds = [...new Set(referred.map((r) => r.referredId))]
    let revenue = 0
    if (referredIds.length > 0) {
      const payments = await prisma.payment.findMany({
        where: { userId: { in: referredIds }, status: 'PAID', createdAt: inWindow },
        select: { amount: true, purpose: true },
      })
      // Em código: `purpose` é nulo OU ausente na compra de pão (armadilha do Mongo).
      revenue = round2(payments.filter((p) => p.purpose !== 'HOOK').reduce((acc, p) => acc + p.amount, 0))
    }

    // ── Fluxo: top 5 ────────────────────────────────────────────────────
    const rewardedBy = new Map<string, number>()
    for (const r of rewardedInWindow) rewardedBy.set(r.referrerId, (rewardedBy.get(r.referrerId) ?? 0) + 1)
    const ranking = [...rewardedBy.entries()]
      .map(([id, n]) => ({ id, rewarded: n, earnedBreads: fromMilli(earnedMilliBy.get(id) ?? 0) }))
      .sort((a, b) => b.rewarded - a.rewarded || b.earnedBreads - a.earnedBreads)
      .slice(0, TOP_SIZE)
    const names = ranking.length
      ? await prisma.user.findMany({ where: { id: { in: ranking.map((r) => r.id) } }, select: { id: true, name: true } })
      : []
    const nameById = new Map(names.map((u) => [u.id, u.name]))

    const caveats = [
      'Funil, conversão e estados contam as indicações CADASTRADAS no período; pãezins, custo, receita e top 5 contam o que aconteceu no período.',
      'Custo estimado = pãezins × preço médio pago por pãozin. Bônus não vira dinheiro: é pão que a casa entrega sem receber.',
    ]
    if (unitPrice === 0) caveats.push('Sem vendas nem preço avulso cadastrado, o custo em R$ não pôde ser estimado.')

    return {
      window: windowDescriptor(win),
      signups,
      rewarded,
      conversion: signups > 0 ? rewarded / signups : null,
      breads,
      unitPrice,
      cost,
      revenue,
      revenuePerReal: cost.total > 0 ? round2(revenue / cost.total) : null,
      funnel: { visits: visitors.length, signups, verified, rewarded },
      top: ranking.map((r) => ({ ...r, name: nameById.get(r.id) ?? '' })),
      byState,
      caveats,
    }
  }
}
