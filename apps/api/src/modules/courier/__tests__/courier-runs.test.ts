// Rota do dia (E8–E10): "Saiu para entrega" uma vez só, início automático na 1ª confirmação,
// posição só com a rota iniciada, reordenar só com permissão, encerrar com pendência → 422.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const plan = vi.hoisted(() => ({
  resolveDayRoute: vi.fn(async () => ({ order: ['cA', 'cB'], metrics: { km: 9.6, durationMin: 70, geometry: [], legSeconds: [] }, run: null, template: null, source: 'TEMPLATE', pendingSuggestion: false, reorderedToday: false })),
  metricsForOrder: vi.fn(async () => ({ km: 9.8, durationMin: 72, geometry: [], legSeconds: [] })),
}))
vi.mock('../courier-plan.js', () => plan)
const notifyUser = vi.hoisted(() => vi.fn())
vi.mock('../../notifications/notifications.service.js', () => ({
  NotificationsService: class {
    notifyUser = notifyUser
  },
}))

import { CourierRunService, courierRunSummary } from '../courier-runs.js'

const now = new Date('2026-10-02T09:00:00.000Z') // 06:00 BRT
const order = (id: string, userId: string, status = 'OUT_FOR_DELIVERY', quantity = 4) => ({ id, userId, quantity, status, condominiumId: userId === 'u3' ? 'cB' : 'cA' })

function setup(over: { run?: Record<string, unknown> | null; orders?: unknown[]; markets?: unknown[]; rules?: unknown; proofs?: unknown[]; vehicle?: unknown; settings?: Array<{ key: string; value: string }> } = {}) {
  const prisma = {
    courierRun: {
      findUnique: vi.fn().mockResolvedValue(over.run ?? null),
      upsert: vi.fn().mockImplementation(async ({ create }) => ({ id: 'run-1', ...create })),
      update: vi.fn().mockImplementation(async ({ data }) => ({ id: 'run-1', ...(over.run ?? {}), ...data })),
    },
    order: { findMany: vi.fn().mockResolvedValue(over.orders ?? [order('o1', 'u1'), order('o2', 'u2', 'DELIVERED'), order('o3', 'u3')]) },
    marketOrder: { findMany: vi.fn().mockResolvedValue(over.markets ?? []) },
    user: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'u1', name: 'Maria', apartment: '101', block: '1', complement: null, condominiumId: 'cA' },
        { id: 'u2', name: 'Pedro', apartment: '204', block: '1', complement: null, condominiumId: 'cA' },
        { id: 'u3', name: 'Ana', apartment: '12', block: null, complement: null, condominiumId: 'cB' },
      ]),
      findUnique: vi.fn().mockResolvedValue({ name: 'Antônio Ribeiro', courierRules: over.rules ?? null, courierVehicle: over.vehicle ?? null }),
    },
    condominium: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'cA', name: 'Residencial Jardins', lat: -23.5, lng: -46.6 },
        { id: 'cB', name: 'Edifício Aurora', lat: -23.6, lng: -46.7 },
      ]),
    },
    deliveryProof: { findMany: vi.fn().mockResolvedValue(over.proofs ?? []) },
    hookRequest: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    courierShiftOffer: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    setting: { findMany: vi.fn().mockResolvedValue(over.settings ?? []), findUnique: vi.fn().mockResolvedValue(null) },
  }
  const fastify = { prisma, log: { warn: vi.fn(), error: vi.fn() } }
  return { prisma, service: new CourierRunService(fastify as never) }
}

beforeEach(() => vi.clearAllMocks())

describe('iniciar rota (E8)', () => {
  it('inicia pela base, guarda a ordem/km do dia e avisa só os clientes com parada pendente', async () => {
    const { prisma, service } = setup()
    const { run, notified } = await service.start('k1', { slotId: 'manha', startMode: 'BASE' }, now)
    expect(run).toMatchObject({ status: 'STARTED', startMode: 'BASE', condominiumIds: ['cA', 'cB'], plannedKm: 9.6, date: '2026-10-02' })
    expect(notified).toBe(2)
    expect(notifyUser.mock.calls.map(([id]) => id)).toEqual(['u1', 'u3'])
    expect(notifyUser).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'DELIVERY_OUT', title: 'Saiu para entrega', body: 'Antônio está a caminho com seus 4 pãezinhos.' }))
    expect(prisma.courierRun.upsert.mock.calls[0][0].where).toEqual({ courierId_date_slotId: { courierId: 'k1', date: '2026-10-02', slotId: 'manha' } })
  })

  it('iniciar a rota aceita o turno oferecido (plano-termos-legais §5)', async () => {
    const { prisma, service } = setup()
    await service.start('k1', { slotId: 'manha', startMode: 'BASE' }, now)
    expect(prisma.courierShiftOffer.updateMany).toHaveBeenCalledWith({ where: { courierId: 'k1', date: '2026-10-02', slotId: 'manha', status: 'OFFERED' }, data: { status: 'ACCEPTED', respondedAt: now, via: 'START' } })
  })

  it('pelo GPS guarda o ponto de partida e já conta como última posição', async () => {
    const { service } = setup()
    const { run } = await service.start('k1', { slotId: 'manha', startMode: 'GPS', lat: -23.4, lng: -46.5 }, now)
    expect(run).toMatchObject({ startMode: 'GPS', startLat: -23.4, startLng: -46.5, lastLat: -23.4, lastLng: -46.5 })
  })

  it('já iniciada: devolve a mesma e NÃO avisa de novo; encerrada → 409; sem entregas → 404', async () => {
    const started = setup({ run: { id: 'run-1', status: 'STARTED' } })
    expect((await started.service.start('k1', { slotId: 'manha', startMode: 'BASE' }, now)).notified).toBe(0)
    expect(notifyUser).not.toHaveBeenCalled()
    const ended = setup({ run: { id: 'run-1', status: 'ENDED' } })
    await expect(ended.service.start('k1', { slotId: 'manha', startMode: 'BASE' }, now)).rejects.toMatchObject({ statusCode: 409 })
    const empty = setup({ orders: [] })
    await expect(empty.service.start('k1', { slotId: 'manha', startMode: 'BASE' }, now)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('só Cestinha: o aviso fala da Cestinha', async () => {
    const { service } = setup({ orders: [], markets: [{ id: 'm1', userId: 'u1', breadQty: 0, status: 'OUT_FOR_DELIVERY', condominiumId: 'cA' }] })
    await service.start('k1', { slotId: 'manha', startMode: 'BASE' }, now)
    expect(notifyUser).toHaveBeenCalledWith('u1', expect.objectContaining({ body: 'Antônio está a caminho com a sua Cestinha.' }))
  })

  it('a 1ª confirmação de um turno não iniciado inicia sozinha (AUTO); depois, nada', async () => {
    const { prisma, service } = setup()
    await service.ensureStarted('k1', 'manha', now)
    expect(prisma.courierRun.upsert.mock.calls[0][0].create).toMatchObject({ status: 'STARTED', startMode: 'AUTO' })
    const again = setup({ run: { id: 'run-1', status: 'STARTED' } })
    await again.service.ensureStarted('k1', 'manha', now)
    expect(again.prisma.courierRun.upsert).not.toHaveBeenCalled()
  })
})

describe('turno só com gancho (plano-gancho-sozinho-na-rota)', () => {
  it('inicia sem "Saiu para entrega", fica fora da rota salva e o resumo conta os ganchos', async () => {
    const { prisma, service } = setup({ orders: [] })
    prisma.hookRequest.findMany.mockResolvedValue([{ id: 'h1', userId: 'u3', routeSlotId: 'manha', routeCourierId: 'k1' }])
    const { run, notified } = await service.start('k1', { slotId: 'manha', startMode: 'BASE' }, now)
    expect(run).toMatchObject({ status: 'STARTED' })
    expect(notified).toBe(0)
    expect(notifyUser).not.toHaveBeenCalled()
    // O prédio que só tem gancho entra no traçado, mas não conta para a rota salva.
    expect(plan.resolveDayRoute).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ suggestFrom: [] }))

    prisma.hookRequest.count.mockResolvedValue(2)
    const sum = await service.summary('k1', 'manha', now)
    expect(sum.pending.stops).toEqual([expect.objectContaining({ key: 'u3|manha', refId: 'h1', clientName: 'Ana' })])
    expect(sum.stats.ganchos).toBe(2)
    expect(prisma.hookRequest.count).toHaveBeenCalledWith({
      where: { status: 'DELIVERED', deliveredVia: 'COURIER', deliveredById: 'k1', routeDate: '2026-10-02', routeSlotId: 'manha' },
    })
  })
})

describe('posição e reordenar', () => {
  it('posição só com a rota iniciada e do próprio entregador', async () => {
    const ok = setup()
    ok.prisma.courierRun.findUnique.mockResolvedValue({ id: 'run-1', courierId: 'k1', status: 'STARTED' })
    await ok.service.position('k1', 'run-1', { lat: -23.5, lng: -46.6 }, now)
    expect(ok.prisma.courierRun.update).toHaveBeenCalledWith({ where: { id: 'run-1' }, data: { lastLat: -23.5, lastLng: -46.6, lastPosAt: now } })
    ok.prisma.courierRun.findUnique.mockResolvedValue({ id: 'run-1', courierId: 'k1', status: 'PLANNED' })
    await expect(ok.service.position('k1', 'run-1', { lat: 0, lng: 0 }, now)).rejects.toMatchObject({ statusCode: 409 })
    ok.prisma.courierRun.findUnique.mockResolvedValue({ id: 'run-1', courierId: 'outro', status: 'STARTED' })
    await expect(ok.service.position('k1', 'run-1', { lat: 0, lng: 0 }, now)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('reordenar sem a permissão do admin → 403', async () => {
    const { service } = setup()
    await expect(service.reorder('k1', { slotId: 'manha', condominiumIds: ['cB', 'cA'] }, now)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('com permissão: grava a ordem do dia (PLANNED antes de iniciar) com o km novo', async () => {
    const { prisma, service } = setup({ rules: { podeReordenar: true } })
    const run = await service.reorder('k1', { slotId: 'manha', condominiumIds: ['cB'] }, now)
    expect(run).toMatchObject({ status: 'PLANNED', condominiumIds: ['cB', 'cA'], reordered: true, plannedKm: 9.8 })
    await expect(service.reorder('k1', { slotId: 'manha', condominiumIds: ['cZ'] }, now)).rejects.toMatchObject({ statusCode: 400 })
    prisma.courierRun.findUnique.mockResolvedValue({ id: 'run-1', status: 'ENDED' })
    await expect(service.reorder('k1', { slotId: 'manha', condominiumIds: ['cA'] }, now)).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('resumo e encerrar (E10)', () => {
  const started = { id: 'run-1', courierId: 'k1', slotId: 'manha', status: 'STARTED', startedAt: new Date('2026-10-02T08:12:00.000Z'), endedAt: null, plannedKm: 9.6 }

  it('com parada sem desfecho e foto obrigatória pendente: lista as pendências e encerrar → 422', async () => {
    const { prisma, service } = setup({ run: started, proofs: [{ userId: 'u2', outcome: 'DELIVERED' }] })
    prisma.courierRun.findUnique.mockResolvedValue(started)
    const summary = await service.summary('k1', 'manha', now)
    expect(summary.pending.stops.map((s) => s.clientName)).toEqual(['Maria', 'Ana'])
    expect(summary.pending.noPhoto).toEqual([expect.objectContaining({ clientName: 'Pedro', apartment: '204', outcome: 'DELIVERED' })])
    expect(summary.stats).toMatchObject({ delivered: 1, notDelivered: 0, breads: 4, durationMin: 48 })
    await expect(service.end('k1', 'run-1', now)).rejects.toMatchObject({ statusCode: 422, pending: expect.objectContaining({ stops: expect.any(Array) }) })
  })

  it('tudo resolvido: encerra com o snapshot do combustível (km da rota ÷ km/l × preço)', async () => {
    const { prisma, service } = setup({
      run: started,
      orders: [order('o1', 'u1', 'DELIVERED'), order('o3', 'u3', 'NOT_DELIVERED')],
      vehicle: { tipo: 'MOTO', combustivel: 'GASOLINA', kmPorLitro: 38 },
      settings: [{ key: 'combustivelGasolina', value: '6.09' }],
    })
    prisma.courierRun.findUnique.mockResolvedValue(started)
    const { run, summary } = await service.end('k1', 'run-1', now)
    expect(summary.fuel).toMatchObject({ kmPorLitro: 38, preco: 6.09, custo: 1.54 })
    expect(run).toMatchObject({ status: 'ENDED', endedAt: now, kmPerLiter: 38, fuelPrice: 6.09, fuelEstimate: 1.54 })
    expect(prisma.courierRun.update.mock.calls[0][0].data.summary).toEqual({ entregues: 1, naoEntregues: 1, paes: 4, cestinhas: 0, ganchos: 0, combustivel: 'GASOLINA' })
  })

  it('GNV (Onda 11): preço do m³ e km/m³ do carro; o encerramento grava o combustível', async () => {
    const { prisma, service } = setup({
      run: started,
      orders: [order('o1', 'u1', 'DELIVERED')],
      vehicle: { tipo: 'CARRO', combustivel: 'GNV', kmPorLitro: 12 },
      settings: [{ key: 'combustivelGasolina', value: '6.09' }, { key: 'combustivelGnv', value: '4.99' }],
    })
    prisma.courierRun.findUnique.mockResolvedValue(started)
    const summary = await service.summary('k1', 'manha', now)
    expect(summary.fuel).toMatchObject({ kmPorLitro: 12, preco: 4.99, combustivel: 'GNV', custo: 3.99 }) // 9,6 km ÷ 12 × 4,99
    await service.end('k1', 'run-1', now)
    expect(prisma.courierRun.update.mock.calls[0][0].data).toMatchObject({ kmPerLiter: 12, fuelPrice: 4.99, summary: expect.objectContaining({ combustivel: 'GNV' }) })
  })

  it('encerrar apaga a última posição e o ponto de partida por GPS (localização só durante a rota)', async () => {
    const gpsRun = { ...started, startMode: 'GPS', startLat: -23.4, startLng: -46.5, lastLat: -23.5, lastLng: -46.6, lastPosAt: now }
    const { prisma, service } = setup({ run: gpsRun, orders: [order('o1', 'u1', 'DELIVERED')] })
    prisma.courierRun.findUnique.mockResolvedValue(gpsRun)
    const { run } = await service.end('k1', 'run-1', now)
    expect(prisma.courierRun.update.mock.calls[0][0].data).toMatchObject({ startLat: null, startLng: null, lastLat: null, lastLng: null, lastPosAt: null })
    expect(run).toMatchObject({ status: 'ENDED', startMode: 'GPS', lastLat: null, startLat: null })
  })

  it('Fim da rota (A5): por padrão, km e combustível não vão ao entregador, mas o encerramento congela', async () => {
    const fuelSetup = {
      run: started,
      orders: [order('o1', 'u1', 'DELIVERED')],
      vehicle: { tipo: 'MOTO', combustivel: 'GASOLINA', kmPorLitro: 38 },
      settings: [{ key: 'combustivelGasolina', value: '6.09' }],
    }
    const hidden = setup(fuelSetup)
    hidden.prisma.courierRun.findUnique.mockResolvedValue(started)
    const raw = await hidden.service.summary('k1', 'manha', now)
    expect(raw.fuelVisible).toBe(false)
    expect(courierRunSummary(raw)).toMatchObject({ fuelVisible: false, km: null, fuel: null, fuelReason: null, stats: raw.stats })
    const { run } = await hidden.service.end('k1', 'run-1', now)
    expect(run).toMatchObject({ fuelEstimate: 1.54, plannedKm: 9.6 })

    const shown = setup({ ...fuelSetup, settings: [...fuelSetup.settings, { key: 'entregadorVeCombFimRota', value: 'true' }] })
    shown.prisma.courierRun.findUnique.mockResolvedValue(started)
    const visible = courierRunSummary(await shown.service.summary('k1', 'manha', now))
    expect(visible).toMatchObject({ fuelVisible: true, km: 9.6, fuel: expect.objectContaining({ custo: 1.54 }) })
  })

  it('sem consumo cadastrado: km sim, combustível não (motivo SEM_CONSUMO)', async () => {
    const { prisma, service } = setup({ run: started, orders: [order('o1', 'u1', 'DELIVERED')] })
    prisma.courierRun.findUnique.mockResolvedValue(started)
    const summary = await service.summary('k1', 'manha', now)
    expect(summary).toMatchObject({ km: 9.6, fuel: null, fuelReason: 'SEM_CONSUMO' })
  })

  it('rota não iniciada não encerra (409); a de outro entregador não existe (404)', async () => {
    const { prisma, service } = setup()
    prisma.courierRun.findUnique.mockResolvedValue({ ...started, status: 'PLANNED' })
    await expect(service.end('k1', 'run-1', now)).rejects.toMatchObject({ statusCode: 409 })
    prisma.courierRun.findUnique.mockResolvedValue({ ...started, courierId: 'outro' })
    await expect(service.end('k1', 'run-1', now)).rejects.toMatchObject({ statusCode: 404 })
  })
})
