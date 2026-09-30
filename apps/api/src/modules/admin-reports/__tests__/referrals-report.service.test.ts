// referrals-report.service.test.ts — relatório "Indicações" (A6).
//
// Trava:
//   - COORTE (cadastradas no período) para funil, conversão e estados; FLUXO (o que aconteceu no
//     período) para pãezins, custo, receita e top 5;
//   - metas contam em quem indicou; boas-vindas, nos amigos;
//   - receita dos indicados sem gancho e sem as indicações recusadas;
//   - "cada R$ 1 trouxe R$ X" só com custo.
import { describe, it, expect, vi } from 'vitest'
import { ReferralsReportService } from '../referrals-report.service.js'
import { rangeWindow } from '../../../lib/date-range.js'

const WIN = () => rangeWindow('2026-09-01', '2026-09-30', new Date('2026-10-02T12:00:00Z'))

function makePrisma(opts: {
  cohort?: Array<{ status: string; verifiedAt: Date | null }>
  rewardedInWindow?: Array<{ referrerId: string }>
  txs?: Array<{ userId: string; type: string; quantityMilli: number }>
  visitors?: string[]
  referred?: string[]
  payments?: Array<{ amount: number; purpose: string | null }>
  users?: Array<{ id: string; name: string }>
  paid?: number
  purchasedMilli?: number
}) {
  const referralFindMany = vi.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
    if ('createdAt' in where) return Promise.resolve(opts.cohort ?? [])
    if ('rewardedAt' in where) return Promise.resolve(opts.rewardedInWindow ?? [])
    return Promise.resolve((opts.referred ?? []).map((referredId) => ({ referredId })))
  })
  return {
    referral: { findMany: referralFindMany },
    creditTransaction: {
      findMany: vi.fn().mockResolvedValue(opts.txs ?? []),
      aggregate: vi.fn().mockResolvedValue({ _sum: { quantityMilli: opts.purchasedMilli ?? 100_000 } }),
    },
    analyticsEvent: { findMany: vi.fn().mockResolvedValue((opts.visitors ?? []).map((visitorId) => ({ visitorId }))) },
    payment: {
      findMany: vi.fn().mockResolvedValue(opts.payments ?? []),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: opts.paid ?? 100 } }),
    },
    setting: { findUnique: vi.fn().mockResolvedValue(null) },
    user: { findMany: vi.fn().mockResolvedValue(opts.users ?? []) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeService = (prisma: unknown) => new ReferralsReportService({ prisma } as any)

describe('ReferralsReportService (A6)', () => {
  it('coorte: funil, conversão e estados das indicações cadastradas no período', async () => {
    const r = await makeService(
      makePrisma({
        visitors: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8'],
        cohort: [
          { status: 'PENDING', verifiedAt: null },
          { status: 'PENDING', verifiedAt: new Date() },
          { status: 'ON_HOLD', verifiedAt: new Date() },
          { status: 'REWARDED', verifiedAt: new Date() },
          { status: 'REWARDED', verifiedAt: new Date() },
          { status: 'REJECTED', verifiedAt: new Date() },
          { status: 'EXPIRED', verifiedAt: new Date() },
          { status: 'EXPIRED', verifiedAt: null },
        ],
      }),
    ).getReport(WIN())

    expect(r.funnel).toEqual({ visits: 8, signups: 8, verified: 6, rewarded: 2 })
    expect(r.signups).toBe(8)
    expect(r.rewarded).toBe(2)
    expect(r.conversion).toBe(0.25)
    expect(r.byState).toEqual({ cadastro: 1, aguardando: 1, analise: 1, ganhou: 2, recusada: 1, expirou: 2 })
  })

  it('fluxo: metas contam em quem indicou, boas-vindas nos amigos; custo pelo preço médio', async () => {
    const r = await makeService(
      makePrisma({
        paid: 120,
        purchasedMilli: 100_000, // R$ 1,20 por pãozin
        txs: [
          { userId: 'joao', type: 'REFERRAL_BONUS', quantityMilli: 5_000 },
          { userId: 'joao', type: 'REFERRAL_GOAL', quantityMilli: 10_000 },
          { userId: 'maria', type: 'REFERRAL_WELCOME', quantityMilli: 3_000 },
        ],
      }),
    ).getReport(WIN())

    expect(r.breads).toEqual({ referrer: 15, friends: 3, total: 18 })
    expect(r.unitPrice).toBeCloseTo(1.2)
    expect(r.cost).toEqual({ referrer: 18, friends: 3.6, total: 21.6 })
  })

  it('receita dos indicados: sem gancho; "cada R$ 1 trouxe" = receita ÷ custo', async () => {
    const prisma = makePrisma({
      paid: 100,
      purchasedMilli: 100_000, // R$ 1,00
      txs: [{ userId: 'joao', type: 'REFERRAL_BONUS', quantityMilli: 10_000 }],
      referred: ['maria', 'pedro', 'maria'],
      payments: [
        { amount: 30, purpose: null },
        { amount: 25, purpose: 'MARKET' },
        { amount: 5, purpose: 'HOOK' },
      ],
    })
    const r = await makeService(prisma).getReport(WIN())

    expect(r.revenue).toBe(55)
    expect(r.revenuePerReal).toBe(5.5)
    // Indicados sem repetição, e as recusadas ficam de fora.
    expect(prisma.referral.findMany).toHaveBeenCalledWith({ where: { status: { not: 'REJECTED' } }, select: { referredId: true } })
    expect(prisma.payment.findMany.mock.calls[0][0].where.userId).toEqual({ in: ['maria', 'pedro'] })
  })

  it('top 5: mais indicações valendo no período, desempate pelos pãezins ganhos', async () => {
    const r = await makeService(
      makePrisma({
        rewardedInWindow: [
          { referrerId: 'ana' },
          { referrerId: 'joao' },
          { referrerId: 'joao' },
          { referrerId: 'bia' },
        ],
        txs: [
          { userId: 'joao', type: 'REFERRAL_BONUS', quantityMilli: 10_000 },
          { userId: 'bia', type: 'REFERRAL_BONUS', quantityMilli: 10_000 },
          { userId: 'ana', type: 'REFERRAL_BONUS', quantityMilli: 5_000 },
        ],
        users: [
          { id: 'joao', name: 'João Silva' },
          { id: 'bia', name: 'Beatriz Rocha' },
          { id: 'ana', name: 'Ana Lopes' },
        ],
      }),
    ).getReport(WIN())

    expect(r.top).toEqual([
      { id: 'joao', name: 'João Silva', rewarded: 2, earnedBreads: 10 },
      { id: 'bia', name: 'Beatriz Rocha', rewarded: 1, earnedBreads: 10 },
      { id: 'ana', name: 'Ana Lopes', rewarded: 1, earnedBreads: 5 },
    ])
  })

  it('sem nada no período: conversão e "cada R$ 1" ficam null (não 0 nem Infinity)', async () => {
    const r = await makeService(makePrisma({})).getReport(WIN())
    expect(r.conversion).toBeNull()
    expect(r.revenuePerReal).toBeNull()
    expect(r.top).toEqual([])
  })

  it('o funil conta visitantes ÚNICOS com código', async () => {
    const prisma = makePrisma({ visitors: ['v1'] })
    await makeService(prisma).getReport(WIN())
    expect(prisma.analyticsEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'ACCESS', refCode: { not: null } }),
        distinct: ['visitorId'],
      }),
    )
  })
})
