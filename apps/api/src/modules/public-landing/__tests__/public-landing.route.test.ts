import { describe, it, expect, vi, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/** GET /public/landing pela SERIALIZAÇÃO (campo fora do response schema sumiria aqui). */

const service = vi.hoisted(() => ({ getPublicLandingInfo: vi.fn() }))
vi.mock('../public-landing.service.js', () => service)

import { publicLandingRoute } from '../public-landing.route.js'

async function build() {
  const app = Fastify()
  app.decorate('prisma', {} as FastifyInstance['prisma'])
  // Rota pública: se ela pedisse o authenticate, este decorator derrubaria o teste.
  app.decorate('authenticate', async () => {
    throw new Error('rota pública não pode exigir login')
  })
  await app.register(publicLandingRoute)
  await app.ready()
  return app
}

let app: FastifyInstance | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
  vi.clearAllMocks()
})

describe('publicLandingRoute', () => {
  it('sem token → 200 com turnos e indicação ligada, e cache de 5 min', async () => {
    service.getPublicLandingInfo.mockResolvedValue({
      shifts: { manha: true, tarde: false },
      referral: { active: true, reward: 5, friendBonus: 2 },
    })
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/public/landing' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ shifts: { manha: true, tarde: false }, referral: { active: true, reward: 5, friendBonus: 2 } })
    expect(res.headers['cache-control']).toBe('public, max-age=300')
  })

  it('indicação desligada → referral só com active', async () => {
    service.getPublicLandingInfo.mockResolvedValue({ shifts: { manha: true, tarde: true }, referral: { active: false } })
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/public/landing' })
    expect(res.json()).toEqual({ shifts: { manha: true, tarde: true }, referral: { active: false } })
  })

  it('campo fora do schema não vaza (ex.: horário)', async () => {
    service.getPublicLandingInfo.mockResolvedValue({
      shifts: { manha: true, tarde: true, time: '06:30' },
      referral: { active: false },
      condos: ['Residencial Sol'],
    })
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/public/landing' })
    expect(res.json()).toEqual({ shifts: { manha: true, tarde: true }, referral: { active: false } })
  })

  it('erro no banco → 500 (a página fica com o texto neutro)', async () => {
    service.getPublicLandingInfo.mockRejectedValue(new Error('atlas fora'))
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/public/landing' })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ error: 'Erro interno. Tente novamente.' })
  })
})
