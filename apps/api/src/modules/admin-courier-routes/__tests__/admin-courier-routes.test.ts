// Rotas dos entregadores no admin: A4 (rota salva × sugestão + alterações do entregador; quem segue
// a rota padrão), A2 (mapa ao vivo: progresso, sem foto, posição), a rota padrão pela serialização
// e o bloqueio para quem não é admin.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../../courier/courier-plan.js', async (orig) => {
  const real = await orig<typeof import('../../courier/courier-plan.js')>()
  return {
    ...real,
    metricsForOrder: vi.fn(async () => ({ km: 9.2, durationMin: 70, geometry: [[-23.5, -46.6]], legSeconds: [] })),
    acceptSuggestion: vi.fn(),
  }
})

import { AdminCourierRoutesService, describeChange } from '../admin-courier-routes.service.js'
import { adminCourierRoutesRoute } from '../admin-courier-routes.route.js'

const now = new Date('2026-10-02T09:30:00.000Z') // 06:30 BRT

function prismaMock() {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'k1', name: 'Antônio Ribeiro', role: 'COURIER' }),
      findMany: vi.fn().mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.includes('k1')
          ? [{ id: 'k1', name: 'Antônio Ribeiro' }]
          : [
              { id: 'u1', name: 'Maria', apartment: '101', block: '1', condominiumId: 'cA' },
              { id: 'u2', name: 'Pedro', apartment: '204', block: '1', condominiumId: 'cA' },
              { id: 'u3', name: 'Ana', apartment: '12', block: null, condominiumId: 'cB' },
            ],
      ),
    },
    courierRouteTemplate: {
      findUnique: vi.fn().mockResolvedValue({
        acceptedAt: new Date('2026-09-15T12:00:00Z'),
        condominiumIds: ['cA', 'cB'],
        km: 9.2,
        durationMin: 70,
        suggestion: { condominiumIds: ['cA', 'cN', 'cB'], km: 8.1, durationMin: 64, reason: 'NEW_CONDO', newIds: ['cN'], removedIds: [], createdAt: '2026-09-28T10:00:00Z' },
      }),
    },
    courierRun: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    condominium: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'cA', name: 'Residencial Jardins', lat: -23.5, lng: -46.6 },
        { id: 'cB', name: 'Edifício Aurora', lat: -23.6, lng: -46.7 },
        { id: 'cN', name: 'Parque das Águas', lat: -23.55, lng: -46.65 },
      ]),
    },
    order: { findMany: vi.fn().mockResolvedValue([]) },
    marketOrder: { findMany: vi.fn().mockResolvedValue([]) },
    deliveryProof: { findMany: vi.fn().mockResolvedValue([]) },
    hookRequest: { findMany: vi.fn().mockResolvedValue([]) },
    setting: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null) },
    defaultRoute: { findUnique: vi.fn().mockResolvedValue(null) },
  }
}

beforeEach(() => vi.clearAllMocks())

describe('describeChange', () => {
  const names = new Map([['a', 'Aurora'], ['b', 'Bela Vista'], ['c', 'Jardins']])
  it('troca de dois prédios', () => expect(describeChange(['c', 'a', 'b'], ['c', 'b', 'a'], names)).toBe('Trocou Aurora ↔ Bela Vista'))
  it('mudança maior', () => expect(describeChange(['a', 'b', 'c'], ['c', 'a', 'b'], names)).toBe('Mudou a ordem de 3 prédios'))
})

describe('A4 · getRoute', () => {
  it('rota salva + sugestão nova com a diferença de km e as alterações do entregador', async () => {
    const prisma = prismaMock()
    prisma.courierRun.findMany.mockResolvedValue([{ id: 'r1', date: '2026-09-30', condominiumIds: ['cB', 'cA'], plannedKm: 9.8 }])
    const view = await new AdminCourierRoutesService({ prisma } as never).getRoute('k1', 'manha', now)
    expect(view.slot).toMatchObject({ slotId: 'manha', label: 'Manhã' })
    expect(view.saved).toMatchObject({ condominiumIds: ['cA', 'cB'], km: 9.2 })
    expect(view.suggestion).toMatchObject({ reason: 'NEW_CONDO', newIds: ['cN'], km: 8.1, deltaKm: -1.1 })
    expect(view.changes).toEqual([{ runId: 'r1', date: '2026-09-30', condominiumIds: ['cB', 'cA'], km: 9.8, description: 'Trocou Residencial Jardins ↔ Edifício Aurora' }])
    expect(prisma.courierRun.findMany.mock.calls[0][0].where).toMatchObject({ courierId: 'k1', slotId: 'manha', reordered: true, date: { gte: '2026-09-02' } })
  })

  it('sem rota própria e com rota padrão: segue a padrão com os prédios dele; a 1ª sugestão antiga some', async () => {
    const prisma = prismaMock()
    prisma.courierRouteTemplate.findUnique.mockResolvedValue({
      acceptedAt: null,
      condominiumIds: [],
      suggestion: { condominiumIds: ['cA', 'cB'], km: 8, durationMin: 60, reason: 'FIRST', newIds: [], removedIds: [], createdAt: '2026-09-28T10:00:00Z' },
    })
    prisma.defaultRoute.findUnique.mockResolvedValue({ key: 'global', condominiumIds: ['cB', 'cN', 'cA'] })
    prisma.order.findMany.mockResolvedValue([{ condominiumId: 'cA' }, { condominiumId: 'cB' }, { condominiumId: null }])
    prisma.courierRun.findMany.mockResolvedValue([{ id: 'r1', date: '2026-09-30', condominiumIds: ['cA', 'cB'], plannedKm: 9.8 }])
    const view = await new AdminCourierRoutesService({ prisma } as never).getRoute('k1', 'manha', now)
    expect(view.followsDefault).toBe(true)
    expect(view.saved).toBeNull()
    expect(view.suggestion).toBeNull()
    expect(view.defaultOrder).toMatchObject({ condominiumIds: ['cB', 'cA'], km: 9.2 })
    // A troca é contada contra a padrão, não contra uma rota salva que não existe.
    expect(view.changes[0].description).toBe('Trocou Edifício Aurora ↔ Residencial Jardins')
    const where = prisma.order.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({ courierId: 'k1', slotId: 'manha' })
    expect(where.scheduledDate.gte.toISOString()).toBe('2026-09-02T03:00:00.000Z')
  })

  it('com rota própria: não segue a padrão, mas a A4 recebe a padrão para o "Voltar"', async () => {
    const prisma = prismaMock()
    prisma.defaultRoute.findUnique.mockResolvedValue({ key: 'global', condominiumIds: ['cB', 'cA'] })
    const view = await new AdminCourierRoutesService({ prisma } as never).getRoute('k1', 'manha', now)
    expect(view.followsDefault).toBe(false)
    expect(view.suggestion).toMatchObject({ reason: 'NEW_CONDO' })
    expect(view.defaultOrder?.condominiumIds).toEqual(['cB', 'cA'])
  })

  it('quem não é entregador ou turno inexistente → 404', async () => {
    const prisma = prismaMock()
    prisma.user.findUnique.mockResolvedValue({ id: 'x', name: 'Cliente', role: 'CLIENT' })
    await expect(new AdminCourierRoutesService({ prisma } as never).getRoute('x', 'manha', now)).rejects.toMatchObject({ statusCode: 404 })
    const ok = prismaMock()
    await expect(new AdminCourierRoutesService({ prisma: ok } as never).getRoute('k1', 'madrugada', now)).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('A2 · live', () => {
  it('progresso, sem foto, posição (esmaecida quando velha) e paradas para os filtros', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      { userId: 'u1', courierId: 'k1', slotId: 'manha', status: 'DELIVERED', condominiumId: 'cA', deliveredAt: new Date('2026-10-02T08:31:00Z'), failedAt: null, failureCode: null },
      { userId: 'u2', courierId: 'k1', slotId: 'manha', status: 'NOT_DELIVERED', condominiumId: 'cA', deliveredAt: null, failedAt: new Date('2026-10-02T08:47:00Z'), failureCode: 'PORTARIA_NAO_LIBEROU' },
      { userId: 'u3', courierId: 'k1', slotId: 'manha', status: 'OUT_FOR_DELIVERY', condominiumId: 'cB', deliveredAt: null, failedAt: null, failureCode: null },
    ])
    prisma.courierRun.findMany.mockResolvedValue([
      { courierId: 'k1', slotId: 'manha', status: 'STARTED', startedAt: new Date('2026-10-02T08:12:00Z'), endedAt: null, plannedMin: 40, reordered: true, lastLat: -23.5, lastLng: -46.6, lastPosAt: new Date('2026-10-02T09:10:00Z') },
    ])
    prisma.deliveryProof.findMany.mockResolvedValue([
      { courierId: 'k1', userId: 'u1', slotId: 'manha', outcome: 'DELIVERED', status: 'OK', required: true, note: null },
      { courierId: 'k1', userId: 'u2', slotId: 'manha', outcome: 'NOT_DELIVERED', status: 'NONE', required: true, note: 'Local sem luz' },
    ])
    const live = await new AdminCourierRoutesService({ prisma } as never).live(now)
    expect(live.routes).toEqual([
      expect.objectContaining({ courierName: 'Antônio Ribeiro', slotLabel: 'Manhã', state: 'em_rota', done: 2, total: 3, noPhoto: 1, reordered: true, lastPos: expect.objectContaining({ stale: true }) }),
    ])
    expect(live.stops.find((s) => s.clientName === 'Maria')).toMatchObject({ status: 'entregue', time: '05:31', proof: 'ok', noPhoto: false })
    expect(live.stops.find((s) => s.clientName === 'Pedro')).toMatchObject({ status: 'nao_entregue', failureLabel: 'Portaria não liberou', proof: 'sem', noPhoto: true, noPhotoNote: 'Local sem luz' })
    expect(live.stops.find((s) => s.clientName === 'Ana')).toMatchObject({ status: 'pendente', time: null, proof: null })
    expect(live.condos.find((c) => c.id === 'cA')).toMatchObject({ done: true })
    expect(live.condos.find((c) => c.id === 'cB')).toMatchObject({ done: false })
  })

  it('paradas só de gancho entram no progresso: a pendente e a resolvida (pelo comprovante)', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([
      { userId: 'u1', courierId: 'k1', slotId: 'manha', status: 'DELIVERED', condominiumId: 'cA', deliveredAt: new Date('2026-10-02T08:31:00Z'), failedAt: null, failureCode: null },
    ])
    prisma.hookRequest.findMany.mockResolvedValue([{ id: 'h3', userId: 'u3', routeSlotId: 'manha', routeCourierId: 'k1' }])
    prisma.deliveryProof.findMany.mockImplementation(async ({ where }: { where: { hookRequestId?: unknown } }) =>
      where.hookRequestId
        ? [{ hookRequestId: 'h2', courierId: 'k1', userId: 'u2', condominiumId: 'cA', slotId: 'manha', date: '2026-10-02', outcome: 'DELIVERED', status: 'SKIPPED', createdAt: new Date('2026-10-02T08:40:00Z') }]
        : [{ courierId: 'k1', userId: 'u2', slotId: 'manha', outcome: 'DELIVERED', status: 'SKIPPED', required: false, note: null }],
    )
    const live = await new AdminCourierRoutesService({ prisma } as never).live(now)
    expect(live.routes[0]).toMatchObject({ done: 2, total: 3 })
    expect(live.stops.find((s) => s.clientName === 'Pedro')).toMatchObject({ status: 'entregue', time: '05:40', proof: 'pulada' })
    expect(live.stops.find((s) => s.clientName === 'Ana')).toMatchObject({ status: 'pendente', condominiumId: 'cB' })
  })

  it('rota não iniciada não mostra posição', async () => {
    const prisma = prismaMock()
    prisma.order.findMany.mockResolvedValue([{ userId: 'u3', courierId: 'k1', slotId: 'manha', status: 'OUT_FOR_DELIVERY', condominiumId: 'cB', deliveredAt: null, failedAt: null, failureCode: null }])
    prisma.courierRun.findMany.mockResolvedValue([{ courierId: 'k1', slotId: 'manha', status: 'PLANNED', lastLat: 1, lastLng: 1, lastPosAt: now }])
    const live = await new AdminCourierRoutesService({ prisma } as never).live(now)
    expect(live.routes[0]).toMatchObject({ state: 'pronta', lastPos: null, etaEnd: null })
  })
})

describe('rotas HTTP', () => {
  let app: FastifyInstance
  afterEach(async () => app?.close())
  async function build(role: string) {
    app = Fastify()
    app.decorate('prisma', prismaMock() as never)
    app.decorateRequest('user', null)
    app.decorate('authenticate', async (request: { user: unknown }) => {
      request.user = { id: 'adm1', role }
    })
    await app.register(adminCourierRoutesRoute)
    await app.ready()
    return app
  }

  it('não-admin → 403', async () => {
    await build('COURIER')
    expect((await app.inject({ method: 'GET', url: '/admin/couriers/live' })).statusCode).toBe(403)
  })

  it('A4 serializa a rota salva e a sugestão; ordem repetida → 400', async () => {
    await build('ADMIN')
    const res = await app.inject({ method: 'GET', url: '/admin/couriers/66f1a2b3c4d5e6f7a8b9c0d1/routes/manha' })
    expect(res.statusCode).toBe(200)
    expect(res.json().suggestion).toMatchObject({ reason: 'NEW_CONDO', deltaKm: -1.1, geometry: [[-23.5, -46.6]] })
    const bad = await app.inject({ method: 'PUT', url: '/admin/couriers/66f1a2b3c4d5e6f7a8b9c0d1/routes/manha', payload: { condominiumIds: ['66f1a2b3c4d5e6f7a8b9c0d1', '66f1a2b3c4d5e6f7a8b9c0d1'] } })
    expect(bad.statusCode).toBe(400)
  })

  it('A4 serializa quem segue a padrão; voltar à rota padrão sem padrão → 400', async () => {
    await build('ADMIN')
    const res = await app.inject({ method: 'GET', url: '/admin/couriers/66f1a2b3c4d5e6f7a8b9c0d1/routes/manha' })
    expect(res.json()).toMatchObject({ followsDefault: false, defaultOrder: null })
    const reset = await app.inject({ method: 'POST', url: '/admin/couriers/66f1a2b3c4d5e6f7a8b9c0d1/routes/manha/reset' })
    expect(reset.statusCode).toBe(400)
  })

  it('rota padrão: a tela serializa os prédios e os selos; ordem repetida → 400; revisar sem rota → 404', async () => {
    await build('ADMIN')
    const view = await app.inject({ method: 'GET', url: '/admin/default-route' })
    expect(view.statusCode).toBe(200)
    expect(view.json()).toMatchObject({ saved: null, voltaBase: true, outside: [] })
    expect(view.json().condos[0]).toEqual({ id: 'cA', name: 'Residencial Jardins', lat: -23.5, lng: -46.6, approxLocation: false, flag: null, kmAdded: null })
    const bad = await app.inject({ method: 'PUT', url: '/admin/default-route', payload: { condominiumIds: ['66f1a2b3c4d5e6f7a8b9c0d1', '66f1a2b3c4d5e6f7a8b9c0d1'] } })
    expect(bad.statusCode).toBe(400)
    expect((await app.inject({ method: 'POST', url: '/admin/default-route/review' })).statusCode).toBe(404)
  })

  it('busca de endereço exige 3 letras', async () => {
    await build('ADMIN')
    expect((await app.inject({ method: 'GET', url: '/admin/geocode?q=ab' })).statusCode).toBe(400)
  })
})
