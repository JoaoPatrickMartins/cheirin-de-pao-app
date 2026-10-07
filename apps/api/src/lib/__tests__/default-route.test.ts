// Rota padrão (plano-rota-padrao): sugerir sem gravar, salvar (ignora o inválido, solta as 1ªs
// sugestões, encaixa o que falta), encaixe automático (novo, reencaixado, OSRM fora, conflito) e as
// visões do admin (tela e card da A5).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const engine = vi.hoisted(() => ({
  planRoute: vi.fn(),
  routeMetrics: vi.fn(),
  insertStops: vi.fn(),
}))
vi.mock('../route-engine.js', () => engine)
const notifyAdmins = vi.hoisted(() => vi.fn())
vi.mock('../../modules/notifications/notifications.service.js', () => ({
  NotificationsService: class {
    notifyAdmins = notifyAdmins
  },
}))

import {
  defaultRouteSummary,
  defaultRouteView,
  readAutoPlaced,
  refreshDefaultRouteMetrics,
  reviewDefaultRoute,
  saveDefaultRoute,
  suggestDefaultRoute,
  syncDefaultRoute,
} from '../default-route.js'

type Condo = { id: string; name: string; lat: number | null; lng: number | null; approxLocation?: boolean; isActive?: boolean }
type Route = {
  key: string
  condominiumIds: string[]
  km: number | null
  durationMin: number | null
  autoPlaced: unknown
  savedAt: Date | null
  savedById: string | null
  updatedAt: Date
}

const T0 = new Date('2026-10-01T10:00:00Z')
const NOW = new Date('2026-10-06T12:00:00Z')

const c = (id: string, name: string, extra: Partial<Condo> = {}): Condo => ({ id, name, lat: -23.5, lng: -46.6, approxLocation: false, isActive: true, ...extra })

/** Banco em memória: a rota padrão muda de verdade, e o `updatedAt` anda a cada gravação. */
function makeDb(opts: { route?: Partial<Route> | null; condos?: Condo[]; base?: boolean; templates?: unknown[] } = {}) {
  let route: Route | null = opts.route
    ? { key: 'global', condominiumIds: [], km: null, durationMin: null, autoPlaced: null, savedAt: null, savedById: null, updatedAt: T0, ...opts.route }
    : null
  const bump = () => new Date((route?.updatedAt ?? T0).getTime() + 1000)
  const condos = opts.condos ?? []
  const prisma = {
    defaultRoute: {
      findUnique: vi.fn(async () => (route ? { ...route } : null)),
      upsert: vi.fn(async ({ create, update }: { create: Route; update: Partial<Route> }) => {
        route = route ? { ...route, ...update, updatedAt: bump() } : { ...create, updatedAt: bump() }
        return route
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { updatedAt: Date }; data: Partial<Route> }) => {
        if (!route || where.updatedAt.getTime() !== route.updatedAt.getTime()) return { count: 0 }
        route = { ...route, ...data, updatedAt: bump() }
        return { count: 1 }
      }),
      update: vi.fn(async ({ data }: { data: Partial<Route> }) => {
        route = { ...route!, ...data, updatedAt: bump() }
        return route
      }),
    },
    condominium: {
      findMany: vi.fn(async ({ where }: { where?: { isActive?: boolean } }) => condos.filter((x) => where?.isActive === undefined || x.isActive === where.isActive)),
    },
    courierRouteTemplate: {
      findMany: vi.fn(async () => opts.templates ?? []),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    setting: {
      findMany: vi.fn(async () =>
        opts.base
          ? [
              { key: 'rotaBaseEndereco', value: 'Padaria' },
              { key: 'rotaBaseLat', value: '-23.5' },
              { key: 'rotaBaseLng', value: '-46.6' },
            ]
          : [],
      ),
    },
    user: { findUnique: vi.fn(async () => ({ name: 'João Martins' })) },
  }
  const warn = vi.fn()
  return { prisma, fastify: { prisma, log: { warn } } as never, warn, get route() { return route } }
}

const ids = (stops: Array<{ id: string }>) => stops.map((s) => s.id)

beforeEach(() => {
  vi.clearAllMocks()
  // km = 2 por prédio; o traçado só existe com 2 pontos ou mais.
  engine.routeMetrics.mockImplementation(async ({ stops }: { stops: Array<{ id: string }> }) => ({ km: stops.length * 2, durationMin: stops.length * 5, geometry: [[-23.5, -46.6]], legSeconds: [] }))
  engine.planRoute.mockImplementation(async ({ stops }: { stops: Array<{ id: string }> }) => ({ order: ids(stops).reverse(), km: 3.5, durationMin: 20, geometry: [[1, 1]], legSeconds: [], computed: true }))
  // Encaixa sempre na 2ª posição.
  engine.insertStops.mockImplementation(async ({ order, add }: { order: Array<{ id: string }>; add: Array<{ id: string }> }) => ({
    order: [...ids(order).slice(0, 1), ...ids(add), ...ids(order).slice(1)],
    computed: true,
  }))
})

describe('readAutoPlaced', () => {
  it('ignora o que não tem o formato', () => {
    expect(readAutoPlaced([{ id: 'a', kind: 'NOVO', at: 'x', kmAdded: 1.2 }, { id: 'b', kind: 'OUTRO' }, null, { kind: 'NOVO' }])).toEqual([{ id: 'a', kind: 'NOVO', at: 'x', kmAdded: 1.2 }])
    expect(readAutoPlaced(null)).toEqual([])
  })
})

describe('suggestDefaultRoute', () => {
  it('só ativos com localização, saindo da base com a volta; não grava', async () => {
    const db = makeDb({ base: true, condos: [c('a', 'Aurora'), c('b', 'Bela Vista'), c('x', 'Sem mapa', { lat: null, lng: null }), c('i', 'Inativo', { isActive: false })] })
    const s = await suggestDefaultRoute(db.prisma as never)
    const arg = engine.planRoute.mock.calls[0][0]
    expect(ids(arg.stops)).toEqual(['a', 'b'])
    expect(arg).toMatchObject({ base: { lat: -23.5, lng: -46.6 }, returnToBase: true })
    expect(s).toMatchObject({ condominiumIds: ['b', 'a'], km: 3.5, computed: true, deltaKm: null })
    expect(db.prisma.defaultRoute.upsert).not.toHaveBeenCalled()
  })

  it('com rota salva: diferença de km contra a salva', async () => {
    const db = makeDb({ route: { condominiumIds: ['a', 'b'] }, condos: [c('a', 'Aurora'), c('b', 'Bela Vista')] })
    expect((await suggestDefaultRoute(db.prisma as never)).deltaKm).toBe(-0.5)
  })

  it('OSRM fora: computed false, sem km', async () => {
    engine.planRoute.mockResolvedValueOnce({ order: ['a', 'b'], km: null, durationMin: null, geometry: [], legSeconds: [], computed: false })
    const db = makeDb({ condos: [c('a', 'Aurora'), c('b', 'Bela Vista')] })
    expect(await suggestDefaultRoute(db.prisma as never)).toMatchObject({ computed: false, km: null, deltaKm: null })
  })

  it('nenhum condomínio: lista vazia, sem chamar o motor', async () => {
    const db = makeDb()
    expect(await suggestDefaultRoute(db.prisma as never)).toMatchObject({ condominiumIds: [], computed: true })
    expect(engine.planRoute).not.toHaveBeenCalled()
  })
})

describe('saveDefaultRoute', () => {
  it('lista vazia ou repetida → 400', async () => {
    const db = makeDb({ condos: [c('a', 'Aurora')] })
    await expect(saveDefaultRoute(db.fastify, [], 'adm1')).rejects.toMatchObject({ statusCode: 400 })
    await expect(saveDefaultRoute(db.fastify, ['a', 'a'], 'adm1')).rejects.toMatchObject({ statusCode: 400 })
    await expect(saveDefaultRoute(db.fastify, ['zz'], 'adm1')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('grava a ordem, ignora o inválido, limpa os selos e solta só as 1ªs sugestões', async () => {
    const templates = [
      { id: 't1', acceptedAt: null, suggestion: { reason: 'FIRST' } },
      { id: 't2', acceptedAt: new Date(), suggestion: { reason: 'NEW_CONDO' } },
      { id: 't3', acceptedAt: null, suggestion: null },
    ]
    const db = makeDb({ route: { condominiumIds: ['a'], autoPlaced: [{ id: 'a', kind: 'NOVO', at: '', kmAdded: 1 }] }, condos: [c('a', 'Aurora'), c('b', 'Bela Vista')], templates })
    await saveDefaultRoute(db.fastify, ['b', 'zz', 'a'], 'adm1', NOW)
    expect(db.route).toMatchObject({ condominiumIds: ['b', 'a'], km: 4, durationMin: 10, autoPlaced: [], savedAt: NOW, savedById: 'adm1' })
    expect(db.prisma.courierRouteTemplate.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['t1'] } }, data: { suggestion: null } })
    expect(notifyAdmins).not.toHaveBeenCalled()
  })

  it('prédio cadastrado enquanto o admin editava: encaixa logo depois, como novo', async () => {
    const db = makeDb({ condos: [c('a', 'Aurora'), c('b', 'Bela Vista'), c('n', 'Novo')] })
    await saveDefaultRoute(db.fastify, ['a', 'b'], 'adm1', NOW)
    expect(db.route!.condominiumIds).toEqual(['a', 'n', 'b'])
    expect(readAutoPlaced(db.route!.autoPlaced)).toEqual([{ id: 'n', kind: 'NOVO', at: NOW.toISOString(), kmAdded: 2 }])
  })
})

describe('syncDefaultRoute', () => {
  it('sem rota padrão: não faz nada', async () => {
    const db = makeDb({ condos: [c('a', 'Aurora')] })
    expect(await syncDefaultRoute(db.fastify)).toBe(false)
    expect(db.prisma.defaultRoute.updateMany).not.toHaveBeenCalled()
  })

  it('nada mudou: não grava (idempotente)', async () => {
    const db = makeDb({ route: { condominiumIds: ['a', 'b'] }, condos: [c('a', 'Aurora'), c('b', 'Bela Vista')] })
    expect(await syncDefaultRoute(db.fastify)).toBe(false)
    expect(db.prisma.defaultRoute.updateMany).not.toHaveBeenCalled()
    expect(engine.routeMetrics).not.toHaveBeenCalled()
  })

  it('tira inativo, apagado e sem localização (com os selos deles), sem aviso', async () => {
    const db = makeDb({
      route: { condominiumIds: ['a', 'i', 'x', 'gone', 'b'], autoPlaced: [{ id: 'i', kind: 'NOVO', at: '', kmAdded: 1 }] },
      condos: [c('a', 'Aurora'), c('b', 'Bela Vista'), c('i', 'Inativo', { isActive: false }), c('x', 'Sem mapa', { lat: null, lng: null })],
    })
    expect(await syncDefaultRoute(db.fastify, { now: NOW })).toBe(true)
    expect(db.route).toMatchObject({ condominiumIds: ['a', 'b'], km: 4, autoPlaced: [] })
    expect(notifyAdmins).not.toHaveBeenCalled()
  })

  it('prédio novo encaixa, ganha o selo com o km somado e o admin é avisado', async () => {
    const db = makeDb({ route: { condominiumIds: ['a', 'b'] }, condos: [c('a', 'Aurora'), c('b', 'Bela Vista'), c('n', 'Parque das Águas')] })
    expect(await syncDefaultRoute(db.fastify, { now: NOW })).toBe(true)
    expect(db.route!.condominiumIds).toEqual(['a', 'n', 'b'])
    expect(readAutoPlaced(db.route!.autoPlaced)).toEqual([{ id: 'n', kind: 'NOVO', at: NOW.toISOString(), kmAdded: 2 }])
    expect(notifyAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADMIN_ROUTE_SUGGESTION',
        title: 'Rota padrão',
        body: 'Parque das Águas entrou na posição 2 (+2,0 km). Revise em Rotas e comprovante.',
        dedupeKey: 'default-route:n:NOVO:2026-10-06',
      }),
    )
  })

  it('mudou de lugar: sai da posição antiga e reencaixa', async () => {
    const db = makeDb({ route: { condominiumIds: ['a', 'b', 'm'] }, condos: [c('a', 'Aurora'), c('b', 'Bela Vista'), c('m', 'Mudou')] })
    await syncDefaultRoute(db.fastify, { moved: ['m'], now: NOW })
    expect(ids(engine.insertStops.mock.calls[0][0].order)).toEqual(['a', 'b'])
    expect(db.route!.condominiumIds).toEqual(['a', 'm', 'b'])
    expect(readAutoPlaced(db.route!.autoPlaced)).toEqual([{ id: 'm', kind: 'REENCAIXADO', at: NOW.toISOString(), kmAdded: 0 }])
    expect(notifyAdmins.mock.calls[0][0].body).toBe('Mudou mudou de endereço e foi para a posição 2 (+0,0 km). Revise em Rotas e comprovante.')
  })

  it('OSRM fora: grava só as remoções; o que mudou fica onde estava e o novo fica de fora', async () => {
    engine.insertStops.mockResolvedValue({ order: [], computed: false })
    engine.routeMetrics.mockResolvedValue({ km: null, durationMin: null, geometry: [], legSeconds: [] })
    const db = makeDb({
      route: { condominiumIds: ['a', 'm', 'i'], km: 9 },
      condos: [c('a', 'Aurora'), c('m', 'Mudou'), c('n', 'Novo'), c('i', 'Inativo', { isActive: false })],
    })
    expect(await syncDefaultRoute(db.fastify, { moved: ['m'] })).toBe(true)
    expect(db.route).toMatchObject({ condominiumIds: ['a', 'm'], km: 9, autoPlaced: [] })
    expect(notifyAdmins).not.toHaveBeenCalled()
  })

  it('conflito de gravação: relê e refaz uma vez', async () => {
    const db = makeDb({ route: { condominiumIds: ['a'] }, condos: [c('a', 'Aurora'), c('n', 'Novo')] })
    db.prisma.defaultRoute.updateMany.mockResolvedValueOnce({ count: 0 })
    expect(await syncDefaultRoute(db.fastify)).toBe(true)
    expect(db.prisma.defaultRoute.updateMany).toHaveBeenCalledTimes(2)
    expect(db.route!.condominiumIds).toEqual(['a', 'n'])
  })

  it('erro no banco: avisa no log e não lança', async () => {
    const db = makeDb({ route: { condominiumIds: ['a'] } })
    db.prisma.condominium.findMany.mockRejectedValueOnce(new Error('mongo fora'))
    expect(await syncDefaultRoute(db.fastify)).toBe(false)
    expect(db.warn).toHaveBeenCalled()
  })
})

describe('visões do admin', () => {
  it('tela: rota salva (sem os inválidos), quem salvou, selos e os sem localização', async () => {
    const db = makeDb({
      route: { condominiumIds: ['b', 'a'], savedAt: T0, savedById: 'adm1', autoPlaced: [{ id: 'a', kind: 'NOVO', at: '', kmAdded: 0.8 }] },
      condos: [c('a', 'Aurora', { approxLocation: true }), c('b', 'Bela Vista'), c('x', 'Sem mapa', { lat: null, lng: null })],
    })
    const v = await defaultRouteView(db.fastify)
    expect(v.saved).toMatchObject({ condominiumIds: ['b', 'a'], km: 4, durationMin: 10, savedAt: T0.toISOString(), savedByName: 'João Martins' })
    expect(v.condos).toEqual([
      expect.objectContaining({ id: 'a', approxLocation: true, flag: 'NOVO', kmAdded: 0.8 }),
      expect.objectContaining({ id: 'b', flag: null, kmAdded: null }),
    ])
    expect(v.outside).toEqual([{ id: 'x', name: 'Sem mapa' }])
  })

  it('tela sem rota padrão: saved null', async () => {
    const db = makeDb({ condos: [c('a', 'Aurora')] })
    expect((await defaultRouteView(db.fastify)).saved).toBeNull()
  })

  it('card da A5: null sem rota; contagens sem chamar o OSRM', async () => {
    expect(await defaultRouteSummary(makeDb().prisma as never)).toBeNull()
    const db = makeDb({
      route: { condominiumIds: ['a', 'b'], km: 7.4, durationMin: 31, savedAt: T0, autoPlaced: [{ id: 'b', kind: 'NOVO', at: '', kmAdded: 1 }] },
      condos: [c('a', 'Aurora'), c('b', 'Bela Vista'), c('x', 'Sem mapa', { lat: null, lng: null })],
    })
    expect(await defaultRouteSummary(db.prisma as never)).toEqual({ count: 2, km: 7.4, durationMin: 31, savedAt: T0.toISOString(), toReview: 1, outside: 1 })
    expect(engine.routeMetrics).not.toHaveBeenCalled()
  })

  it('"Está bom assim": limpa os selos; 404 sem rota', async () => {
    await expect(reviewDefaultRoute(makeDb().prisma as never)).rejects.toMatchObject({ statusCode: 404 })
    const db = makeDb({ route: { condominiumIds: ['a'], autoPlaced: [{ id: 'a', kind: 'NOVO', at: '', kmAdded: 1 }] } })
    await reviewDefaultRoute(db.prisma as never)
    expect(db.route!.autoPlaced).toEqual([])
  })

  it('base ou volta mudaram: recalcula o km guardado', async () => {
    const db = makeDb({ route: { condominiumIds: ['a', 'b'], km: 1 }, condos: [c('a', 'Aurora'), c('b', 'Bela Vista')] })
    await refreshDefaultRouteMetrics(db.fastify)
    expect(db.route).toMatchObject({ km: 4, durationMin: 10 })
  })
})
