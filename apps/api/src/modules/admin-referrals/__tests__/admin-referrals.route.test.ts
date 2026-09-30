import { describe, it, expect, vi, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/**
 * Rotas do admin pela SERIALIZAÇÃO: o service devolve respostas completas e a rota tem que
 * entregar exatamente as mesmas — campo fora do response schema sumiria aqui (fast-json-stringify).
 * Também: só ADMIN, corpo inválido não chega ao service, erro de domínio vira o status certo.
 */

const listResponse = {
  items: [
    {
      id: 'r1',
      state: 'analise',
      referrer: { id: 'u1', name: 'João Silva' },
      referred: { id: 'u2', name: 'Júlia Ramos' },
      createdAt: '2026-09-18T12:12:00.000Z',
      condo: 'Parque das Flores',
      signals: ['Mesmo apartamento'],
    },
    {
      id: 'r2',
      state: 'cadastro',
      referrer: { id: 'u3', name: 'Ricardo Alves' },
      referred: { id: 'u4', name: 'Paula Mendes' },
      createdAt: '2026-09-26T19:02:00.000Z',
      condo: null,
      signals: [],
    },
  ],
  counts: { analise: 3, aguardando: 9, ganhou: 17, recusada: 2, expirou: 3, todas: 34 },
  total: 3,
  page: 1,
  pageSize: 20,
}

const detailResponse = {
  id: 'r1',
  state: 'recusada',
  referrer: { id: 'u1', name: 'João Silva' },
  referred: { id: 'u2', name: 'Júlia Ramos' },
  condo: 'Parque das Flores',
  signals: ['Mesmo apartamento', 'Mesmo aparelho'],
  code: 'JOAO7K2F',
  source: 'LINK',
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
  reviewedAt: '2026-09-21T10:00:00.000Z',
  rejectReason: 'SAME_RESIDENCE',
  rejectDetail: 'Mesmo apartamento do indicador (Bl. B 42).',
  expiresAt: null,
}

const clientResponse = {
  active: true,
  code: 'MARI4P9Q',
  referredBy: { id: 'u1', name: 'João Silva', state: 'ganhou' },
  stats: { fez: 4, valeram: 1, earnedBreads: 15 },
  referrals: [{ id: 'r3', name: 'Ana Lopes', createdAt: '2026-09-20T15:30:00.000Z', state: 'aguardando' }],
}

const service = {
  summary: vi.fn().mockResolvedValue({ pendingReview: 3 }),
  list: vi.fn().mockResolvedValue(listResponse),
  detail: vi.fn().mockResolvedValue(detailResponse),
  approve: vi.fn().mockResolvedValue(undefined),
  reject: vi.fn().mockResolvedValue(undefined),
  clientReferrals: vi.fn().mockResolvedValue(clientResponse),
  checkCode: vi.fn().mockResolvedValue({ valid: true, self: false, owner: { name: 'João Silva', condo: null } }),
  link: vi.fn().mockResolvedValue({ outcome: 'ON_HOLD', referredBy: { id: 'u1', name: 'João Silva' } }),
}
vi.mock('../admin-referrals.service.js', () => ({
  AdminReferralsService: vi.fn().mockImplementation(function () {
    return service
  }),
}))

import { adminReferralsRoute } from '../admin-referrals.route.js'

async function build(role = 'ADMIN') {
  const app = Fastify()
  app.decorate('prisma', {} as FastifyInstance['prisma'])
  app.decorateRequest('user', null)
  app.decorate('authenticate', async (request: { user: unknown }) => {
    request.user = { id: 'admin1', role }
  })
  await app.register(adminReferralsRoute)
  await app.ready()
  return app
}

let app: FastifyInstance | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
  vi.clearAllMocks()
})

describe('adminReferralsRoute', () => {
  it('só ADMIN', async () => {
    app = await build('CLIENT')
    for (const [method, url] of [
      ['GET', '/admin/referrals'],
      ['GET', '/admin/referrals/summary'],
      ['POST', '/admin/referrals/r1/approve'],
      ['GET', '/admin/clients/u2/referrals'],
    ] as const) {
      const res = await app.inject({ method, url })
      expect(res.statusCode).toBe(403)
    }
    expect(service.list).not.toHaveBeenCalled()
    expect(service.approve).not.toHaveBeenCalled()
  })

  it('GET /admin/referrals/summary', async () => {
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/admin/referrals/summary' })
    expect(res.json()).toEqual({ pendingReview: 3 })
  })

  it('GET /admin/referrals entrega a lista inteira e repassa filtro, busca e página', async () => {
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/admin/referrals?state=ganhou&q=maria&page=2' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(listResponse)
    expect(service.list).toHaveBeenCalledWith({ state: 'ganhou', q: 'maria', page: 2 })
  })

  it('GET /admin/referrals com filtro desconhecido cai em "Em análise"', async () => {
    app = await build()
    await app.inject({ method: 'GET', url: '/admin/referrals?state=xpto' })
    expect(service.list).toHaveBeenCalledWith({ state: 'analise', page: 1 })
  })

  it('GET /admin/referrals/:id entrega o detalhe inteiro (motivo da recusa incluso)', async () => {
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/admin/referrals/r1' })
    expect(res.json()).toEqual(detailResponse)
  })

  it('GET /admin/referrals/:id inexistente → 404', async () => {
    service.detail.mockResolvedValueOnce(null)
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/admin/referrals/r9' })
    expect(res.statusCode).toBe(404)
  })

  it('POST approve repassa quem aprovou; conflito do domínio vira 409', async () => {
    app = await build()
    const ok = await app.inject({ method: 'POST', url: '/admin/referrals/r1/approve' })
    expect(ok.json()).toEqual({ ok: true })
    expect(service.approve).toHaveBeenCalledWith('r1', 'admin1')

    service.approve.mockRejectedValueOnce({ statusCode: 409, message: 'Esta indicação não está mais em análise.' })
    const conflict = await app.inject({ method: 'POST', url: '/admin/referrals/r1/approve' })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json()).toEqual({ error: 'Esta indicação não está mais em análise.' })
  })

  it('POST reject exige motivo válido e detalhe — sem eles nem chega ao service (400)', async () => {
    app = await build()
    const semDetalhe = await app.inject({ method: 'POST', url: '/admin/referrals/r1/reject', payload: { reason: 'OTHER' } })
    expect(semDetalhe.statusCode).toBe(400)
    const detalheVazio = await app.inject({
      method: 'POST',
      url: '/admin/referrals/r1/reject',
      payload: { reason: 'OTHER', detail: '   ' },
    })
    expect(detalheVazio.statusCode).toBe(400)
    const motivoRuim = await app.inject({
      method: 'POST',
      url: '/admin/referrals/r1/reject',
      payload: { reason: 'NAO_GOSTEI', detail: 'Qualquer coisa' },
    })
    expect(motivoRuim.statusCode).toBe(400)
    expect(service.reject).not.toHaveBeenCalled()

    const ok = await app.inject({
      method: 'POST',
      url: '/admin/referrals/r1/reject',
      payload: { reason: 'SAME_RESIDENCE', detail: '  Mesmo apartamento (Bl. B 42).  ' },
    })
    expect(ok.json()).toEqual({ ok: true })
    expect(service.reject).toHaveBeenCalledWith('r1', { reason: 'SAME_RESIDENCE', detail: 'Mesmo apartamento (Bl. B 42).' }, 'admin1')
  })

  it('GET /admin/clients/:id/referrals entrega o card inteiro', async () => {
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/admin/clients/u2/referrals' })
    expect(res.json()).toEqual(clientResponse)
  })

  it('GET /admin/clients/:id/referrals sem indicador → referredBy null passa', async () => {
    service.clientReferrals.mockResolvedValueOnce({ ...clientResponse, referredBy: null, code: null })
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/admin/clients/u2/referrals' })
    expect(res.json()).toMatchObject({ referredBy: null, code: null })
  })

  it('GET referral-code-check repassa o código e entrega self/owner', async () => {
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/admin/clients/u2/referral-code-check?code=joao7k2f' })
    expect(res.json()).toEqual({ valid: true, self: false, owner: { name: 'João Silva', condo: null } })
    expect(service.checkCode).toHaveBeenCalledWith('u2', 'joao7k2f')

    service.checkCode.mockResolvedValueOnce({ valid: false, self: true, owner: null })
    const self = await app.inject({ method: 'GET', url: '/admin/clients/u2/referral-code-check?code=MARI4P9Q' })
    expect(self.json()).toEqual({ valid: false, self: true, owner: null })
  })

  it('POST /admin/clients/:id/referral: sem código → 400; ok → desfecho; já tem → 409', async () => {
    app = await build()
    const vazio = await app.inject({ method: 'POST', url: '/admin/clients/u2/referral', payload: {} })
    expect(vazio.statusCode).toBe(400)

    const ok = await app.inject({ method: 'POST', url: '/admin/clients/u2/referral', payload: { code: 'JOAO7K2F' } })
    expect(ok.json()).toEqual({ ok: true, outcome: 'ON_HOLD', referredBy: { id: 'u1', name: 'João Silva' } })

    service.link.mockRejectedValueOnce({ statusCode: 409, message: 'Este cliente já tem uma indicação.' })
    const dup = await app.inject({ method: 'POST', url: '/admin/clients/u2/referral', payload: { code: 'JOAO7K2F' } })
    expect(dup.statusCode).toBe(409)
  })
})
