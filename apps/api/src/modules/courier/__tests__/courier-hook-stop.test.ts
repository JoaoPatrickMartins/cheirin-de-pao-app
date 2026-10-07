// Parada SÓ de gancho (plano-gancho-sozinho-na-rota): o gancho na rota do entregador hoje, sem pão
// nem Cestinha do cliente no turno, vira uma parada própria — na rota do dia, no confirmar e no não
// entregue (com comprovante), no turno e na contagem de paradas do entregador.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CourierService } from '../courier.service.js'
import { CourierRunService } from '../courier-runs.js'
import { AdminHooksService } from '../../admin-hooks/admin-hooks.service.js'
import { pendingHookOnlyStops, resolvedHookOnlyStops } from '../../../lib/hook-stops.js'
import { resolvedCourierStops } from '../../../lib/courier-stops.js'
import { resolveStopByKey } from '../courier-stop.js'

vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))

const NOW = new Date('2026-10-06T12:00:00.000Z') // 09:00 BRT
const TODAY = '2026-10-06'
const at = (hhmm = '09:30') => new Date(`${TODAY}T${hhmm}:00.000Z`)

type Rec = Record<string, unknown>

/** O pedaço do filtro do Prisma que estes serviços usam. */
function match(row: Rec, where: Rec = {}): boolean {
  return Object.entries(where).every(([k, cond]) => {
    if (cond === undefined) return true
    const v = row[k]
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      const c = cond as Rec
      if ('in' in c && !(c.in as unknown[]).includes(v)) return false
      if ('notIn' in c && (c.notIn as unknown[]).includes(v)) return false
      if ('not' in c && (c.not === null ? v == null : v === c.not)) return false
      if ('gte' in c && !((v as number) >= (c.gte as number))) return false
      if ('lte' in c && !((v as number) <= (c.lte as number))) return false
      return true
    }
    return v === cond
  })
}

interface State {
  hooks: Rec[]
  orders: Rec[]
  markets: Rec[]
  proofs: Rec[]
}

function makeDb(over: Partial<State> = {}) {
  const state: State = { hooks: [], orders: [], markets: [], proofs: [], ...over }
  const users: Rec[] = [
    { id: 'u1', name: 'Maria Souza', condominiumId: 'cA', apartment: '101', block: '1', complement: null, courierMessagesOff: false },
    { id: 'u2', name: 'Pedro Lima', condominiumId: 'cA', apartment: '204', block: '1', complement: null, courierMessagesOff: false },
    { id: 'k1', name: 'Antônio Ribeiro', courierRules: null },
    { id: 'k2', name: 'Bruna Lopes', courierRules: null },
  ]
  const keyOf = (w: Rec) => w.courierId_userId_slotId_date_outcome as Rec
  const prisma = {
    hookRequest: {
      findUnique: vi.fn(async ({ where }: { where: Rec }) => state.hooks.find((h) => h.id === where.id) ?? null),
      findFirst: vi.fn(async ({ where }: { where: Rec }) => state.hooks.find((h) => match(h, where)) ?? null),
      findMany: vi.fn(async ({ where }: { where: Rec }) => state.hooks.filter((h) => match(h, where))),
      count: vi.fn(async ({ where }: { where: Rec }) => state.hooks.filter((h) => match(h, where)).length),
      update: vi.fn(async ({ where, data }: { where: Rec; data: Rec }) => Object.assign(state.hooks.find((h) => h.id === where.id)!, data)),
      updateMany: vi.fn(async ({ where, data }: { where: Rec; data: Rec }) => {
        const hit = state.hooks.filter((h) => match(h, where))
        hit.forEach((h) => Object.assign(h, data))
        return { count: hit.length }
      }),
    },
    order: {
      findMany: vi.fn(async ({ where }: { where: Rec }) => state.orders.filter((o) => match(o, where))),
      findUnique: vi.fn(async ({ where }: { where: Rec }) => state.orders.find((o) => o.id === where.id) ?? null),
      groupBy: vi.fn(async () => []),
    },
    marketOrder: {
      findMany: vi.fn(async ({ where }: { where: Rec }) => state.markets.filter((o) => match(o, where))),
      findUnique: vi.fn(async ({ where }: { where: Rec }) => state.markets.find((o) => o.id === where.id) ?? null),
      groupBy: vi.fn(async () => []),
    },
    deliveryProof: {
      findMany: vi.fn(async ({ where }: { where: Rec }) => state.proofs.filter((p) => match(p, where))),
      findFirst: vi.fn(async ({ where }: { where: Rec }) => state.proofs.filter((p) => match(p, where)).at(-1) ?? null),
      findUnique: vi.fn(async ({ where }: { where: Rec }) => state.proofs.find((p) => match(p, keyOf(where))) ?? null),
      upsert: vi.fn(async ({ where, create, update }: { where: Rec; create: Rec; update: Rec }) => {
        const found = state.proofs.find((p) => match(p, keyOf(where)))
        if (found) return Object.assign(found, update, { updatedAt: new Date() })
        const row = { hookRequestId: null, ...create, createdAt: new Date(), updatedAt: new Date() }
        state.proofs.push(row)
        return row
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: Rec }) => users.find((u) => u.id === where.id) ?? null),
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => users.filter((u) => where.id.in.includes(u.id as string))),
    },
    condominium: {
      findUnique: vi.fn(async () => ({ id: 'cA', name: 'Residencial Jardins' })),
      findMany: vi.fn(async () => [{ id: 'cA', name: 'Residencial Jardins', address: null, lat: -23.5, lng: -46.6, courierAccess: null }]),
    },
    courierReport: { findMany: vi.fn(async () => []) },
    courierRun: { findUnique: vi.fn(async () => null) },
    courierRouteTemplate: { findUnique: vi.fn(async () => null), upsert: vi.fn(async ({ create }: { create: Rec }) => ({ id: 't1', acceptedAt: null, ...create })) },
    setting: { findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []) },
  }
  const fastify = { prisma, log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }
  return { state, prisma, service: new CourierService(fastify as never) }
}

/** Gancho de u1 na rota de hoje de k1, manhã. */
const hook = (over: Rec = {}): Rec => ({
  id: 'h1',
  userId: 'u1',
  status: 'REQUESTED',
  routeDate: TODAY,
  routeSlotId: 'manha',
  routeCourierId: 'k1',
  deliveredAt: null,
  ...over,
})

let markDelivered: ReturnType<typeof vi.spyOn>
let ensureStarted: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  markDelivered = vi.spyOn(AdminHooksService.prototype, 'markDelivered').mockResolvedValue({ ok: true })
  ensureStarted = vi.spyOn(CourierRunService.prototype, 'ensureStarted').mockResolvedValue()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('lib/hook-stops', () => {
  it('pendente: só gancho com entregador e sem pão nem Cestinha do cliente no turno', async () => {
    const { prisma } = makeDb({
      hooks: [hook(), hook({ id: 'h2', userId: 'u2' }), hook({ id: 'h3', routeCourierId: null }), hook({ id: 'h4', routeSlotId: 'tarde' })],
      // u2 tem pão separado na manhã (ainda sem divisão): o gancho dele espera a divisão.
      orders: [{ userId: 'u2', slotId: 'manha', scheduledDate: at(), status: 'SEPARATED' }, { userId: 'u1', slotId: 'tarde', scheduledDate: at(), status: 'CANCELLED' }],
    })
    const list = await pendingHookOnlyStops(prisma as never, { courierIds: ['k1'], date: TODAY })
    expect(list.map((h) => [h.hookId, h.slotId])).toEqual([['h1', 'manha'], ['h4', 'tarde']]) // pedido cancelado não conta
    // Pedido de pão não tem PENDING_PAYMENT: o filtro não pode inventar status (foi o bug do A7).
    const orderWhere = (prisma.order.findMany.mock.calls[0] as unknown as [{ where: { status: { notIn: string[] } } }])[0].where
    expect(orderWhere.status.notIn).toEqual(['CANCELLED'])
  })

  it('resolvidas: só comprovantes com gancho', async () => {
    const { prisma } = makeDb({
      proofs: [
        { courierId: 'k1', userId: 'u1', condominiumId: 'cA', slotId: 'manha', date: TODAY, outcome: 'DELIVERED', status: 'OK', hookRequestId: 'h1', createdAt: at() },
        { courierId: 'k1', userId: 'u2', condominiumId: 'cA', slotId: 'manha', date: TODAY, outcome: 'DELIVERED', status: 'OK', hookRequestId: null, createdAt: at() },
      ],
    })
    expect((await resolvedHookOnlyStops(prisma as never, ['k1'], TODAY, TODAY)).map((r) => r.hookId)).toEqual(['h1'])
  })

  it('paradas resolvidas do entregador contam a só de gancho (pagamento por entrega)', async () => {
    const { prisma } = makeDb({
      orders: [{ courierId: 'k1', userId: 'u2', slotId: 'manha', scheduledDate: at(), status: 'DELIVERED', quantity: 4 }],
      proofs: [{ courierId: 'k1', userId: 'u1', condominiumId: 'cA', slotId: 'manha', date: TODAY, outcome: 'DELIVERED', status: 'OK', hookRequestId: 'h1', createdAt: at() }],
    })
    const stops = await resolvedCourierStops(prisma as never, 'k1', TODAY, TODAY)
    expect(stops.map((s) => [s.userId, s.status, s.breads])).toEqual([
      ['u2', 'DELIVERED', 4],
      ['u1', 'DELIVERED', 0],
    ])
  })
})

describe('rota de hoje', () => {
  it('a parada só de gancho entra com hookId, sem pão e sem o selo "entregar gancho"', async () => {
    const { service, prisma } = makeDb({ hooks: [hook()] })
    const res = await service.getTodayOrders('k1')
    expect(res.totalStops).toBe(1)
    expect(res.totalBreads).toBe(0)
    expect(res.condos[0].stops[0]).toMatchObject({ orderId: '', hookId: 'h1', quantity: 0, hookToDeliver: null, slotId: 'manha', apartment: '101' })
    expect(res.slots.map((s) => s.slotId)).toEqual(['manha'])
    // Prédio que só tem gancho não gera sugestão de rota salva.
    expect(prisma.courierRouteTemplate.upsert).not.toHaveBeenCalled()
  })

  it('cliente com pão no turno: não vira parada própria', async () => {
    const { service } = makeDb({ hooks: [hook()], orders: [{ userId: 'u1', slotId: 'manha', scheduledDate: at(), status: 'SEPARATED' }] })
    expect((await service.getTodayOrders('k1')).totalStops).toBe(0)
  })

  it('resolvida hoje aparece em Realizadas com o desfecho do comprovante', async () => {
    const { service } = makeDb({
      hooks: [hook({ status: 'DELIVERED' })],
      proofs: [{ courierId: 'k1', userId: 'u1', condominiumId: 'cA', slotId: 'manha', date: TODAY, outcome: 'DELIVERED', status: 'OK', hookRequestId: 'h1', createdAt: at() }],
    })
    const res = await service.getTodayOrders('k1')
    expect(res.completedTotal).toBe(1)
    expect(res.completed[0].stops[0]).toMatchObject({ hookId: 'h1', status: 'DELIVERED', quantity: 0, proofStatus: 'OK' })
  })
})

describe('confirmar a parada só de gancho', () => {
  it('entrega pelo entregador, grava o comprovante com o gancho e inicia o turno', async () => {
    const { service, state } = makeDb({ hooks: [hook()] })
    const summary = await service.confirmHookStop('h1', 'k1', { via: 'LIST', clientOpId: 'op-1' })
    expect(markDelivered).toHaveBeenCalledWith('h1', 'k1', 'COURIER')
    expect(summary).toMatchObject({ kind: 'HOOK', hookId: 'h1', orderId: null, quantity: 0, hookToDeliver: null, status: 'DELIVERED', proofRequired: true, apartment: '101' })
    expect(state.proofs[0]).toMatchObject({ courierId: 'k1', userId: 'u1', slotId: 'manha', date: TODAY, outcome: 'DELIVERED', hookRequestId: 'h1', orderId: null, required: true, lastClientOpId: 'op-1' })
    expect(ensureStarted).toHaveBeenCalledWith('k1', 'manha')
  })

  it('reenvio da mesma operação → sucesso; leitura nova → 409 com o resumo', async () => {
    const { service, state } = makeDb({ hooks: [hook()] })
    await service.confirmHookStop('h1', 'k1', { clientOpId: 'op-1' })
    state.hooks[0].status = 'DELIVERED' // o que o markDelivered real faz
    expect(await service.confirmHookStop('h1', 'k1', { clientOpId: 'op-1' })).toMatchObject({ kind: 'HOOK', status: 'DELIVERED' })
    await expect(service.confirmHookStop('h1', 'k1', { clientOpId: 'op-2' })).rejects.toMatchObject({ statusCode: 409, message: 'Esse gancho já foi entregue', summary: { kind: 'HOOK' } })
    expect(markDelivered).toHaveBeenCalledTimes(1)
  })

  it('entregue pelo admin na fila → 409 com o resumo', async () => {
    const { service } = makeDb({ hooks: [hook({ status: 'DELIVERED', deliveredAt: at() })] })
    await expect(service.confirmHookStop('h1', 'k1')).rejects.toMatchObject({ statusCode: 409, summary: { kind: 'HOOK', hookId: 'h1' } })
  })

  it('de outro entregador → 403; fora da rota de hoje → 404; cliente passou a ter pão → 422', async () => {
    await expect(makeDb({ hooks: [hook({ routeCourierId: 'k2' })] }).service.confirmHookStop('h1', 'k1')).rejects.toMatchObject({ statusCode: 403 })
    await expect(makeDb({ hooks: [hook({ routeDate: '2026-10-07' })] }).service.confirmHookStop('h1', 'k1')).rejects.toMatchObject({ statusCode: 404 })
    await expect(makeDb({ hooks: [] }).service.confirmHookStop('h1', 'k1')).rejects.toMatchObject({ statusCode: 404 })
    const withBread = makeDb({ hooks: [hook()], markets: [{ userId: 'u1', slotId: 'manha', scheduledDate: at(), status: 'OUT_FOR_DELIVERY' }] })
    await expect(withBread.service.confirmHookStop('h1', 'k1')).rejects.toMatchObject({ statusCode: 422 })
    expect(markDelivered).not.toHaveBeenCalled()
  })
})

describe('parada só de gancho não entregue', () => {
  it('volta para a fila com o motivo e grava o comprovante do desfecho', async () => {
    const { service, state } = makeDb({ hooks: [hook()] })
    const summary = await service.markHookNotDelivered('h1', 'k1', { failureCode: 'CLIENTE_AUSENTE', clientOpId: 'op-9' })
    expect(summary).toMatchObject({ kind: 'HOOK', status: 'NOT_DELIVERED', hookId: 'h1' })
    expect(state.hooks[0]).toMatchObject({ status: 'REQUESTED', routeDate: null, routeSlotId: null, routeCourierId: null, routeFailedReason: 'Cliente ausente' })
    expect(state.proofs[0]).toMatchObject({ outcome: 'NOT_DELIVERED', hookRequestId: 'h1', lastClientOpId: 'op-9' })
    expect(markDelivered).not.toHaveBeenCalled()
    // Reenvio pela fila offline: o gancho já saiu da rota, o comprovante responde.
    expect(await service.markHookNotDelivered('h1', 'k1', { failureCode: 'CLIENTE_AUSENTE', clientOpId: 'op-9' })).toMatchObject({ status: 'NOT_DELIVERED' })
  })

  it('a foto acha a parada pela chave do gancho (dono pelo comprovante)', async () => {
    const { prisma, service } = makeDb({ hooks: [hook()] })
    await service.markHookNotDelivered('h1', 'k1', { failureCode: 'OUTRO', reason: 'Porta trancada' })
    const { scope } = await resolveStopByKey(prisma as never, 'k1', 'h1')
    expect(scope).toMatchObject({ courierId: 'k1', userId: 'u1', slotId: 'manha' })
    await expect(resolveStopByKey(prisma as never, 'k2', 'h1')).rejects.toMatchObject({ statusCode: 403 })
  })
})
