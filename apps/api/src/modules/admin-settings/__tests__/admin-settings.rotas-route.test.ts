import { describe, it, expect, vi, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/**
 * `GET/PATCH /admin/settings/rotas` pela SERIALIZAÇÃO (o fast-json-stringify descarta o que não
 * está no schema): base, preços, data e `storageConfigured` precisam chegar ao front. Forma inválida
 * é 400 antes do service; só ADMIN.
 */
const config = {
  base: { endereco: 'Rua das Flores, 120', lat: -23.5618, lng: -46.6588 },
  voltaBase: true,
  minPorPorta: 1,
  precoGasolina: 6.09,
  precoEtanol: null,
  precoAtualizadoEm: '2026-09-28',
  fotoClienteVisivel: true,
  entregadorVeCombNumeros: false,
  entregadorVeCombFimRota: false,
  entregadorVeCombGanhos: false,
  storageConfigured: false,
  rotaPadrao: { count: 12, km: 18.4, durationMin: 52, savedAt: '2026-10-06T12:00:00.000Z', toReview: 2, outside: 1 },
}

const service = {
  getRouteSettings: vi.fn().mockResolvedValue(config),
  setRouteSettings: vi.fn().mockResolvedValue(config),
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

const body = {
  base: { endereco: 'Rua das Flores, 120', lat: -23.5618, lng: -46.6588 },
  voltaBase: true,
  minPorPorta: 1,
  precoGasolina: 6.09,
  precoEtanol: null,
  fotoClienteVisivel: true,
}

describe('/admin/settings/rotas', () => {
  it('GET devolve a config inteira, com preço nulo e storageConfigured', async () => {
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/admin/settings/rotas' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(config)
  })

  it('GET com base não definida devolve base: null; sem rota padrão, rotaPadrao: null', async () => {
    service.getRouteSettings.mockResolvedValueOnce({ ...config, base: null, rotaPadrao: null })
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/admin/settings/rotas' })
    expect(res.json().base).toBeNull()
    expect(res.json().rotaPadrao).toBeNull()
  })

  it('PATCH válido chama o service e devolve a config salva', async () => {
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/admin/settings/rotas', payload: body })
    expect(res.statusCode).toBe(200)
    expect(service.setRouteSettings).toHaveBeenCalledWith(body)
  })

  it('PATCH com os switches do entregador repassa os três; sem eles também vale (T-19)', async () => {
    app = await build()
    const vis = { entregadorVeCombNumeros: true, entregadorVeCombFimRota: false, entregadorVeCombGanhos: true }
    const res = await app.inject({ method: 'PATCH', url: '/admin/settings/rotas', payload: { ...body, ...vis } })
    expect(res.statusCode).toBe(200)
    expect(service.setRouteSettings).toHaveBeenCalledWith({ ...body, ...vis })
    expect(res.json()).toMatchObject({ entregadorVeCombNumeros: false, entregadorVeCombGanhos: false })
  })

  it('PATCH com tempo por porta fora da faixa → 400, sem chamar o service', async () => {
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/admin/settings/rotas', payload: { ...body, minPorPorta: 20 } })
    expect(res.statusCode).toBe(400)
    expect(service.setRouteSettings).not.toHaveBeenCalled()
  })

  it('PATCH com o preço do GNV (Onda 11): repassa; zero → 400 com a mensagem do m³', async () => {
    app = await build()
    const ok = await app.inject({ method: 'PATCH', url: '/admin/settings/rotas', payload: { ...body, precoGnv: 4.99 } })
    expect(ok.statusCode).toBe(200)
    expect(service.setRouteSettings).toHaveBeenCalledWith({ ...body, precoGnv: 4.99 })
    const bad = await app.inject({ method: 'PATCH', url: '/admin/settings/rotas', payload: { ...body, precoGnv: 0 } })
    expect(bad.statusCode).toBe(400)
    expect(bad.json().error).toContain('m³')
  })

  it('PATCH com preço zero → 400', async () => {
    app = await build()
    const res = await app.inject({ method: 'PATCH', url: '/admin/settings/rotas', payload: { ...body, precoGasolina: 0 } })
    expect(res.statusCode).toBe(400)
  })

  it('não-admin → 403', async () => {
    app = await build('COURIER')
    const res = await app.inject({ method: 'GET', url: '/admin/settings/rotas' })
    expect(res.statusCode).toBe(403)
  })
})
