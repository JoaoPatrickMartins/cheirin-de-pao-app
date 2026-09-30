import { describe, it, expect, vi, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { DEFAULT_REFERRAL_MESSAGE } from '@cheirin-de-pao/shared'

/**
 * `GET/PATCH /admin/settings/indicacao` pela SERIALIZAÇÃO: campanha, metas, `unitPrice` e `today`
 * precisam atravessar o response schema. E: forma inválida é 400 antes do service; regra de
 * negócio do service é 422 com o texto da tela.
 */

const config = {
  ativa: true,
  recompensa: 5,
  bonusIndicado: 3,
  compraMinima: 12.5,
  limiteMensal: 10,
  prazoDias: 60,
  mensagem: DEFAULT_REFERRAL_MESSAGE,
  campanha: { rotulo: 'Semana em dobro', multiplicador: 2, inicio: '2026-10-05', fim: '2026-10-11' },
  metas: [
    { quantidade: 5, bonus: 10 },
    { quantidade: 10, bonus: 25 },
  ],
}

const service = {
  getReferralSettings: vi.fn().mockResolvedValue({ ...config, unitPrice: 1.2, today: '2026-09-29' }),
  setReferralSettings: vi.fn().mockResolvedValue(config),
}
vi.mock('../admin-settings.service.js', () => ({
  AdminSettingsService: vi.fn().mockImplementation(function () {
    return service
  }),
}))
vi.mock('../admin-blocks.service.js', () => ({
  AdminBlocksService: vi.fn().mockImplementation(function () {
    return {}
  }),
}))

import { adminSettingsRoute } from '../admin-settings.route.js'

async function build(role = 'ADMIN') {
  const app = Fastify()
  app.decorate('prisma', {} as FastifyInstance['prisma'])
  app.decorateRequest('user', null)
  app.decorate('authenticate', async (request: { user: unknown }) => {
    request.user = { id: 'admin1', role }
  })
  await app.register(adminSettingsRoute)
  await app.ready()
  return app
}

let app: FastifyInstance | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
  vi.clearAllMocks()
})

describe('/admin/settings/indicacao', () => {
  it('GET entrega a config inteira + unitPrice + today', async () => {
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/admin/settings/indicacao' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ...config, unitPrice: 1.2, today: '2026-09-29' })
  })

  it('GET sem campanha → null passa', async () => {
    service.getReferralSettings.mockResolvedValueOnce({ ...config, campanha: null, metas: [], unitPrice: 0, today: '2026-09-29' })
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/admin/settings/indicacao' })
    expect(res.json()).toMatchObject({ campanha: null, metas: [] })
  })

  it('só ADMIN', async () => {
    app = await build('CLIENT')
    expect((await app.inject({ method: 'GET', url: '/admin/settings/indicacao' })).statusCode).toBe(403)
    expect((await app.inject({ method: 'PATCH', url: '/admin/settings/indicacao', payload: config })).statusCode).toBe(403)
  })

  it('PATCH válido → devolve o que ficou gravado', async () => {
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/admin/settings/indicacao', payload: config })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(config)
    expect(service.setReferralSettings).toHaveBeenCalledWith(config)
  })

  it('PATCH fora das faixas da D-13 → 400 sem chegar ao service', async () => {
    app = await build()
    for (const payload of [
      { ...config, recompensa: 51 },
      { ...config, prazoDias: 181 },
      { ...config, campanha: { ...config.campanha, multiplicador: 6 } },
      { ...config, metas: [1, 2, 3, 4, 5, 6].map((n) => ({ quantidade: n, bonus: 1 })) },
      { ...config, metas: [{ quantidade: 5, bonus: 1 }, { quantidade: 5, bonus: 2 }] },
      { ...config, mensagem: 'curta {codigo}' },
    ]) {
      const res = await app.inject({ method: 'PATCH', url: '/admin/settings/indicacao', payload })
      expect(res.statusCode).toBe(400)
    }
    expect(service.setReferralSettings).not.toHaveBeenCalled()
  })

  it('PATCH com regra de negócio violada → 422 com o texto do service', async () => {
    service.setReferralSettings.mockRejectedValueOnce({
      statusCode: 422,
      message: 'Para ligar o programa, defina uma recompensa maior que 0 para quem indica.',
    })
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/admin/settings/indicacao', payload: { ...config, recompensa: 0 } })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toEqual({ error: 'Para ligar o programa, defina uma recompensa maior que 0 para quem indica.' })
  })
})
