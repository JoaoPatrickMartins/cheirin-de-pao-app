// Rota salva × sugestão (D-5): ordem do dia com prédio novo na posição sugerida (D-5c), sugestão
// só quando entra prédio novo, e as ações do admin (usar · manter · ajustar · adotar). Rota padrão
// (plano-rota-padrao): quem não tem rota própria segue a padrão, sem 1ª sugestão; "Voltar à padrão".
import { describe, it, expect, vi, beforeEach } from 'vitest'

const engine = vi.hoisted(() => ({
  planRoute: vi.fn(),
  routeMetrics: vi.fn(async () => ({ km: 8.1, durationMin: 64, geometry: [], legSeconds: [] })),
}))
vi.mock('../../../lib/route-engine.js', () => engine)
const notifyAdmins = vi.hoisted(() => vi.fn())
vi.mock('../../notifications/notifications.service.js', () => ({
  NotificationsService: class {
    notifyAdmins = notifyAdmins
  },
}))
const syncDefaultRoute = vi.hoisted(() => vi.fn(async () => false))
vi.mock('../../../lib/default-route.js', async (orig) => ({ ...(await orig<typeof import('../../../lib/default-route.js')>()), syncDefaultRoute }))

import { acceptSuggestion, adoptRun, dayOrderFrom, ensureSuggestion, keepCurrent, readSuggestion, resetToDefault, resolveDayRoute, saveOrder } from '../courier-plan.js'

function makeFastify(over: { template?: Record<string, unknown> | null; run?: Record<string, unknown> | null; defaultIds?: string[] } = {}) {
  const prisma = {
    courierRouteTemplate: {
      findUnique: vi.fn().mockResolvedValue(over.template ?? null),
      upsert: vi.fn().mockImplementation(async ({ create, update }) => ({ id: 't1', ...(over.template ?? create), ...update })),
      update: vi.fn().mockImplementation(async ({ data }) => ({ id: 't1', ...over.template, ...data })),
    },
    defaultRoute: { findUnique: vi.fn().mockResolvedValue(over.defaultIds ? { key: 'global', condominiumIds: over.defaultIds } : null) },
    courierRun: { findUnique: vi.fn().mockResolvedValue(over.run ?? null) },
    condominium: { findMany: vi.fn().mockResolvedValue([]) },
    setting: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn().mockResolvedValue({ name: 'Antônio Ribeiro' }) },
  }
  return { prisma, fastify: { prisma, log: { warn: vi.fn() } } as never }
}
const condos = (ids: string[]) => ids.map((id) => ({ id, lat: -23.5, lng: -46.6 }))

beforeEach(() => {
  vi.clearAllMocks()
  engine.planRoute.mockImplementation(async ({ stops }: { stops: Array<{ id: string }> }) => ({
    order: [...stops.map((s) => s.id)].sort(),
    km: 8.1,
    durationMin: 64,
    geometry: [],
    legSeconds: [],
    computed: true,
  }))
})

describe('dayOrderFrom (D-5c)', () => {
  it('sem rota salva: a ordem da sugestão, só com os prédios de hoje', () => {
    expect(dayOrderFrom(['a', 'c'], null, ['c', 'b', 'a'])).toEqual(['c', 'a'])
  })

  it('rota salva + prédio novo entra logo depois do vizinho que o precede na sugestão', () => {
    expect(dayOrderFrom(['a', 'b', 'n', 'c'], ['a', 'b', 'c'], ['a', 'b', 'n', 'c'])).toEqual(['a', 'b', 'n', 'c'])
    expect(dayOrderFrom(['a', 'b', 'n'], ['a', 'b'], ['n', 'b', 'a'])).toEqual(['n', 'a', 'b'])
  })

  it('prédio sem entrega hoje é pulado; novo sem posição sugerida vai para o fim', () => {
    expect(dayOrderFrom(['a', 'c', 'z'], ['a', 'b', 'c'], null)).toEqual(['a', 'c', 'z'])
  })
})

describe('ensureSuggestion', () => {
  it('sem rota salva: grava a 1ª sugestão e avisa o admin', async () => {
    const { fastify, prisma } = makeFastify()
    await ensureSuggestion(fastify, { courierId: 'k1', slotId: 'manha', condos: condos(['b', 'a']), slotLabel: 'Manhã' })
    const arg = prisma.courierRouteTemplate.upsert.mock.calls[0][0]
    expect(arg.create).toMatchObject({ courierId: 'k1', slotId: 'manha', condominiumIds: [] })
    expect(readSuggestion(arg.create.suggestion)).toMatchObject({ reason: 'FIRST', condominiumIds: ['a', 'b'], km: 8.1 })
    expect(notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ type: 'ADMIN_ROUTE_SUGGESTION', body: expect.stringContaining('Antônio · Manhã') }))
  })

  it('o mesmo conjunto da rota salva não gera sugestão', async () => {
    const { fastify, prisma } = makeFastify({ template: { acceptedAt: new Date(), condominiumIds: ['a', 'b', 'c'], suggestion: null } })
    await ensureSuggestion(fastify, { courierId: 'k1', slotId: 'manha', condos: condos(['a', 'c']) })
    expect(prisma.courierRouteTemplate.upsert).not.toHaveBeenCalled()
    expect(notifyAdmins).not.toHaveBeenCalled()
  })

  it('prédio novo gera sugestão com a rota inteira; a pendente que já cobre não repete', async () => {
    const { fastify, prisma } = makeFastify({ template: { acceptedAt: new Date(), condominiumIds: ['a', 'b'], suggestion: null } })
    await ensureSuggestion(fastify, { courierId: 'k1', slotId: 'manha', condos: condos(['a', 'n']) })
    const s = readSuggestion(prisma.courierRouteTemplate.upsert.mock.calls[0][0].update.suggestion)
    expect(s).toMatchObject({ reason: 'NEW_CONDO', newIds: ['n'], condominiumIds: ['a', 'b', 'n'] })

    const pending = makeFastify({ template: { acceptedAt: new Date(), condominiumIds: ['a', 'b'], suggestion: s } })
    await ensureSuggestion(pending.fastify, { courierId: 'k1', slotId: 'manha', condos: condos(['a', 'n']) })
    expect(pending.prisma.courierRouteTemplate.upsert).not.toHaveBeenCalled()
  })

  it('OSRM fora: não grava sugestão (tenta de novo depois)', async () => {
    engine.planRoute.mockResolvedValueOnce({ order: ['a', 'b'], km: null, durationMin: null, geometry: [], legSeconds: [], computed: false })
    const { fastify, prisma } = makeFastify()
    await ensureSuggestion(fastify, { courierId: 'k1', slotId: 'manha', condos: condos(['a', 'b']) })
    expect(prisma.courierRouteTemplate.upsert).not.toHaveBeenCalled()
  })
})

describe('resolveDayRoute', () => {
  it('a sugestão pendente posiciona o prédio novo; a ordem do entregador vale no dia', async () => {
    const suggestion = { condominiumIds: ['a', 'n', 'b'], reason: 'NEW_CONDO', newIds: ['n'], km: 1, durationMin: 1, removedIds: [], createdAt: '' }
    const template = { acceptedAt: new Date(), condominiumIds: ['a', 'b'], suggestion }
    const one = makeFastify({ template })
    const day = await resolveDayRoute(one.fastify, { courierId: 'k1', slotId: 'manha', date: '2026-10-02', condos: condos(['a', 'b', 'n']) })
    expect(day).toMatchObject({ order: ['a', 'n', 'b'], source: 'TEMPLATE', pendingSuggestion: true, reorderedToday: false })

    const two = makeFastify({ template, run: { condominiumIds: ['b', 'a', 'n'], reordered: true } })
    const day2 = await resolveDayRoute(two.fastify, { courierId: 'k1', slotId: 'manha', date: '2026-10-02', condos: condos(['a', 'b', 'n']) })
    expect(day2).toMatchObject({ order: ['b', 'a', 'n'], source: 'RUN', reorderedToday: true })

    const three = await resolveDayRoute(two.fastify, { courierId: 'k1', slotId: 'manha', date: '2026-10-02', condos: condos(['a', 'b', 'n']), ignoreRun: true })
    expect(three.order).toEqual(['a', 'n', 'b'])
  })
})

describe('ações do admin (A4)', () => {
  const pending = { condominiumIds: ['a', 'n', 'b'], reason: 'NEW_CONDO', newIds: ['n'], km: 7, durationMin: 60, removedIds: [], createdAt: '' }

  it('usar sugestão: vira a rota salva e a sugestão some', async () => {
    const { prisma } = makeFastify({ template: { acceptedAt: new Date(), condominiumIds: ['b', 'a'], suggestion: pending } })
    await acceptSuggestion(prisma as never, 'k1', 'manha', 'adm1')
    const arg = prisma.courierRouteTemplate.upsert.mock.calls[0][0]
    expect(arg.update).toMatchObject({ condominiumIds: ['a', 'n', 'b'], acceptedById: 'adm1', suggestion: null, km: 8.1, durationMin: 64 })
  })

  it('histórico (A9): o aceite guarda o km da alternativa evitada; o 1º aceite e o manter não', async () => {
    engine.routeMetrics.mockResolvedValueOnce({ km: 9.4, durationMin: 70, geometry: [], legSeconds: [] }) // alternativa: salva + novo
    const old = [{ at: '2026-09-01T10:00:00.000Z', date: '2026-09-01', kind: 'ADJUST', km: 9, kmAlt: null }]
    const { prisma } = makeFastify({ template: { acceptedAt: new Date(), condominiumIds: ['b', 'a'], suggestion: pending, acceptLog: old } })
    await acceptSuggestion(prisma as never, 'k1', 'manha', 'adm1')
    const log = prisma.courierRouteTemplate.upsert.mock.calls[0][0].update.acceptLog
    expect(log).toHaveLength(2)
    expect(log[1]).toMatchObject({ kind: 'ACCEPT', km: 8.1, kmAlt: 9.4 })
    const altArg = (engine.routeMetrics.mock.calls[0] as unknown as [{ stops: Array<{ id: string }> }])[0]
    expect(altArg.stops.map((x) => x.id)).toEqual(['b', 'a', 'n'])

    const first = makeFastify({ template: { condominiumIds: [], suggestion: { ...pending, reason: 'FIRST', newIds: [] } } })
    await acceptSuggestion(first.prisma as never, 'k1', 'manha', 'adm1')
    expect(first.prisma.courierRouteTemplate.upsert.mock.calls[0][0].update.acceptLog).toEqual([expect.objectContaining({ kind: 'ACCEPT', kmAlt: null })])

    const keep = makeFastify({ template: { acceptedAt: new Date(), condominiumIds: ['b', 'a'], suggestion: pending } })
    await keepCurrent(keep.prisma as never, 'k1', 'manha', 'adm1')
    expect(keep.prisma.courierRouteTemplate.upsert.mock.calls[0][0].update.acceptLog).toEqual([expect.objectContaining({ kind: 'KEEP', kmAlt: null })])
  })

  it('manter a atual: ordem salva + prédio novo na posição sugerida', async () => {
    const { prisma } = makeFastify({ template: { acceptedAt: new Date(), condominiumIds: ['b', 'a'], suggestion: pending } })
    await keepCurrent(prisma as never, 'k1', 'manha', 'adm1')
    expect(prisma.courierRouteTemplate.upsert.mock.calls[0][0].update.condominiumIds).toEqual(['b', 'a', 'n'])
  })

  it('manter sem rota salva (1ª sugestão) → 400; sem sugestão → 404', async () => {
    const first = makeFastify({ template: { acceptedAt: null, condominiumIds: [], suggestion: { ...pending, reason: 'FIRST' } } })
    await expect(keepCurrent(first.prisma as never, 'k1', 'manha', 'adm1')).rejects.toMatchObject({ statusCode: 400 })
    const none = makeFastify({ template: { acceptedAt: new Date(), condominiumIds: ['a'], suggestion: null } })
    await expect(acceptSuggestion(none.prisma as never, 'k1', 'manha', 'adm1')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('ajustar: salva a ordem do admin; repetida → 400', async () => {
    const { prisma } = makeFastify()
    await saveOrder(prisma as never, 'k1', 'manha', ['c', 'a'], 'adm1')
    expect(prisma.courierRouteTemplate.upsert.mock.calls[0][0].create).toMatchObject({ condominiumIds: ['c', 'a'], acceptedById: 'adm1' })
    await expect(saveOrder(prisma as never, 'k1', 'manha', ['a', 'a'], 'adm1')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('adotar a ordem do entregador: a do dia + os outros prédios da rota salva, cada um depois do vizinho de antes', async () => {
    const { prisma } = makeFastify({ template: { acceptedAt: new Date(), condominiumIds: ['a', 'b', 'c'], suggestion: null } })
    prisma.courierRun.findUnique.mockResolvedValue({ id: 'r1', courierId: 'k1', slotId: 'manha', condominiumIds: ['b', 'a'] })
    await adoptRun(prisma as never, 'k1', 'manha', 'r1', 'adm1')
    // "c" vinha logo depois de "b" na rota salva: continua colado nele.
    expect(prisma.courierRouteTemplate.upsert.mock.calls[0][0].update.condominiumIds).toEqual(['b', 'c', 'a'])
    prisma.courierRun.findUnique.mockResolvedValue({ id: 'r2', courierId: 'outro', slotId: 'manha', condominiumIds: [] })
    await expect(adoptRun(prisma as never, 'k1', 'manha', 'r2', 'adm1')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('rota padrão (plano-rota-padrao)', () => {
  it('sem rota própria: não gera a 1ª sugestão nem avisa — o turno segue a padrão', async () => {
    const { fastify, prisma } = makeFastify({ defaultIds: ['b', 'a'] })
    await ensureSuggestion(fastify, { courierId: 'k1', slotId: 'manha', condos: condos(['a', 'b']) })
    expect(prisma.courierRouteTemplate.upsert).not.toHaveBeenCalled()
    expect(notifyAdmins).not.toHaveBeenCalled()
  })

  it('com rota própria: prédio novo segue o fluxo de sempre (NEW_CONDO), mesmo com padrão', async () => {
    const { fastify, prisma } = makeFastify({ defaultIds: ['n', 'a', 'b'], template: { acceptedAt: new Date(), condominiumIds: ['a', 'b'], suggestion: null } })
    await ensureSuggestion(fastify, { courierId: 'k1', slotId: 'manha', condos: condos(['a', 'n']) })
    expect(readSuggestion(prisma.courierRouteTemplate.upsert.mock.calls[0][0].update.suggestion)).toMatchObject({ reason: 'NEW_CONDO', newIds: ['n'] })
  })

  it('ordem do dia: a padrão só com os prédios de hoje; uma 1ª sugestão antiga fica ignorada', async () => {
    const stale = { condominiumIds: ['a', 'c', 'b'], reason: 'FIRST', newIds: [], km: 1, durationMin: 1, removedIds: [], createdAt: '' }
    const { fastify } = makeFastify({ defaultIds: ['c', 'x', 'b', 'a'], template: { condominiumIds: [], suggestion: stale } })
    const day = await resolveDayRoute(fastify, { courierId: 'k1', slotId: 'manha', date: '2026-10-06', condos: condos(['a', 'b', 'c']) })
    expect(day).toMatchObject({ order: ['c', 'b', 'a'], source: 'DEFAULT', pendingSuggestion: false })
    expect(syncDefaultRoute).not.toHaveBeenCalled()
  })

  it('a rota própria vale por cima da padrão; a ordem do entregador no dia vale por cima das duas', async () => {
    const own = makeFastify({ defaultIds: ['c', 'b', 'a'], template: { acceptedAt: new Date(), condominiumIds: ['a', 'b', 'c'], suggestion: null } })
    const day = await resolveDayRoute(own.fastify, { courierId: 'k1', slotId: 'manha', date: '2026-10-06', condos: condos(['a', 'b', 'c']) })
    expect(day).toMatchObject({ order: ['a', 'b', 'c'], source: 'TEMPLATE' })
    expect(own.prisma.defaultRoute.findUnique).not.toHaveBeenCalled()

    const run = makeFastify({ defaultIds: ['c', 'b', 'a'], run: { condominiumIds: ['b', 'c', 'a'], reordered: true } })
    expect(await resolveDayRoute(run.fastify, { courierId: 'k1', slotId: 'manha', date: '2026-10-06', condos: condos(['a', 'b', 'c']) })).toMatchObject({ order: ['b', 'c', 'a'], source: 'RUN' })
  })

  it('prédio do dia com localização fora da padrão: tenta encaixar antes e usa a ordem nova', async () => {
    const { fastify, prisma } = makeFastify({ defaultIds: ['b', 'a'] })
    syncDefaultRoute.mockResolvedValueOnce(true)
    prisma.defaultRoute.findUnique.mockResolvedValueOnce({ key: 'global', condominiumIds: ['b', 'a'] }).mockResolvedValueOnce({ key: 'global', condominiumIds: ['b', 'n', 'a'] })
    const day = await resolveDayRoute(fastify, { courierId: 'k1', slotId: 'manha', date: '2026-10-06', condos: condos(['a', 'b', 'n']) })
    expect(syncDefaultRoute).toHaveBeenCalledTimes(1)
    expect(day.order).toEqual(['b', 'n', 'a'])
  })

  it('sem rota padrão: o fluxo da 1ª sugestão continua', async () => {
    const { fastify, prisma } = makeFastify()
    const day = await resolveDayRoute(fastify, { courierId: 'k1', slotId: 'manha', date: '2026-10-06', condos: condos(['b', 'a']) })
    expect(day.source).toBe('SUGGESTION')
    expect(prisma.courierRouteTemplate.upsert).toHaveBeenCalled()
  })

  it('voltar à rota padrão: limpa a rota própria e mantém o histórico; sem padrão → 400', async () => {
    const acceptLog = [{ at: '', date: '2026-09-01', kind: 'ADJUST', km: 9, kmAlt: null }]
    const { prisma } = makeFastify({ defaultIds: ['a', 'b'], template: { id: 't1', acceptedAt: new Date(), condominiumIds: ['b', 'a'], suggestion: null, acceptLog } })
    await resetToDefault(prisma as never, 'k1', 'manha')
    const arg = prisma.courierRouteTemplate.update.mock.calls[0][0]
    expect(arg.data).toEqual({ condominiumIds: [], km: null, durationMin: null, acceptedAt: null, acceptedById: null, suggestion: null })
    expect(arg.data).not.toHaveProperty('acceptLog')

    const none = makeFastify({ template: { id: 't1', acceptedAt: new Date(), condominiumIds: ['a'] } })
    await expect(resetToDefault(none.prisma as never, 'k1', 'manha')).rejects.toMatchObject({ statusCode: 400 })
  })
})
