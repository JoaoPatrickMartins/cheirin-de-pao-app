// Indique e Ganhe — qualificação, sinais, recompensa, metas, convite, varredura e comemoração (Onda 4).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

const notifyUser = vi.fn().mockResolvedValue(undefined)
const notifyAdmins = vi.fn().mockResolvedValue(undefined)
vi.mock('../../modules/notifications/notifications.service.js', () => ({
  NotificationsService: vi.fn().mockImplementation(function () {
    return { notifyUser, notifyAdmins }
  }),
}))

import {
  afterDelivery,
  buildCelebration,
  grantMilestoneForReward,
  markCelebrationSeen,
  qualifyReferral,
  rewardReferral,
  sendReferralInvite,
  sweepReferrals,
} from '../referral.js'

type Doc = Record<string, unknown>

const NOW = new Date('2026-09-28T15:00:00.000Z') // meio-dia BRT
const DAY = 86_400_000

/** Casa um `where` simples do Prisma (igualdade, in, lt/gte, null, isSet, OR) contra um documento. */
function matches(doc: Doc, where: Doc = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return (cond as Doc[]).some((w) => matches(doc, w))
    const value = doc[key]
    if (cond === null) return value === null || value === undefined
    if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime()
    if (typeof cond === 'object') {
      const c = cond as Doc
      if ('isSet' in c) return c.isSet ? value !== undefined : value === undefined
      if ('in' in c) return (c.in as unknown[]).includes(value)
      if ('lt' in c) return (value as number | Date) < (c.lt as number | Date)
      if ('gte' in c) return (value as number | Date) >= (c.gte as number | Date)
      if ('gt' in c) return (value as number) > (c.gt as number)
      if ('not' in c) return value !== c.not
    }
    return value === cond
  })
}

/** Mundo em memória: o suficiente de Prisma para a regra da indicação. */
function makeWorld(init: {
  settings?: Record<string, string>
  users?: Doc[]
  referrals?: Doc[]
  orders?: Doc[]
  marketOrders?: Doc[]
  payments?: Doc[]
  sessions?: Doc[]
  milestones?: Doc[]
} = {}) {
  const settings = {
    indicacaoAtiva: 'true',
    indicacaoRecompensa: '5',
    indicacaoBonusIndicado: '3',
    indicacaoLimiteMensal: '10',
    indicacaoPrazoDias: '60',
    ...init.settings,
  }
  const users: Doc[] = init.users ?? [
    { id: 'ref1', name: 'João Martins', role: 'CLIENT', isBlocked: false, condominiumId: 'c1', block: 'A', apartment: '101', complement: null, creditMilli: 0 },
    { id: 'friend1', name: 'Maria Souza', role: 'CLIENT', isBlocked: false, condominiumId: 'c1', block: 'A', apartment: '202', complement: null, creditMilli: 0 },
  ]
  const referrals: Doc[] = init.referrals ?? [
    {
      id: 'r1', referrerId: 'ref1', referredId: 'friend1', status: 'PENDING', rewardMilli: 5000, welcomeMilli: 3000,
      campaignMultiplier: 1, campaignLabel: null, verifiedAt: NOW, expiresAt: new Date(NOW.getTime() + 30 * DAY),
      createdAt: new Date(NOW.getTime() - 5 * DAY), rewardedAt: null, rewardSeenAt: null, welcomeSeenAt: null, flags: [],
    },
  ]
  const orders: Doc[] = init.orders ?? [{ id: 'o1', userId: 'friend1', status: 'DELIVERED', deliveredAt: NOW, scheduledDate: NOW }]
  const marketOrders: Doc[] = init.marketOrders ?? []
  const payments: Doc[] = init.payments ?? [{ userId: 'friend1', status: 'PAID', amount: 12, purpose: null }]
  const sessions: Doc[] = init.sessions ?? [
    { userId: 'ref1', deviceId: 'dev-ref' },
    { userId: 'friend1', deviceId: 'dev-friend' },
  ]
  const milestones: Doc[] = init.milestones ?? []
  const credits: Doc[] = []

  const byId = (rows: Doc[], id: unknown) => rows.find((r) => r.id === id) ?? null
  const updateMany = (rows: Doc[]) =>
    vi.fn(async ({ where, data }: { where: Doc; data: Doc }) => {
      const hit = rows.filter((r) => matches(r, where))
      for (const r of hit) Object.assign(r, data)
      return { count: hit.length }
    })

  const prisma: Record<string, unknown> = {
    setting: {
      findMany: vi.fn(async ({ where }: { where: { key: { in: string[] } } }) =>
        Object.entries(settings).filter(([k]) => where.key.in.includes(k)).map(([key, value]) => ({ key, value })),
      ),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: Doc }) => byId(users, where.id)),
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => users.filter((u) => where.id.in.includes(u.id as string))),
      update: vi.fn(async ({ where, data }: { where: Doc; data: { creditMilli?: { increment: number } } }) => {
        const u = byId(users, where.id)!
        if (data.creditMilli) u.creditMilli = (u.creditMilli as number) + data.creditMilli.increment
        return u
      }),
      updateMany: updateMany(users),
    },
    referral: {
      findUnique: vi.fn(async ({ where }: { where: Doc }) =>
        where.id ? byId(referrals, where.id) : (referrals.find((r) => r.referredId === where.referredId) ?? null),
      ),
      findFirst: vi.fn(async ({ where }: { where: Doc }) => referrals.find((r) => matches(r, where)) ?? null),
      findMany: vi.fn(async ({ where }: { where: Doc }) => referrals.filter((r) => matches(r, where))),
      count: vi.fn(async ({ where }: { where: Doc }) => referrals.filter((r) => matches(r, where)).length),
      updateMany: updateMany(referrals),
    },
    order: { findMany: vi.fn(async ({ where }: { where: Doc }) => orders.filter((o) => matches(o, where))) },
    marketOrder: { findMany: vi.fn(async ({ where }: { where: Doc }) => marketOrders.filter((o) => matches(o, where))) },
    payment: { findMany: vi.fn(async ({ where }: { where: Doc }) => payments.filter((p) => matches(p, where))) },
    session: {
      findMany: vi.fn(async ({ where }: { where: Doc }) => sessions.filter((s) => matches(s, where))),
      count: vi.fn(async ({ where }: { where: Doc }) => sessions.filter((s) => matches(s, where)).length),
    },
    creditTransaction: { create: vi.fn(async ({ data }: { data: Doc }) => (credits.push(data), data)) },
    referralMilestone: {
      create: vi.fn(async ({ data }: { data: Doc }) => {
        if (milestones.some((m) => m.referrerId === data.referrerId && m.threshold === data.threshold)) {
          throw { code: 'P2002' }
        }
        const doc = { id: `ms${milestones.length + 1}`, ...data }
        milestones.push(doc)
        return doc
      }),
      findMany: vi.fn(async ({ where }: { where: Doc }) =>
        milestones.filter((m) => matches(m, where)).sort((a, b) => (a.threshold as number) - (b.threshold as number)),
      ),
      updateMany: updateMany(milestones),
    },
  }
  const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma))
  prisma.$transaction = transaction

  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
  const fastify = { prisma, log } as unknown as FastifyInstance
  const user = (id: string) => byId(users, id)!
  return { fastify, prisma, log, transaction, users, referrals, credits, milestones, user, settings, orders, payments, sessions }
}

beforeEach(() => {
  notifyUser.mockClear()
  notifyAdmins.mockClear()
})

describe('qualifyReferral — §4.3', () => {
  it('entregue + pagou + sem sinal → REWARDED: X para quem indicou, Y para o amigo, no mesmo evento', async () => {
    const w = makeWorld()
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('REWARDED')

    expect(w.referrals[0]).toMatchObject({ status: 'REWARDED', qualifyingOrderId: 'o1', qualifyingKind: 'ORDER' })
    expect(w.user('ref1').creditMilli).toBe(5000)
    expect(w.user('friend1').creditMilli).toBe(3000)
    expect(w.credits).toEqual([
      expect.objectContaining({ userId: 'ref1', type: 'REFERRAL_BONUS', quantityMilli: 5000, referenceId: 'r1', description: 'Maria S. recebeu o 1º pedido' }),
      expect.objectContaining({ userId: 'friend1', type: 'REFERRAL_WELCOME', quantityMilli: 3000, referenceId: 'r1', description: 'Você veio pela indicação de João M.' }),
    ])
    // Avisos: quem indicou, o amigo e os admins
    const types = [...notifyUser.mock.calls.map((c) => c[1].type), ...notifyAdmins.mock.calls.map((c) => c[0].type)]
    expect(types.sort()).toEqual(['ADMIN_REFERRAL_REWARDED', 'REFERRAL_REWARD', 'REFERRAL_WELCOME'])
    const reward = notifyUser.mock.calls.find((c) => c[1].type === 'REFERRAL_REWARD')!
    expect(reward[0]).toBe('ref1')
    expect(reward[1]).toMatchObject({ title: 'Você ganhou 5 pãezins!', actionRoute: '/client/creditos/extrato' })
  })

  it('Cestinha entregue também qualifica (D-1)', async () => {
    const w = makeWorld({ orders: [], marketOrders: [{ id: 'm1', userId: 'friend1', status: 'DELIVERED', deliveredAt: NOW, scheduledDate: NOW }] })
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('REWARDED')
    expect(w.referrals[0]).toMatchObject({ qualifyingOrderId: 'm1', qualifyingKind: 'MARKET' })
  })

  it('sem entrega, sem pagamento, só gancho ou abaixo do mínimo → continua PENDING, nada creditado', async () => {
    const casos = [
      makeWorld({ orders: [] }),
      makeWorld({ payments: [] }),
      makeWorld({ payments: [{ userId: 'friend1', status: 'PAID', amount: 5, purpose: 'HOOK' }] }),
      makeWorld({ payments: [{ userId: 'friend1', status: 'PENDING', amount: 30, purpose: null }] }),
      makeWorld({ settings: { indicacaoCompraMinima: '20' } }), // pagou 12
    ]
    for (const w of casos) {
      await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('PENDING')
      expect(w.referrals[0].status).toBe('PENDING')
      expect(w.credits).toHaveLength(0)
    }
  })

  it('pagamento da Cestinha (MARKET) conta como dinheiro real', async () => {
    const w = makeWorld({ payments: [{ userId: 'friend1', status: 'PAID', amount: 18, purpose: 'MARKET' }] })
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('REWARDED')
  })

  it('vencida sem entrega → EXPIRED', async () => {
    const w = makeWorld({ orders: [] })
    w.referrals[0].expiresAt = new Date(NOW.getTime() - DAY)
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('EXPIRED')
    expect(w.referrals[0].status).toBe('EXPIRED')
  })

  it('entrega DEPOIS do prazo não vale → EXPIRED', async () => {
    const w = makeWorld()
    w.referrals[0].expiresAt = new Date(NOW.getTime() - DAY)
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('EXPIRED')
  })

  it('entrega DENTRO do prazo, avaliada depois dele (varredura) → paga (a promessa vale)', async () => {
    const delivered = new Date(NOW.getTime() - 3 * DAY)
    const w = makeWorld({ orders: [{ id: 'o1', userId: 'friend1', status: 'DELIVERED', deliveredAt: delivered, scheduledDate: delivered }] })
    w.referrals[0].expiresAt = new Date(NOW.getTime() - DAY)
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('REWARDED')
  })

  it('pedido antigo sem deliveredAt usa o scheduledDate', async () => {
    const w = makeWorld({ orders: [{ id: 'o1', userId: 'friend1', status: 'DELIVERED', scheduledDate: NOW }] })
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('REWARDED')
  })

  it('sem indicação, ou já terminal → NONE (uma consulta só no caminho quente)', async () => {
    const w = makeWorld({ referrals: [] })
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('NONE')
    expect((w.prisma.setting as { findMany: ReturnType<typeof vi.fn> }).findMany).not.toHaveBeenCalled()

    const done = makeWorld()
    done.referrals[0].status = 'REWARDED'
    await expect(qualifyReferral(done.fastify, 'friend1', NOW)).resolves.toBe('NONE')
    expect(done.credits).toHaveLength(0)
  })
})

describe('sinais de análise — §4.4', () => {
  async function expectHold(w: ReturnType<typeof makeWorld>, flags: string[]) {
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('ON_HOLD')
    expect(w.referrals[0]).toMatchObject({ status: 'ON_HOLD', flags, qualifyingOrderId: 'o1' })
    expect(w.credits).toHaveLength(0)
    expect(notifyAdmins).toHaveBeenCalledOnce()
    expect(notifyAdmins.mock.calls[0][0]).toMatchObject({ type: 'ADMIN_REFERRAL_REVIEW', title: 'Indicação para analisar' })
  }

  it('mesmo apartamento (normalizado: espaço e caixa) → ON_HOLD', async () => {
    const w = makeWorld()
    Object.assign(w.user('friend1'), { block: ' a ', apartment: '1 01' })
    await expectHold(w, ['SAME_ADDRESS'])
    expect(notifyAdmins.mock.calls[0][0].body).toBe('João → Maria: mesmo apartamento.')
  })

  it('complemento diferente não é o mesmo apartamento', async () => {
    const w = makeWorld()
    Object.assign(w.user('ref1'), { complement: 'Lado A' })
    Object.assign(w.user('friend1'), { apartment: '101', complement: 'Lado B' })
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('REWARDED')
  })

  it('mesmo condomínio em outro apartamento → paga (é bom para a rota)', async () => {
    const w = makeWorld() // c1, 101 × 202
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('REWARDED')
  })

  it('mesmo aparelho → ON_HOLD', async () => {
    const w = makeWorld({ sessions: [{ userId: 'ref1', deviceId: 'dev-x' }, { userId: 'friend1', deviceId: 'dev-x' }] })
    await expectHold(w, ['SAME_DEVICE'])
  })

  it('limite do mês → ON_HOLD (não nega)', async () => {
    const w = makeWorld({ settings: { indicacaoLimiteMensal: '1' } })
    w.referrals.push({ id: 'r0', referrerId: 'ref1', referredId: 'x', status: 'REWARDED', rewardedAt: new Date(NOW.getTime() - DAY) })
    await expectHold(w, ['OVER_LIMIT'])
  })

  it('recompensa do mês passado não conta no limite', async () => {
    const w = makeWorld({ settings: { indicacaoLimiteMensal: '1' } })
    w.referrals.push({ id: 'r0', referrerId: 'ref1', referredId: 'x', status: 'REWARDED', rewardedAt: new Date('2026-08-20T15:00:00Z') })
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('REWARDED')
  })

  it('limite 0 = sem limite', async () => {
    const w = makeWorld({ settings: { indicacaoLimiteMensal: '0' } })
    for (let i = 0; i < 30; i++) {
      w.referrals.push({ id: `m${i}`, referrerId: 'ref1', referredId: `x${i}`, status: 'REWARDED', rewardedAt: new Date(NOW.getTime() - 3_600_000) })
    }
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('REWARDED')
  })

  it('indicador bloqueado → ON_HOLD', async () => {
    const w = makeWorld()
    w.user('ref1').isBlocked = true
    await expectHold(w, ['REFERRER_BLOCKED'])
  })
})

describe('rewardReferral — trava e valores congelados', () => {
  it('corrida de duas entregas → UMA recompensa', async () => {
    const w = makeWorld()
    const [a, b] = await Promise.all([qualifyReferral(w.fastify, 'friend1', NOW), qualifyReferral(w.fastify, 'friend1', NOW)])
    expect([a, b].filter((o) => o === 'REWARDED')).toHaveLength(1)
    expect(w.credits.filter((c) => c.type === 'REFERRAL_BONUS')).toHaveLength(1)
    expect(w.user('ref1').creditMilli).toBe(5000)
  })

  it('P2034 → repete a transação e paga uma vez', async () => {
    const w = makeWorld()
    w.transaction.mockRejectedValueOnce({ code: 'P2034' })
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('REWARDED')
    expect(w.transaction).toHaveBeenCalledTimes(2)
    expect(w.credits.filter((c) => c.type === 'REFERRAL_BONUS')).toHaveLength(1)
  })

  it('bônus do amigo 0 → só quem indica ganha e é avisado', async () => {
    const w = makeWorld()
    w.referrals[0].welcomeMilli = 0
    await qualifyReferral(w.fastify, 'friend1', NOW)
    expect(w.credits.map((c) => c.type)).toEqual(['REFERRAL_BONUS'])
    expect(w.user('friend1').creditMilli).toBe(0)
    expect(notifyUser.mock.calls.map((c) => c[1].type)).toEqual(['REFERRAL_REWARD'])
  })

  it('paga o valor CONGELADO na indicação (campanha), não o da config de agora', async () => {
    const w = makeWorld({ settings: { indicacaoRecompensa: '8', indicacaoBonusIndicado: '1' } })
    Object.assign(w.referrals[0], { rewardMilli: 10_000, campaignMultiplier: 2, campaignLabel: 'Semana em dobro' })
    await qualifyReferral(w.fastify, 'friend1', NOW)
    expect(w.user('ref1').creditMilli).toBe(10_000)
    expect(w.user('friend1').creditMilli).toBe(3000)
  })

  it('aprovação do admin: ON_HOLD → REWARDED com revisor', async () => {
    const w = makeWorld()
    w.referrals[0].status = 'ON_HOLD'
    await expect(rewardReferral(w.fastify, 'r1', 'ON_HOLD', { reviewerId: 'admin1', now: NOW })).resolves.toBe(true)
    expect(w.referrals[0]).toMatchObject({ status: 'REWARDED', reviewedById: 'admin1', reviewedAt: NOW })
    // de novo: já não está em ON_HOLD
    await expect(rewardReferral(w.fastify, 'r1', 'ON_HOLD', { reviewerId: 'admin1' })).resolves.toBe(false)
    expect(w.credits.filter((c) => c.type === 'REFERRAL_BONUS')).toHaveLength(1)
  })

  it('aviso que falha não desfaz nem derruba a recompensa', async () => {
    const w = makeWorld()
    notifyUser.mockRejectedValueOnce(new Error('push fora'))
    await expect(qualifyReferral(w.fastify, 'friend1', NOW)).resolves.toBe('REWARDED')
    expect(w.user('ref1').creditMilli).toBe(5000)
  })
})

describe('metas — grantMilestoneForReward', () => {
  const metas = JSON.stringify([{ quantidade: 1, bonus: 10 }, { quantidade: 3, bonus: 25 }])

  it('cruzou a meta → REFERRAL_GOAL, uma vez (P2002 na segunda)', async () => {
    const w = makeWorld({ settings: { indicacaoMetas: metas } })
    await qualifyReferral(w.fastify, 'friend1', NOW) // 1ª que valeu
    expect(w.milestones).toEqual([expect.objectContaining({ referrerId: 'ref1', threshold: 1, bonusMilli: 10_000 })])
    expect(w.credits.find((c) => c.type === 'REFERRAL_GOAL')).toMatchObject({
      userId: 'ref1', quantityMilli: 10_000, referenceId: 'ms1', description: 'Bônus pela 1ª indicação que valeu',
    })
    expect(w.user('ref1').creditMilli).toBe(15_000)

    // repetir o marco (outra chamada) não paga de novo
    await expect(grantMilestoneForReward(w.fastify, { id: 'r1', referrerId: 'ref1', rewardedAt: NOW })).resolves.toBe(false)
    expect(w.credits.filter((c) => c.type === 'REFERRAL_GOAL')).toHaveLength(1)
  })

  it('a posição é pela ordem de recompensa: a 2ª não paga a meta da 1ª nem a da 3ª', async () => {
    const w = makeWorld({ settings: { indicacaoMetas: metas } })
    w.referrals.push({ id: 'r0', referrerId: 'ref1', referredId: 'x', status: 'REWARDED', rewardedAt: new Date(NOW.getTime() - DAY) })
    await qualifyReferral(w.fastify, 'friend1', NOW) // esta é a 2ª
    expect(w.milestones).toHaveLength(0)
  })

  it('não é retroativa: meta criada depois de passar dela não paga', async () => {
    const w = makeWorld({ settings: { indicacaoMetas: JSON.stringify([{ quantidade: 2, bonus: 10 }]) } })
    for (let i = 0; i < 4; i++) {
      w.referrals.push({ id: `old${i}`, referrerId: 'ref1', referredId: `x${i}`, status: 'REWARDED', rewardedAt: new Date(NOW.getTime() - (i + 1) * DAY) })
    }
    await qualifyReferral(w.fastify, 'friend1', NOW) // 5ª
    expect(w.milestones).toHaveLength(0)
  })

  it('duas recompensas juntas viram 1ª e 2ª (desempate pelo rewardedAt), sem perder a meta', async () => {
    const w = makeWorld({ settings: { indicacaoMetas: JSON.stringify([{ quantidade: 2, bonus: 10 }]) } })
    w.referrals.push({ id: 'r2', referrerId: 'ref1', referredId: 'y', status: 'REWARDED', rewardedAt: new Date(NOW.getTime() - 1000) })
    await grantMilestoneForReward(w.fastify, { id: 'r2', referrerId: 'ref1', rewardedAt: new Date(NOW.getTime() - 1000) })
    expect(w.milestones).toHaveLength(0) // r2 é a 1ª
    w.referrals[0].status = 'REWARDED'
    w.referrals[0].rewardedAt = NOW
    await grantMilestoneForReward(w.fastify, { id: 'r1', referrerId: 'ref1', rewardedAt: NOW })
    expect(w.milestones).toHaveLength(1) // r1 é a 2ª
  })
})

describe('convite pós-entrega — sendReferralInvite', () => {
  it('uma vez na vida, com o programa ligado', async () => {
    const w = makeWorld()
    await expect(sendReferralInvite(w.fastify, 'ref1', NOW)).resolves.toBe(true)
    expect(notifyUser).toHaveBeenCalledWith('ref1', expect.objectContaining({
      type: 'REFERRAL_INVITE',
      title: 'Gostou do pãozin?',
      body: 'Indique um vizinho: quando ele receber o 1º pedido, você ganha 5 pãezins.',
      actionRoute: '/client/perfil/indique',
    }))
    expect(w.user('ref1').referralInviteAt).toEqual(NOW)

    notifyUser.mockClear()
    await expect(sendReferralInvite(w.fastify, 'ref1', NOW)).resolves.toBe(false)
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('programa desligado não convida nem gasta o convite', async () => {
    const w = makeWorld({ settings: { indicacaoAtiva: 'false' } })
    await expect(sendReferralInvite(w.fastify, 'ref1', NOW)).resolves.toBe(false)
    expect(w.user('ref1').referralInviteAt).toBeUndefined()
  })

  it('entregador/admin não recebem', async () => {
    const w = makeWorld()
    w.user('ref1').role = 'COURIER'
    await expect(sendReferralInvite(w.fastify, 'ref1', NOW)).resolves.toBe(false)
  })
})

describe('afterDelivery e varredura', () => {
  it('afterDelivery nunca lança', async () => {
    const w = makeWorld()
    ;(w.prisma.referral as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockRejectedValueOnce(new Error('Atlas fora'))
    ;(w.prisma.user as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockRejectedValueOnce(new Error('Atlas fora'))
    await expect(afterDelivery(w.fastify, 'friend1')).resolves.toBeUndefined()
    expect(w.log.warn).toHaveBeenCalledTimes(2)
  })

  it('afterDelivery avalia a indicação e manda o convite', async () => {
    const w = makeWorld()
    await afterDelivery(w.fastify, 'friend1')
    expect(w.referrals[0].status).toBe('REWARDED')
    expect(notifyUser.mock.calls.map((c) => c[1].type)).toContain('REFERRAL_INVITE')
  })

  it('sweepReferrals reavalia toda PENDING e conta os desfechos', async () => {
    const w = makeWorld()
    w.users.push({ id: 'friend2', name: 'Pedro Alves', role: 'CLIENT', isBlocked: false, condominiumId: 'c2', block: null, apartment: '1', complement: null, creditMilli: 0 })
    w.referrals.push({ id: 'r2', referrerId: 'ref1', referredId: 'friend2', status: 'PENDING', rewardMilli: 5000, welcomeMilli: 0, verifiedAt: NOW, expiresAt: new Date(NOW.getTime() - DAY), flags: [] })
    const counts = await sweepReferrals(w.fastify, NOW)
    expect(counts).toMatchObject({ REWARDED: 1, EXPIRED: 1 })
    expect(w.referrals.find((r) => r.id === 'r2')!.status).toBe('EXPIRED')
  })
})

describe('comemoração — buildCelebration', () => {
  function rewarded(w: ReturnType<typeof makeWorld>, id: string, referredId: string, name: string, at: number) {
    w.users.push({ id: referredId, name, role: 'CLIENT' })
    w.referrals.push({ id, referrerId: 'ref1', referredId, status: 'REWARDED', rewardMilli: 5000, welcomeMilli: 0, rewardedAt: new Date(at), rewardSeenAt: null, welcomeSeenAt: null })
  }

  it('nada pendente → null', async () => {
    await expect(buildCelebration(makeWorld().fastify, 'ref1')).resolves.toBeNull()
  })

  it('uma recompensa → referrer; duas ou mais → multi com a soma e os nomes', async () => {
    const w = makeWorld({ referrals: [] })
    rewarded(w, 'a', 'u-a', 'Maria Souza', 1)
    const one = await buildCelebration(w.fastify, 'ref1')
    expect(one).toMatchObject({ variant: 'referrer', breads: 5, names: ['Maria'], seen: { referralIds: ['a'] } })

    rewarded(w, 'b', 'u-b', 'Pedro Alves', 2)
    const multi = await buildCelebration(w.fastify, 'ref1')
    expect(multi).toMatchObject({ variant: 'multi', breads: 10, names: ['Maria', 'Pedro'], seen: { referralIds: ['a', 'b'] } })
  })

  it('prioridade: friend → goal → multi/referrer', async () => {
    const w = makeWorld({ referrals: [], settings: { indicacaoMetas: JSON.stringify([{ quantidade: 5, bonus: 10 }, { quantidade: 10, bonus: 25 }]) } })
    rewarded(w, 'a', 'u-a', 'Maria Souza', 1)
    w.milestones.push({ id: 'ms1', referrerId: 'ref1', threshold: 5, bonusMilli: 10_000, seenAt: null })
    // ref1 também veio por indicação de alguém e ganhou boas-vindas
    w.users.push({ id: 'avo', name: 'Ana Lima', role: 'CLIENT' })
    w.referrals.push({ id: 'w', referrerId: 'avo', referredId: 'ref1', status: 'REWARDED', rewardMilli: 5000, welcomeMilli: 3000, welcomeSeenAt: null })

    const c1 = await buildCelebration(w.fastify, 'ref1')
    expect(c1).toMatchObject({ variant: 'friend', breads: 3, referrerName: 'Ana', seen: { welcome: true } })
    await markCelebrationSeen(w.prisma as never, 'ref1', c1!.seen, NOW)

    const c2 = await buildCelebration(w.fastify, 'ref1')
    expect(c2).toMatchObject({ variant: 'goal', breads: 10, goal: { threshold: 5, bonus: 10, next: { threshold: 10, bonus: 25 } } })
    await markCelebrationSeen(w.prisma as never, 'ref1', c2!.seen, NOW)

    const c3 = await buildCelebration(w.fastify, 'ref1')
    expect(c3).toMatchObject({ variant: 'referrer' })
    await markCelebrationSeen(w.prisma as never, 'ref1', c3!.seen, NOW)

    await expect(buildCelebration(w.fastify, 'ref1')).resolves.toBeNull()
  })

  it('markCelebrationSeen só marca o que é do próprio usuário', async () => {
    const w = makeWorld({ referrals: [] })
    rewarded(w, 'a', 'u-a', 'Maria Souza', 1)
    await markCelebrationSeen(w.prisma as never, 'intruso', { referralIds: ['a'] }, NOW)
    expect(w.referrals[0].rewardSeenAt).toBeNull()
  })
})
