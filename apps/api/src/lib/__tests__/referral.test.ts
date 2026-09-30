import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Avisos: só importa QUEM recebe e O QUÊ — o encanamento (in-app + push) tem teste próprio.
const notifyUser = vi.fn().mockResolvedValue(undefined)
const notifyAdmins = vi.fn().mockResolvedValue(undefined)
vi.mock('../../modules/notifications/notifications.service.js', () => ({
  NotificationsService: vi.fn().mockImplementation(function () {
    return { notifyUser, notifyAdmins }
  }),
}))

import { attachReferralAtSignup, checkPublicCode, createReferral, markReferralVerified } from '../referral.js'
import { REFERRAL_DEFAULTS } from '../referral-config.js'

type Row = Record<string, unknown>

/** Settings "no banco" para getReferralConfig (findMany). */
function settingsOf(values: Record<string, string>) {
  return vi.fn().mockImplementation(({ where }: { where: { key: { in: string[] } } }) =>
    Promise.resolve(
      Object.entries(values)
        .filter(([key]) => where.key.in.includes(key))
        .map(([key, value]) => ({ key, value })),
    ),
  )
}

const ON = { indicacaoAtiva: 'true', indicacaoRecompensa: '5', indicacaoBonusIndicado: '3', indicacaoPrazoDias: '60' }

const referrer = { id: 'ref1', name: 'João Martins', role: 'CLIENT', isBlocked: false }

function makeFastify(opts: { settings?: Record<string, string>; owner?: Row | null } = {}) {
  const prisma = {
    setting: { findMany: settingsOf(opts.settings ?? ON) },
    user: {
      findFirst: vi.fn().mockResolvedValue(opts.owner === undefined ? referrer : opts.owner),
      findUnique: vi.fn().mockResolvedValue({ name: 'Maria Souza' }),
    },
    referral: {
      create: vi.fn().mockResolvedValue({ id: 'r1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ referrerId: 'ref1', rewardMilli: 5000 }),
    },
  }
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
  return { fastify: { prisma, log } as unknown as FastifyInstance, prisma, log }
}

beforeEach(() => {
  notifyUser.mockClear()
  notifyAdmins.mockClear()
})

describe('referral — cadastro e vínculo (Onda 3)', () => {
  describe('attachReferralAtSignup', () => {
    it('código válido → cria PENDING com valores congelados e TODAS as chaves', async () => {
      const { fastify, prisma } = makeFastify()
      const before = Date.now()

      await expect(attachReferralAtSignup(fastify, { id: 'friend1' }, ' joao-7k2f ', 'LINK')).resolves.toBe('r1')

      expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { referralCode: 'JOAO7K2F' } }))
      const data = prisma.referral.create.mock.calls[0][0].data
      expect(data).toMatchObject({
        referrerId: 'ref1',
        referredId: 'friend1',
        code: 'JOAO7K2F',
        source: 'LINK',
        status: 'PENDING',
        rewardMilli: 5000,
        welcomeMilli: 3000,
        campaignMultiplier: 1,
        campaignLabel: null,
        verifiedAt: null,
        flags: [],
      })
      // Coleção nova: nenhuma chave pode faltar (consultar por `null` depende disso).
      for (const key of [
        'expiresAt', 'verifiedAt', 'qualifiedAt', 'qualifyingOrderId', 'qualifyingKind', 'rewardedAt',
        'reviewedById', 'reviewedAt', 'rejectReason', 'rejectDetail', 'rewardSeenAt', 'welcomeSeenAt',
        'campaignLabel',
      ]) {
        expect(data).toHaveProperty(key)
      }
      // Prazo: 60 dias a partir de agora
      const expires = (data.expiresAt as Date).getTime()
      expect(expires - before).toBeGreaterThanOrEqual(60 * 86_400_000 - 1000)
      expect(expires - before).toBeLessThanOrEqual(60 * 86_400_000 + 5000)
    })

    it('prazo 0 → sem prazo (expiresAt null); bônus 0 → welcomeMilli 0', async () => {
      const { fastify, prisma } = makeFastify({ settings: { ...ON, indicacaoPrazoDias: '0', indicacaoBonusIndicado: '0' } })
      await attachReferralAtSignup(fastify, { id: 'friend1' }, 'JOAO7K2F')
      const data = prisma.referral.create.mock.calls[0][0].data
      expect(data.expiresAt).toBeNull()
      expect(data.welcomeMilli).toBe(0)
      expect(data.source).toBe('CODE')
    })

    it('campanha ativa: congela multiplicador e rótulo; só a recompensa de quem indica muda', async () => {
      const today = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10) // dia BRT
      const campanha = JSON.stringify({ rotulo: 'Semana em dobro', multiplicador: 2, inicio: today, fim: today })
      const { fastify, prisma } = makeFastify({ settings: { ...ON, indicacaoCampanha: campanha } })

      await attachReferralAtSignup(fastify, { id: 'friend1' }, 'JOAO7K2F')

      expect(prisma.referral.create.mock.calls[0][0].data).toMatchObject({
        rewardMilli: 10_000,
        welcomeMilli: 3000,
        campaignMultiplier: 2,
        campaignLabel: 'Semana em dobro',
      })
    })

    it('programa desligado → não vincula (nem procura o código)', async () => {
      const { fastify, prisma } = makeFastify({ settings: { ...ON, indicacaoAtiva: 'false' } })
      await expect(attachReferralAtSignup(fastify, { id: 'friend1' }, 'JOAO7K2F')).resolves.toBeNull()
      expect(prisma.user.findFirst).not.toHaveBeenCalled()
      expect(prisma.referral.create).not.toHaveBeenCalled()
    })

    it('código inexistente, de bloqueado, de entregador/admin ou do próprio → não vincula', async () => {
      const casos: Array<Row | null> = [
        null,
        { ...referrer, isBlocked: true },
        { ...referrer, role: 'COURIER' },
        { ...referrer, role: 'ADMIN' },
        { ...referrer, id: 'friend1' },
      ]
      for (const owner of casos) {
        const { fastify, prisma } = makeFastify({ owner })
        await expect(attachReferralAtSignup(fastify, { id: 'friend1' }, 'JOAO7K2F')).resolves.toBeNull()
        expect(prisma.referral.create).not.toHaveBeenCalled()
      }
    })

    it('código vazio → nem consulta o banco', async () => {
      const { fastify, prisma } = makeFastify()
      await expect(attachReferralAtSignup(fastify, { id: 'friend1' }, '  -  ')).resolves.toBeNull()
      expect(prisma.setting.findMany).not.toHaveBeenCalled()
    })

    it('amigo que já tem indicador (P2002 no referredId) → null, sem erro', async () => {
      const { fastify, prisma, log } = makeFastify()
      prisma.referral.create.mockRejectedValueOnce({ code: 'P2002' })
      await expect(attachReferralAtSignup(fastify, { id: 'friend1' }, 'JOAO7K2F')).resolves.toBeNull()
      expect(log.warn).not.toHaveBeenCalled()
    })

    it('erro interno → não lança (o cadastro segue), só loga', async () => {
      const { fastify, prisma, log } = makeFastify()
      prisma.user.findFirst.mockRejectedValueOnce(new Error('Atlas fora'))
      await expect(attachReferralAtSignup(fastify, { id: 'friend1' }, 'JOAO7K2F')).resolves.toBeNull()
      expect(log.warn).toHaveBeenCalledOnce()
    })
  })

  describe('createReferral', () => {
    it('aceita verifiedAt (vínculo manual de quem já entrou) e a origem ADMIN', async () => {
      const { prisma } = makeFastify()
      const verifiedAt = new Date('2026-09-01T12:00:00Z')
      await createReferral(prisma as never, {
        referrerId: 'ref1',
        referredId: 'friend1',
        code: 'JOAO7K2F',
        source: 'ADMIN',
        config: { ...REFERRAL_DEFAULTS, ativa: true },
        verifiedAt,
      })
      expect(prisma.referral.create.mock.calls[0][0].data).toMatchObject({ source: 'ADMIN', verifiedAt })
    })

    it('erro que não é P2002 sobe', async () => {
      const { prisma } = makeFastify()
      prisma.referral.create.mockRejectedValueOnce(new Error('x'))
      await expect(
        createReferral(prisma as never, {
          referrerId: 'ref1', referredId: 'f', code: 'C', source: 'CODE', config: REFERRAL_DEFAULTS,
        }),
      ).rejects.toThrow('x')
    })
  })

  describe('checkPublicCode', () => {
    it('válido → só primeiro nome + inicial e o bônus do amigo', async () => {
      const { prisma } = makeFastify()
      await expect(checkPublicCode(prisma as never, 'joao7k2f')).resolves.toEqual({
        valid: true,
        referrerName: 'João M.',
        welcomeBreads: 3,
      })
    })

    it('programa desligado, código inexistente ou dono bloqueado → { valid: false } e nada mais', async () => {
      const off = makeFastify({ settings: { indicacaoAtiva: 'false' } })
      await expect(checkPublicCode(off.prisma as never, 'JOAO7K2F')).resolves.toEqual({ valid: false })
      const none = makeFastify({ owner: null })
      await expect(checkPublicCode(none.prisma as never, 'XXXX9999')).resolves.toEqual({ valid: false })
      const blocked = makeFastify({ owner: { ...referrer, isBlocked: true } })
      await expect(checkPublicCode(blocked.prisma as never, 'JOAO7K2F')).resolves.toEqual({ valid: false })
    })
  })

  describe('markReferralVerified', () => {
    it('1º login: claim de verifiedAt (null) + REFERRAL_SIGNUP para quem indicou', async () => {
      const { fastify, prisma } = makeFastify()

      await markReferralVerified(fastify, 'friend1')

      const claim = prisma.referral.updateMany.mock.calls[0][0]
      expect(claim.where).toEqual({ referredId: 'friend1', verifiedAt: null })
      expect(claim.data.verifiedAt).toBeInstanceOf(Date)
      expect(notifyUser).toHaveBeenCalledOnce()
      const [to, payload] = notifyUser.mock.calls[0]
      expect(to).toBe('ref1')
      expect(payload).toMatchObject({
        type: 'REFERRAL_SIGNUP',
        title: 'Sua indicação chegou! 🎉',
        body: 'Maria se cadastrou com o seu código. Quando o 1º pedido chegar, você ganha 5 pãezins.',
        actionRoute: '/client/perfil/indique',
      })
    })

    it('usa o valor CONGELADO (com campanha) no aviso', async () => {
      const { fastify, prisma } = makeFastify()
      prisma.referral.findUnique.mockResolvedValueOnce({ referrerId: 'ref1', rewardMilli: 10_000 })
      await markReferralVerified(fastify, 'friend1')
      expect(notifyUser.mock.calls[0][1].body).toContain('você ganha 10 pãezins')
    })

    it('sem indicação, ou já confirmada (claim perdido) → nenhum aviso', async () => {
      const { fastify, prisma } = makeFastify()
      prisma.referral.updateMany.mockResolvedValueOnce({ count: 0 })
      await markReferralVerified(fastify, 'friend1')
      expect(prisma.referral.findUnique).not.toHaveBeenCalled()
      expect(notifyUser).not.toHaveBeenCalled()
    })

    it('erro → não lança (o login não cai), só loga', async () => {
      const { fastify, prisma, log } = makeFastify()
      prisma.referral.updateMany.mockRejectedValueOnce(new Error('Atlas fora'))
      await expect(markReferralVerified(fastify, 'friend1')).resolves.toBeUndefined()
      expect(log.warn).toHaveBeenCalledOnce()
    })
  })
})
