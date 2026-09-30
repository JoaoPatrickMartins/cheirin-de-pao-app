import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

/**
 * Admin do Indique e Ganhe: quem pode o quê (aprovar e recusar só em análise, vínculo manual uma
 * vez só) e a montagem das respostas do A4/A5. A regra de pagar (`rewardReferral`) e a de avaliar
 * (`qualifyReferral`) têm testes próprios — aqui são mockadas; o resto de `lib/referral` é real.
 */

const rewardReferral = vi.fn()
const qualifyReferral = vi.fn()
vi.mock('../../../lib/referral.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/referral.js')>()),
  rewardReferral: (...args: unknown[]) => rewardReferral(...args),
  qualifyReferral: (...args: unknown[]) => qualifyReferral(...args),
}))
const ensureReferralCode = vi.fn()
vi.mock('../../../lib/referral-code.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/referral-code.js')>()),
  ensureReferralCode: (...args: unknown[]) => ensureReferralCode(...args),
}))

import { AdminReferralsService, REFERRALS_PAGE_SIZE } from '../admin-referrals.service.js'

const ID = (n: number) => n.toString(16).padStart(24, '0')
const REF = ID(1)
const JOAO = ID(10)
const MARIA = ID(11)
const CONDO = ID(20)

type User = { id: string; name: string; role?: string; isBlocked?: boolean; condominiumId?: string | null; referralCode?: string }

function makePrisma(opts: { users?: User[]; active?: boolean } = {}) {
  const users: User[] = opts.users ?? [
    { id: JOAO, name: 'João Silva', role: 'CLIENT', isBlocked: false, condominiumId: CONDO, referralCode: 'JOAO7K2F' },
    { id: MARIA, name: 'Maria Souza', role: 'CLIENT', isBlocked: false, condominiumId: CONDO, referralCode: 'MARI4P9Q' },
  ]
  const byId = (id: string) => users.find((u) => u.id === id) ?? null
  return {
    setting: {
      findMany: vi.fn().mockResolvedValue([{ key: 'indicacaoAtiva', value: String(opts.active ?? true) }]),
    },
    user: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => Promise.resolve(byId(where.id))),
      findFirst: vi.fn(({ where }: { where: { referralCode: string } }) =>
        Promise.resolve(users.find((u) => u.referralCode === where.referralCode) ?? null),
      ),
      findMany: vi.fn(({ where }: { where: { id?: { in: string[] }; name?: { contains: string } } }) => {
        if (where.id) return Promise.resolve(users.filter((u) => where.id!.in.includes(u.id)))
        const term = where.name!.contains.toLowerCase()
        return Promise.resolve(users.filter((u) => u.name.toLowerCase().includes(term)))
      }),
    },
    condominium: {
      findMany: vi.fn().mockResolvedValue([{ id: CONDO, name: 'Parque das Flores' }]),
    },
    referral: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: REF }),
    },
    payment: { findMany: vi.fn().mockResolvedValue([]) },
    order: { findFirst: vi.fn().mockResolvedValue(null) },
    marketOrder: { findFirst: vi.fn().mockResolvedValue(null) },
    creditTransaction: { findMany: vi.fn().mockResolvedValue([]) },
  }
}

function makeService(prisma = makePrisma()) {
  const fastify = { prisma, log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } } as unknown as FastifyInstance
  return { service: new AdminReferralsService(fastify), prisma, fastify }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdminReferralsService.list', () => {
  it('"Em análise" é uma fila: ON_HOLD, da mais antiga; nomes, condomínio do amigo e sinais em rótulo', async () => {
    const prisma = makePrisma()
    prisma.referral.findMany.mockResolvedValue([
      {
        id: REF,
        referrerId: JOAO,
        referredId: MARIA,
        status: 'ON_HOLD',
        verifiedAt: new Date('2026-09-18T12:20:00Z'),
        createdAt: new Date('2026-09-18T12:12:00Z'),
        flags: ['SAME_ADDRESS', 'OVER_LIMIT'],
      },
    ])
    prisma.referral.count.mockImplementation(({ where }: { where: { status?: string } }) =>
      Promise.resolve({ ON_HOLD: 3, PENDING: 9, REWARDED: 17, REJECTED: 2, EXPIRED: 3 }[where.status ?? ''] ?? 1),
    )
    const { service } = makeService(prisma)

    const res = await service.list({ state: 'analise', page: 1 })

    expect(prisma.referral.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ON_HOLD' }, orderBy: { createdAt: 'asc' }, skip: 0, take: REFERRALS_PAGE_SIZE }),
    )
    expect(res.items).toEqual([
      {
        id: REF,
        state: 'analise',
        referrer: { id: JOAO, name: 'João Silva' },
        referred: { id: MARIA, name: 'Maria Souza' },
        createdAt: '2026-09-18T12:12:00.000Z',
        condo: 'Parque das Flores',
        signals: ['Mesmo apartamento', 'Limite do mês'],
      },
    ])
    expect(res.counts).toEqual({ analise: 3, aguardando: 9, ganhou: 17, recusada: 2, expirou: 3, todas: 34 })
  })

  it('"Aguardando" pega os dois PENDING (cadastro e aguardando), da mais recente; página 2 pula 20', async () => {
    const { service, prisma } = makeService()
    await service.list({ state: 'aguardando', page: 2 })
    expect(prisma.referral.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, skip: REFERRALS_PAGE_SIZE }),
    )
  })

  it('busca pelo nome de qualquer uma das duas pessoas', async () => {
    const { service, prisma } = makeService()
    await service.list({ state: 'todas', q: 'maria', page: 1 })
    expect(prisma.referral.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ referrerId: { in: [MARIA] } }, { referredId: { in: [MARIA] } }] } }),
    )
  })

  it('busca sem ninguém com o nome → lista vazia sem consultar indicações', async () => {
    const { service, prisma } = makeService()
    const res = await service.list({ state: 'todas', q: 'zzz', page: 1 })
    expect(res.items).toEqual([])
    expect(res.total).toBe(0)
    expect(prisma.referral.findMany).not.toHaveBeenCalled()
  })
})

describe('AdminReferralsService.detail', () => {
  it('valores congelados + linha do tempo: 1º pagamento sem gancho e a entrega mais antiga (pão ou Cestinha)', async () => {
    const prisma = makePrisma()
    prisma.referral.findUnique.mockResolvedValue({
      id: REF,
      referrerId: JOAO,
      referredId: MARIA,
      code: 'JOAO7K2F',
      source: 'LINK',
      status: 'ON_HOLD',
      rewardMilli: 10_000,
      welcomeMilli: 3_000,
      campaignLabel: 'Semana em dobro',
      flags: ['SAME_DEVICE'],
      createdAt: new Date('2026-09-18T12:12:00Z'),
      verifiedAt: new Date('2026-09-18T12:20:00Z'),
      rewardedAt: null,
      reviewedAt: null,
      rejectReason: null,
      rejectDetail: null,
      expiresAt: new Date('2026-11-17T12:12:00Z'),
    })
    prisma.payment.findMany.mockResolvedValue([
      { createdAt: new Date('2026-09-18T13:00:00Z'), purpose: 'HOOK', amount: 5 },
      { createdAt: new Date('2026-09-19T21:40:00Z'), purpose: null, amount: 30 },
    ])
    prisma.order.findFirst.mockResolvedValue({ deliveredAt: null, scheduledDate: new Date('2026-09-21T09:00:00Z') })
    prisma.marketOrder.findFirst.mockResolvedValue({ deliveredAt: new Date('2026-09-20T09:31:00Z'), scheduledDate: new Date('2026-09-20T09:00:00Z') })
    const { service } = makeService(prisma)

    const d = await service.detail(REF)

    expect(d).toMatchObject({
      state: 'analise',
      referrer: { id: JOAO, name: 'João Silva' },
      referred: { id: MARIA, name: 'Maria Souza' },
      condo: 'Parque das Flores',
      signals: ['Mesmo aparelho'],
      rewardBreads: 10,
      welcomeBreads: 3,
      campaignLabel: 'Semana em dobro',
      timeline: {
        cadastro: '2026-09-18T12:12:00.000Z',
        login: '2026-09-18T12:20:00.000Z',
        pagamento: '2026-09-19T21:40:00.000Z',
        entrega: '2026-09-20T09:31:00.000Z',
        recompensa: null,
      },
    })
  })

  it('id que não é ObjectId → null sem consultar', async () => {
    const { service, prisma } = makeService()
    expect(await service.detail('abc')).toBeNull()
    expect(prisma.referral.findUnique).not.toHaveBeenCalled()
  })
})

describe('AdminReferralsService.approve (D-12)', () => {
  it('em análise → paga pelo caminho da recompensa, com quem aprovou', async () => {
    const prisma = makePrisma()
    prisma.referral.findUnique.mockResolvedValue({ status: 'ON_HOLD' })
    rewardReferral.mockResolvedValue(true)
    const { service, fastify } = makeService(prisma)
    await service.approve(REF, 'admin1')
    expect(rewardReferral).toHaveBeenCalledWith(fastify, REF, 'ON_HOLD', { reviewerId: 'admin1' })
  })

  it('aguardando não é aprovável (409) e nada é pago', async () => {
    const prisma = makePrisma()
    prisma.referral.findUnique.mockResolvedValue({ status: 'PENDING' })
    const { service } = makeService(prisma)
    await expect(service.approve(REF, 'admin1')).rejects.toMatchObject({ statusCode: 409 })
    expect(rewardReferral).not.toHaveBeenCalled()
  })

  it('outro admin decidiu no mesmo instante (a trava não casou) → 409', async () => {
    const prisma = makePrisma()
    prisma.referral.findUnique.mockResolvedValue({ status: 'ON_HOLD' })
    rewardReferral.mockResolvedValue(false)
    const { service } = makeService(prisma)
    await expect(service.approve(REF, 'admin1')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('inexistente → 404', async () => {
    const prisma = makePrisma()
    prisma.referral.findUnique.mockResolvedValue(null)
    const { service } = makeService(prisma)
    await expect(service.approve(REF, 'admin1')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('AdminReferralsService.reject (D-12)', () => {
  it('em análise → REJECTED com motivo, detalhe e quem recusou, travado por status', async () => {
    const prisma = makePrisma()
    prisma.referral.findUnique.mockResolvedValue({ status: 'ON_HOLD' })
    const { service } = makeService(prisma)
    await service.reject(REF, { reason: 'SAME_RESIDENCE', detail: 'Mesmo apartamento do indicador (Bl. B 42).' }, 'admin1')
    expect(prisma.referral.updateMany).toHaveBeenCalledWith({
      where: { id: REF, status: 'ON_HOLD' },
      data: expect.objectContaining({
        status: 'REJECTED',
        rejectReason: 'SAME_RESIDENCE',
        rejectDetail: 'Mesmo apartamento do indicador (Bl. B 42).',
        reviewedById: 'admin1',
        reviewedAt: expect.any(Date),
      }),
    })
  })

  it('aguardando não é recusável (409)', async () => {
    const prisma = makePrisma()
    prisma.referral.findUnique.mockResolvedValue({ status: 'PENDING' })
    const { service } = makeService(prisma)
    await expect(service.reject(REF, { reason: 'OTHER', detail: 'Teste' }, 'admin1')).rejects.toMatchObject({ statusCode: 409 })
    expect(prisma.referral.updateMany).not.toHaveBeenCalled()
  })

  it('já aprovada no mesmo instante (a trava não casou) → 409', async () => {
    const prisma = makePrisma()
    prisma.referral.findUnique.mockResolvedValue({ status: 'ON_HOLD' })
    prisma.referral.updateMany.mockResolvedValue({ count: 0 })
    const { service } = makeService(prisma)
    await expect(service.reject(REF, { reason: 'OTHER', detail: 'Teste' }, 'admin1')).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('AdminReferralsService — detalhe do cliente (A5)', () => {
  it('código (gerado se preciso), quem indicou, fez/valeram/ganhos (indicações + metas) e a lista', async () => {
    const prisma = makePrisma()
    ensureReferralCode.mockResolvedValue('MARI4P9Q')
    prisma.referral.findUnique.mockResolvedValue({ referrerId: JOAO, status: 'REWARDED', verifiedAt: new Date() })
    prisma.referral.findMany.mockResolvedValue([
      { id: ID(2), referredId: JOAO, status: 'PENDING', verifiedAt: null, createdAt: new Date('2026-09-26T19:02:00Z') },
    ])
    prisma.referral.count.mockImplementation(({ where }: { where: { status?: string } }) => Promise.resolve(where.status ? 1 : 4))
    prisma.creditTransaction.findMany.mockResolvedValue([{ quantityMilli: 5_000 }, { quantityMilli: 10_000 }])
    const { service } = makeService(prisma)

    const res = await service.clientReferrals(MARIA)

    expect(ensureReferralCode).toHaveBeenCalledWith(prisma, MARIA)
    expect(prisma.creditTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: MARIA, type: { in: ['REFERRAL_BONUS', 'REFERRAL_GOAL'] } } }),
    )
    expect(res).toEqual({
      active: true,
      code: 'MARI4P9Q',
      referredBy: { id: JOAO, name: 'João Silva', state: 'ganhou' },
      stats: { fez: 4, valeram: 1, earnedBreads: 15 },
      referrals: [{ id: ID(2), name: 'João Silva', createdAt: '2026-09-26T19:02:00.000Z', state: 'cadastro' }],
    })
  })

  it('quem não é cliente → null (entregador e admin não participam)', async () => {
    const { service } = makeService(makePrisma({ users: [{ id: MARIA, name: 'Maria', role: 'COURIER' }] }))
    expect(await service.clientReferrals(MARIA)).toBeNull()
  })

  it('checkCode: código do próprio cliente → self', async () => {
    const { service } = makeService()
    expect(await service.checkCode(MARIA, 'mari-4p9q')).toEqual({ valid: false, self: true, owner: null })
  })

  it('checkCode: dono bloqueado ou inexistente → inválido', async () => {
    const prisma = makePrisma({
      users: [
        { id: JOAO, name: 'João Silva', role: 'CLIENT', isBlocked: true, referralCode: 'JOAO7K2F' },
        { id: MARIA, name: 'Maria Souza', role: 'CLIENT' },
      ],
    })
    const { service } = makeService(prisma)
    expect(await service.checkCode(MARIA, 'JOAO7K2F')).toEqual({ valid: false, self: false, owner: null })
    expect(await service.checkCode(MARIA, 'NADA2222')).toEqual({ valid: false, self: false, owner: null })
  })

  it('checkCode: válido → nome completo e condomínio do dono', async () => {
    const { service } = makeService()
    expect(await service.checkCode(MARIA, 'joao 7k2f')).toEqual({
      valid: true,
      self: false,
      owner: { name: 'João Silva', condo: 'Parque das Flores' },
    })
  })
})

describe('AdminReferralsService.link — vínculo manual', () => {
  it('cria com source ADMIN e cadastro já confirmado, e avalia na hora', async () => {
    qualifyReferral.mockResolvedValue('REWARDED')
    const { service, prisma, fastify } = makeService()

    const res = await service.link(MARIA, 'joao-7k2f')

    expect(prisma.referral.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referrerId: JOAO,
          referredId: MARIA,
          code: 'JOAO7K2F',
          source: 'ADMIN',
          status: 'PENDING',
          verifiedAt: expect.any(Date),
        }),
      }),
    )
    expect(qualifyReferral).toHaveBeenCalledWith(fastify, MARIA, expect.any(Date))
    expect(res).toEqual({ outcome: 'REWARDED', referredBy: { id: JOAO, name: 'João Silva' } })
  })

  it('cliente que já tem indicação → 409 (o índice único decide)', async () => {
    const prisma = makePrisma()
    prisma.referral.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    const { service } = makeService(prisma)
    await expect(service.link(MARIA, 'JOAO7K2F')).rejects.toMatchObject({ statusCode: 409 })
    expect(qualifyReferral).not.toHaveBeenCalled()
  })

  it('código do próprio cliente → 422', async () => {
    const { service, prisma } = makeService()
    await expect(service.link(MARIA, 'MARI4P9Q')).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('a si mesmo'),
    })
    expect(prisma.referral.create).not.toHaveBeenCalled()
  })

  it('código inválido → 422', async () => {
    const { service } = makeService()
    await expect(service.link(MARIA, 'NADA2222')).rejects.toMatchObject({ statusCode: 422 })
  })

  it('programa desligado → 422 (código novo não vincula — §4.8)', async () => {
    const { service, prisma } = makeService(makePrisma({ active: false }))
    await expect(service.link(MARIA, 'JOAO7K2F')).rejects.toMatchObject({ statusCode: 422 })
    expect(prisma.referral.create).not.toHaveBeenCalled()
  })

  it('a avaliação falhou depois do vínculo → o vínculo fica e a resposta diz aguardando', async () => {
    qualifyReferral.mockRejectedValue(new Error('mongo fora'))
    const { service } = makeService()
    expect(await service.link(MARIA, 'JOAO7K2F')).toMatchObject({ outcome: 'PENDING' })
  })
})
