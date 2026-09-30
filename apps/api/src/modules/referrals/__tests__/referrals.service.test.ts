import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('../../../lib/referral.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../lib/referral.js')>()
  return { ...real, buildCelebration: vi.fn().mockResolvedValue(null) }
})
vi.mock('../../../lib/referral-code.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../lib/referral-code.js')>()
  return { ...real, ensureReferralCode: vi.fn().mockResolvedValue('JOAO7K2F') }
})

import { ReferralsService } from '../referrals.service.js'
import { ensureReferralCode } from '../../../lib/referral-code.js'

const NOW = new Date('2026-10-06T15:00:00.000Z') // dentro da campanha abaixo
const DAY = 86_400_000

const ON: Record<string, string> = {
  indicacaoAtiva: 'true',
  indicacaoRecompensa: '5',
  indicacaoBonusIndicado: '3',
  indicacaoCampanha: JSON.stringify({ rotulo: 'Semana em dobro', multiplicador: 2, inicio: '2026-10-05', fim: '2026-10-11' }),
  indicacaoMetas: JSON.stringify([{ quantidade: 2, bonus: 10 }, { quantidade: 5, bonus: 25 }]),
}

function makeService(opts: {
  settings?: Record<string, string>
  user?: Record<string, unknown>
  deliveries?: number
  referrals?: Array<Record<string, unknown>>
  monthRows?: Array<{ quantityMilli: number }>
  earnedRows?: Array<{ quantityMilli: number }>
  milestones?: Array<{ threshold: number }>
  counts?: { total?: number; valeram?: number; emAndamento?: number }
} = {}) {
  const settings = opts.settings ?? ON
  const referralCount = vi.fn(async ({ where }: { where: { status?: unknown } }) => {
    if (where.status === 'REWARDED') return opts.counts?.valeram ?? 0
    if (where.status) return opts.counts?.emAndamento ?? 0
    return opts.counts?.total ?? 0
  })
  const prisma = {
    setting: {
      findMany: vi.fn(async ({ where }: { where: { key: { in: string[] } } }) =>
        Object.entries(settings).filter(([k]) => where.key.in.includes(k)).map(([key, value]) => ({ key, value })),
      ),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(opts.user ?? { name: 'João Martins', referralCode: null, referralCardDismissedAt: null }),
      findMany: vi.fn().mockResolvedValue([{ id: 'f1', name: 'Maria Souza' }, { id: 'f2', name: 'Pedro Alves' }]),
      update: vi.fn().mockResolvedValue({}),
    },
    referral: { count: referralCount, findMany: vi.fn().mockResolvedValue(opts.referrals ?? []) },
    order: { count: vi.fn().mockResolvedValue(opts.deliveries ?? 0) },
    marketOrder: { count: vi.fn().mockResolvedValue(0) },
    creditTransaction: {
      findMany: vi.fn(async ({ where }: { where: { createdAt?: unknown } }) =>
        where.createdAt ? (opts.monthRows ?? []) : (opts.earnedRows ?? []),
      ),
    },
    referralMilestone: { findMany: vi.fn().mockResolvedValue(opts.milestones ?? []) },
  }
  const fastify = { prisma, log: { warn: vi.fn(), error: vi.fn() } } as unknown as FastifyInstance
  return { service: new ReferralsService(fastify), prisma }
}

beforeEach(() => vi.mocked(ensureReferralCode).mockClear())

describe('ReferralsService.summary', () => {
  it('campanha aplicada, selo "novo" e bônus do mês', async () => {
    const { service } = makeService({ monthRows: [{ quantityMilli: 5000 }, { quantityMilli: 10_000 }], counts: { total: 2 } })
    const s = await service.summary('u1', NOW)
    expect(s).toMatchObject({
      active: true,
      hasReferrals: true,
      isNew: true,
      rewardBreads: 10,
      campaign: { label: 'Semana em dobro', until: '2026-10-11' },
      bonusThisMonth: 15,
      celebration: null,
    })
  })

  it('card da Home: só com ≥ 1 entrega recebida', async () => {
    expect((await makeService({ deliveries: 0 }).service.summary('u1', NOW)).homeCard.visible).toBe(false)
    expect((await makeService({ deliveries: 1 }).service.summary('u1', NOW)).homeCard.visible).toBe(true)
  })

  it('card da Home: fechado há menos de 30 dias some; há mais de 30, volta', async () => {
    const recent = { referralCode: 'X', referralCardDismissedAt: new Date(NOW.getTime() - 10 * DAY) }
    const old = { referralCode: 'X', referralCardDismissedAt: new Date(NOW.getTime() - 31 * DAY) }
    expect((await makeService({ deliveries: 3, user: recent }).service.summary('u1', NOW)).homeCard.visible).toBe(false)
    expect((await makeService({ deliveries: 3, user: old }).service.summary('u1', NOW)).homeCard.visible).toBe(true)
  })

  it('programa desligado: sem card; continua informando histórico', async () => {
    const { service, prisma } = makeService({ settings: { indicacaoAtiva: 'false' }, deliveries: 5, counts: { total: 1 } })
    const s = await service.summary('u1', NOW)
    expect(s).toMatchObject({ active: false, hasReferrals: true, homeCard: { visible: false } })
    expect(prisma.order.count).not.toHaveBeenCalled()
  })
})

describe('ReferralsService.me', () => {
  it('ativo: gera o código, valores, regras, metas e a lista com estado e data certos', async () => {
    const { service } = makeService({
      counts: { valeram: 2, emAndamento: 1 },
      earnedRows: [{ quantityMilli: 5000 }, { quantityMilli: 10_000 }, { quantityMilli: 10_000 }],
      milestones: [{ threshold: 2 }],
      referrals: [
        { id: 'r1', referredId: 'f1', status: 'REWARDED', verifiedAt: NOW, createdAt: new Date('2026-09-01T12:00:00Z'), rewardedAt: new Date('2026-09-12T12:00:00Z'), rewardMilli: 10_000, campaignMultiplier: 2 },
        { id: 'r2', referredId: 'f2', status: 'PENDING', verifiedAt: null, createdAt: new Date('2026-09-20T12:00:00Z'), rewardedAt: null, rewardMilli: 5000, campaignMultiplier: 1 },
      ],
    })
    const m = await service.me('u1', NOW)

    expect(ensureReferralCode).toHaveBeenCalledWith(expect.anything(), 'u1')
    expect(m).toMatchObject({
      state: 'active',
      code: 'JOAO7K2F',
      referrerFirstName: 'João',
      rewardBreads: 10,
      baseRewardBreads: 5,
      welcomeBreads: 3,
      campaign: { label: 'Semana em dobro', until: '2026-10-11' },
      rules: { prazoDias: 60, compraMinima: 0 },
      stats: { earnedBreads: 25, valeram: 2, emAndamento: 1 },
      goals: {
        count: 2,
        milestones: [
          { quantidade: 2, bonus: 10, reached: true, paid: true },
          { quantidade: 5, bonus: 25, reached: false, paid: false },
        ],
        justHit: { quantidade: 2, bonus: 10 },
        next: { quantidade: 5, bonus: 25 },
      },
    })
    expect(m.referrals).toEqual([
      { id: 'r1', name: 'Maria S.', state: 'ganhou', date: '2026-09-12T12:00:00.000Z', rewardBreads: 10, campaign: true },
      { id: 'r2', name: 'Pedro A.', state: 'cadastro', date: '2026-09-20T12:00:00.000Z', rewardBreads: null, campaign: false },
    ])
  })

  it('pausado: não gera código (só histórico)', async () => {
    const { service } = makeService({ settings: { indicacaoAtiva: 'false' } })
    const m = await service.me('u1', NOW)
    expect(m).toMatchObject({ state: 'paused', code: null })
    expect(ensureReferralCode).not.toHaveBeenCalled()
  })
})

describe('ReferralsService.dismissHomeCard', () => {
  it('grava no servidor (D-11)', async () => {
    const { service, prisma } = makeService()
    await service.dismissHomeCard('u1')
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { referralCardDismissedAt: expect.any(Date) } })
  })
})
