import { describe, it, expect, vi, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/**
 * Rotas do cliente pela SERIALIZAÇÃO: o service devolve uma resposta completa e a rota tem que
 * entregar exatamente a mesma — campo fora do response schema sumiria aqui (fast-json-stringify).
 */

const summary = {
  active: true,
  hasReferrals: true,
  isNew: false,
  rewardBreads: 10,
  campaign: { label: 'Semana em dobro', until: '2026-10-11' },
  homeCard: { visible: true },
  bonusThisMonth: 15,
  celebration: {
    variant: 'goal',
    breads: 10,
    names: [],
    referrerName: null,
    goal: { threshold: 5, bonus: 10, next: { threshold: 10, bonus: 25 } },
    seen: { referralIds: [], goalThresholds: [5], welcome: false },
  },
}

const me = {
  state: 'active',
  code: 'JOAO7K2F',
  messageTemplate: 'Use {codigo} em {link}',
  referrerFirstName: 'João',
  rewardBreads: 10,
  baseRewardBreads: 5,
  welcomeBreads: 3,
  campaign: { label: 'Semana em dobro', until: '2026-10-11' },
  rules: { prazoDias: 60, compraMinima: 12.5 },
  stats: { earnedBreads: 45, valeram: 7, emAndamento: 3 },
  goals: {
    count: 7,
    milestones: [
      { quantidade: 5, bonus: 10, reached: true, paid: true },
      { quantidade: 10, bonus: 25, reached: false, paid: false },
    ],
    justHit: null,
    next: { quantidade: 10, bonus: 25 },
  },
  referrals: [
    { id: 'r1', name: 'Maria S.', state: 'ganhou', date: '2026-09-12T09:00:00.000Z', rewardBreads: 5, campaign: false },
    { id: 'r2', name: 'Pedro A.', state: 'aguardando', date: '2026-09-20T09:00:00.000Z', rewardBreads: null, campaign: true },
  ],
}

const service = {
  summary: vi.fn().mockResolvedValue(summary),
  me: vi.fn().mockResolvedValue(me),
  markCelebrationSeen: vi.fn().mockResolvedValue(undefined),
  dismissHomeCard: vi.fn().mockResolvedValue(undefined),
  publicConfig: vi.fn(),
  checkCode: vi.fn(),
}
vi.mock('../referrals.service.js', () => ({
  ReferralsService: vi.fn().mockImplementation(function () {
    return service
  }),
}))

import { referralsRoute } from '../referrals.route.js'

async function build(role = 'CLIENT') {
  const app = Fastify()
  app.decorate('prisma', {} as FastifyInstance['prisma'])
  app.decorateRequest('user', null)
  app.decorate('authenticate', async (request: { user: unknown }) => {
    request.user = { id: 'u1', role }
  })
  await app.register(referralsRoute)
  await app.ready()
  return app
}

let app: FastifyInstance | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
  vi.clearAllMocks()
})

describe('referralsRoute — rotas do cliente', () => {
  it('GET /referrals/summary entrega a resposta inteira', async () => {
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/referrals/summary' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(summary)
    expect(service.summary).toHaveBeenCalledWith('u1')
  })

  it('GET /referrals/summary sem comemoração → celebration null', async () => {
    service.summary.mockResolvedValueOnce({ ...summary, celebration: null, campaign: null })
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/referrals/summary' })
    expect(res.json()).toMatchObject({ celebration: null, campaign: null })
  })

  it('GET /referrals/me entrega a resposta inteira', async () => {
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/referrals/me' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(me)
  })

  it('GET /referrals/me pausado → code null passa', async () => {
    service.me.mockResolvedValueOnce({ ...me, state: 'paused', code: null })
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/referrals/me' })
    expect(res.json()).toMatchObject({ state: 'paused', code: null })
  })

  it('POST /referrals/celebration/seen valida e repassa o que marcar', async () => {
    app = await build()
    const ok = await app.inject({
      method: 'POST',
      url: '/referrals/celebration/seen',
      payload: { referralIds: ['64b000000000000000000001'], goalThresholds: [5], welcome: true },
    })
    expect(ok.json()).toEqual({ ok: true })
    expect(service.markCelebrationSeen).toHaveBeenCalledWith('u1', {
      referralIds: ['64b000000000000000000001'],
      goalThresholds: [5],
      welcome: true,
    })

    const bad = await app.inject({ method: 'POST', url: '/referrals/celebration/seen', payload: { referralIds: ['nao-e-id'] } })
    expect(bad.statusCode).toBe(400)
  })

  it('POST /referrals/home-card/dismiss', async () => {
    app = await build()
    const res = await app.inject({ method: 'POST', url: '/referrals/home-card/dismiss' })
    expect(res.json()).toEqual({ ok: true })
    expect(service.dismissHomeCard).toHaveBeenCalledWith('u1')
  })

  it('entregador/admin → 403 em todas', async () => {
    app = await build('COURIER')
    for (const [method, url] of [
      ['GET', '/referrals/summary'],
      ['GET', '/referrals/me'],
      ['POST', '/referrals/celebration/seen'],
      ['POST', '/referrals/home-card/dismiss'],
    ] as const) {
      const res = await app.inject({ method, url, payload: method === 'POST' ? {} : undefined })
      expect(res.statusCode).toBe(403)
    }
  })
})
