import { describe, it, expect, vi, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/** Rotas da lista de espera pela SERIALIZAÇÃO (campo fora do response schema sumiria aqui). */

const groups = {
  groups: [
    {
      key: 'residencial sol|campinas',
      name: 'Residencial Sol',
      city: 'Campinas',
      count: 2,
      viaReferral: 1,
      handled: false,
      lastAt: '2026-09-24T12:00:00.000Z',
      contacts: [
        { id: 'i2', name: 'Luciana P.', email: 'luciana@email.com', phone: null, createdAt: '2026-09-24T12:00:00.000Z', viaReferral: true },
        { id: 'i1', name: 'Roberto K.', email: null, phone: '19981234400', createdAt: '2026-09-22T12:00:00.000Z', viaReferral: false },
      ],
    },
  ],
}

const service = {
  create: vi.fn().mockResolvedValue(undefined),
  listGroups: vi.fn().mockResolvedValue(groups),
  setHandled: vi.fn().mockResolvedValue(undefined),
}
vi.mock('../condo-interests.service.js', () => ({
  CondoInterestsService: vi.fn().mockImplementation(function () {
    return service
  }),
}))

import { condoInterestsRoute } from '../condo-interests.route.js'

async function build(role = 'ADMIN') {
  const app = Fastify()
  app.decorate('prisma', {} as FastifyInstance['prisma'])
  app.decorateRequest('user', null)
  app.decorate('authenticate', async (request: { user: unknown }) => {
    request.user = { id: 'admin1', role }
  })
  await app.register(condoInterestsRoute)
  await app.ready()
  return app
}

let app: FastifyInstance | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
  vi.clearAllMocks()
})

const payload = { condoName: 'Residencial Sol', city: 'Campinas', contactName: 'Luciana P.', contact: 'luciana@email.com' }

describe('condoInterestsRoute', () => {
  it('POST público → 201', async () => {
    app = await build()
    const res = await app.inject({ method: 'POST', url: '/condominiums/interest', payload })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ ok: true })
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ condoName: 'Residencial Sol', city: 'Campinas' }))
  })

  it('POST sem cidade → 400 com a mensagem do campo, sem chegar ao service', async () => {
    app = await build()
    const res = await app.inject({ method: 'POST', url: '/condominiums/interest', payload: { ...payload, city: '' } })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Informe a cidade' })
    expect(service.create).not.toHaveBeenCalled()
  })

  it('POST com contato inválido → 400 do service', async () => {
    service.create.mockRejectedValueOnce({ statusCode: 400, message: 'Informe um e-mail ou celular válido' })
    app = await build()
    const res = await app.inject({ method: 'POST', url: '/condominiums/interest', payload: { ...payload, contact: 'abc' } })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Informe um e-mail ou celular válido' })
  })

  it('GET do admin entrega os grupos inteiros; só ADMIN', async () => {
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/admin/condominiums/interests' })
    expect(res.json()).toEqual(groups)
    await app.close()
    app = await build('CLIENT')
    expect((await app.inject({ method: 'GET', url: '/admin/condominiums/interests' })).statusCode).toBe(403)
  })

  it('PATCH marca/reabre o grupo; 404 do domínio passa', async () => {
    app = await build()
    const ok = await app.inject({
      method: 'PATCH',
      url: '/admin/condominiums/interests/handled',
      payload: { groupKey: 'residencial sol|campinas', handled: true },
    })
    expect(ok.json()).toEqual({ ok: true })
    expect(service.setHandled).toHaveBeenCalledWith('residencial sol|campinas', true)

    service.setHandled.mockRejectedValueOnce({ statusCode: 404, message: 'Grupo não encontrado.' })
    const missing = await app.inject({ method: 'PATCH', url: '/admin/condominiums/interests/handled', payload: { groupKey: 'x', handled: false } })
    expect(missing.statusCode).toBe(404)
  })
})
