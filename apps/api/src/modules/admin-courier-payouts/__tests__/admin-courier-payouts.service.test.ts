// Pagamentos dos entregadores (A8 · Onda 7 do plano do entregador): geração preguiçosa e idempotente
// da semana fechada, as três modalidades, editar / aprovar (vira 2 despesas com a competência certa)
// / descartar, mês fechado → 409 e o aviso de segunda.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { AdminCourierPayoutsService } from '../admin-courier-payouts.service.js'
import { adminCourierPayoutsRoute } from '../admin-courier-payouts.route.js'
import { computeWeek, PAYOUTS_SINCE_KEY } from '../payouts.core.js'

type Row = Record<string, any>
const hex = (n: number) => n.toString(16).padStart(24, '0')

/** Confere um `where` simples do Prisma (igualdade e `{ in }`). */
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && 'in' in v) return (v.in as unknown[]).includes(row[k])
    if (v && typeof v === 'object' && ('gte' in v || 'lte' in v)) return (!v.gte || row[k] >= v.gte) && (!v.lte || row[k] <= v.lte)
    return row[k] === v
  })
}

const couriers = [
  { id: 'k1', name: 'Antônio Ribeiro', role: 'COURIER', isBlocked: false, courierPhotoUrl: null, courierPay: { modalidade: 'PER_DELIVERY', valor: 1.5, pagaCombustivel: true }, courierVehicle: { tipo: 'MOTO', combustivel: 'FLEX', kmPorLitro: 38 } },
  { id: 'k2', name: 'Joana Pires', role: 'COURIER', isBlocked: false, courierPhotoUrl: 'https://cdn/j.jpg', courierPay: { modalidade: 'WEEKLY_FIXED', valor: 400, pagaCombustivel: true }, courierVehicle: { tipo: 'MOTO', combustivel: 'GASOLINA', kmPorLitro: 38 } },
  { id: 'k3', name: 'Dona Tereza', role: 'COURIER', isBlocked: false, courierPhotoUrl: null, courierPay: { modalidade: 'PER_ROUTE', valor: 25, pagaCombustivel: false }, courierVehicle: { tipo: 'CARRO', combustivel: 'ETANOL', kmPorLitro: 12 } },
  { id: 'k4', name: 'Rui Martins', role: 'COURIER', isBlocked: false, courierPhotoUrl: null, courierPay: null, courierVehicle: { tipo: 'BIKE' } },
]

// Semana fechada 28/09–04/10; "hoje" = segunda 05/10, 08:00 BRT.
const MONDAY = new Date('2026-10-05T11:00:00.000Z')
const WEEK = '2026-09-28'
const at = (day: string) => new Date(`${day}T09:00:00.000Z`)

function db(over: { orders?: Row[]; markets?: Row[]; runs?: Row[]; closed?: string[]; since?: string | null } = {}) {
  let seq = 0
  const payouts: Row[] = []
  const expenses: Row[] = []
  const notifications: Row[] = []
  const settings = new Map<string, string>()
  if (over.since !== null) settings.set(PAYOUTS_SINCE_KEY, over.since ?? '2026-09-21')
  const cats: Row[] = [
    { id: 'catE', name: 'Entregador' },
    { id: 'catC', name: 'Combustível' },
  ]
  const prisma = {
    _payouts: payouts,
    _expenses: expenses,
    _settings: settings,
    _notifications: notifications,
    user: {
      findMany: vi.fn(async ({ where }: { where: Row }) =>
        where.role === 'ADMIN'
          ? [{ id: 'a1', oneSignalPlayerId: null, adminNotificationPrefs: null }]
          : couriers.filter((c) => (!where.role || c.role === where.role) && (!where.id || where.id.in.includes(c.id))),
      ),
      findUnique: vi.fn(async ({ where }: { where: Row }) => couriers.find((c) => c.id === where.id) ?? null),
    },
    order: {
      findMany: vi.fn(async () =>
        (over.orders ?? [
          // k1: 3 paradas entregues (a 2ª com Cestinha junto = 1) e 1 não entregue
          { courierId: 'k1', userId: 'u1', slotId: 'manha', scheduledDate: at('2026-09-29'), status: 'DELIVERED', quantity: 4 },
          { courierId: 'k1', userId: 'u2', slotId: 'manha', scheduledDate: at('2026-09-29'), status: 'DELIVERED', quantity: 2 },
          { courierId: 'k1', userId: 'u3', slotId: 'manha', scheduledDate: at('2026-09-30'), status: 'DELIVERED', quantity: 6 },
          { courierId: 'k1', userId: 'u4', slotId: 'manha', scheduledDate: at('2026-09-30'), status: 'NOT_DELIVERED', quantity: 2 },
          { courierId: 'k3', userId: 'u9', slotId: 'tarde', scheduledDate: at('2026-10-01'), status: 'DELIVERED', quantity: 3 },
        ]),
      ),
    },
    marketOrder: {
      findMany: vi.fn(async () => over.markets ?? [{ courierId: 'k1', userId: 'u2', slotId: 'manha', scheduledDate: at('2026-09-29'), status: 'DELIVERED', breadQty: 0 }]),
    },
    // Parada só de gancho (comprovante com gancho) — nenhuma neste cenário.
    deliveryProof: { findMany: vi.fn(async () => []) },
    courierRun: {
      findMany: vi.fn(async () =>
        over.runs ?? [
          { courierId: 'k1', status: 'ENDED', plannedKm: 20 },
          { courierId: 'k1', status: 'ENDED', plannedKm: 18 },
          { courierId: 'k1', status: 'STARTED', plannedKm: 9 },
          { courierId: 'k3', status: 'ENDED', plannedKm: 30 },
          { courierId: 'k3', status: 'ENDED', plannedKm: 30 },
        ],
      ),
    },
    setting: {
      findMany: vi.fn(async () => [{ key: 'combustivelGasolina', value: '6.09' }, { key: 'combustivelEtanol', value: '4.19' }]),
      findUnique: vi.fn(async ({ where }: { where: Row }) => (settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null)),
      create: vi.fn(async ({ data }: { data: Row }) => {
        settings.set(data.key, data.value)
        return data
      }),
    },
    courierPayout: {
      findMany: vi.fn(async ({ where }: { where?: Row } = {}) => payouts.filter((p) => matches(p, where))),
      findUnique: vi.fn(async ({ where }: { where: Row }) => payouts.find((p) => p.id === where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: Row }) => {
        const p = payouts.find((x) => x.id === where.id)
        if (!p) throw new Error('not found')
        return p
      }),
      create: vi.fn(async ({ data }: { data: Row }) => {
        if (payouts.some((p) => p.courierId === data.courierId && p.weekStart === data.weekStart)) throw Object.assign(new Error('dup'), { code: 'P2002' })
        const row = { id: hex(++seq), remunerationFinal: null, fuelFinal: null, adjustReason: null, discardReason: null, approvedAt: null, approvedById: null, paidAt: null, dueDate: null, paymentMethod: null, ...data }
        payouts.push(row)
        return row
      }),
      update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => Object.assign(payouts.find((p) => p.id === where.id)!, data)),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const list = payouts.filter((p) => matches(p, where))
        list.forEach((p) => Object.assign(p, data))
        return { count: list.length }
      }),
      count: vi.fn(async ({ where }: { where: Row }) => payouts.filter((p) => matches(p, where)).length),
    },
    expense: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { id: hex(1000 + ++seq), ...data }
        expenses.push(row)
        return row
      }),
      findMany: vi.fn(async ({ where }: { where: Row }) => expenses.filter((e) => where.id.in.includes(e.id))),
      deleteMany: vi.fn(async ({ where }: { where: Row }) => {
        for (const id of where.id.in) expenses.splice(expenses.findIndex((e) => e.id === id), 1)
        return { count: where.id.in.length }
      }),
    },
    expenseCategory: {
      findUnique: vi.fn(async ({ where }: { where: Row }) => cats.find((c) => (where.id ? c.id === where.id : c.name === where.name)) ?? null),
      findMany: vi.fn(async ({ where }: { where: Row }) => cats.filter((c) => where.id.in.includes(c.id))),
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { id: `cat${++seq}`, ...data }
        cats.push(row)
        return row
      }),
    },
    financialClose: { findUnique: vi.fn(async ({ where }: { where: Row }) => ((over.closed ?? []).includes(where.month) ? { month: where.month } : null)) },
    notification: {
      findFirst: vi.fn(async ({ where }: { where: Row }) => notifications.find((n) => n.dedupeKey === where.dedupeKey) ?? null),
      create: vi.fn(async ({ data }: { data: Row }) => {
        notifications.push(data)
        return data
      }),
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  }
  return prisma
}

const fastify = (prisma: unknown) => ({ prisma, log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }) as never
const svc = (prisma: unknown) => new AdminCourierPayoutsService(fastify(prisma))

beforeEach(() => vi.clearAllMocks())

describe('cálculo da semana', () => {
  it('as três modalidades, combustível (flex = gasolina) e quem não recebe combustível', async () => {
    const calc = await computeWeek(db() as never, WEEK)
    const by = new Map(calc.map((c) => [c.courierId, c]))
    // por entrega: 3 paradas entregues (pão + Cestinha do mesmo cliente = 1) × 1,50; 38 km ÷ 38 × 6,09
    expect(by.get('k1')).toMatchObject({ entregas: 3, rotas: 2, openRuns: 1, units: 3, remunerationEst: 4.5, kmEst: 38, fuelEst: 6.09 })
    // semanal fixo sem movimento entra (ativo)
    expect(by.get('k2')).toMatchObject({ entregas: 0, units: 1, remunerationEst: 400, fuelEst: 0, fuelBasis: { reason: 'SEM_KM' } })
    // por rota: 2 turnos encerrados × 25; combustível desligado no cadastro
    expect(by.get('k3')).toMatchObject({ rotas: 2, units: 2, remunerationEst: 50, kmEst: 60, fuelEst: 0, fuelBasis: { reason: 'NAO_PAGA' } })
    // sem modalidade e sem movimento: fora
    expect(by.has('k4')).toBe(false)
  })
})

describe('A8 · semana fechada', () => {
  it('gera as propostas uma vez só (idempotente) e recalcula só a pendente', async () => {
    const prisma = db()
    const s = svc(prisma)
    const first = await s.list(WEEK, MONDAY)
    expect(first).toMatchObject({ weekStart: WEEK, weekEnd: '2026-10-04', state: 'CLOSED' })
    expect(first.proposals.map((p) => p.name)).toEqual(['Antônio Ribeiro', 'Dona Tereza', 'Joana Pires'])
    expect(first.totals).toMatchObject({ count: 3, open: 3, estimated: 460.59 })
    expect(first.proposals[0]).toMatchObject({ status: 'PENDING', openRuns: 1, fuelBasis: { kmPorLitro: 38, preco: 6.09 } })
    expect(prisma.courierPayout.create).toHaveBeenCalledTimes(3)

    await s.list(WEEK, MONDAY)
    expect(prisma.courierPayout.create).toHaveBeenCalledTimes(3)
    expect(prisma._payouts).toHaveLength(3)
    expect(prisma.courierPayout.updateMany).not.toHaveBeenCalled()

    // editada não muda; a pendente pega o km novo
    const joana = prisma._payouts.find((p) => p.courierId === 'k2')!
    await s.edit(joana.id, { remunerationFinal: 405, fuelFinal: 0, adjustReason: 'Arredondado' })
    prisma.courierRun.findMany.mockResolvedValue([{ courierId: 'k1', status: 'ENDED', plannedKm: 76 }, { courierId: 'k2', status: 'ENDED', plannedKm: 40 }])
    await s.list(WEEK, MONDAY)
    expect(prisma._payouts.find((p) => p.courierId === 'k1')).toMatchObject({ kmEst: 76, fuelEst: 12.18 })
    expect(prisma._payouts.find((p) => p.courierId === 'k2')).toMatchObject({ status: 'EDITED', kmEst: 0, remunerationFinal: 405 })
  })

  it('sem semana: abre na última fechada; semana em andamento é só estimativa (não grava)', async () => {
    const prisma = db()
    expect((await svc(prisma).list(undefined, MONDAY)).weekStart).toBe(WEEK)
    const cur = await svc(prisma).list('2026-10-07', MONDAY)
    expect(cur.state).toBe('CURRENT')
    expect(cur.proposals.every((p) => p.status === 'ESTIMATE' && p.id === null)).toBe(true)
    expect(prisma._payouts.filter((p) => p.weekStart === '2026-10-05')).toHaveLength(0)
  })

  it('1ª abertura grava o início (semana anterior); semana antes dele não gera nada', async () => {
    const prisma = db({ since: null })
    const res = await svc(prisma).list('2026-09-14', MONDAY)
    expect(prisma._settings.get(PAYOUTS_SINCE_KEY)).toBe(WEEK)
    expect(res).toMatchObject({ state: 'BEFORE_START', since: WEEK, proposals: [] })
    expect(prisma.courierPayout.create).not.toHaveBeenCalled()
  })
})

describe('A8 · aprovar, editar, descartar', () => {
  async function ready(over: Parameters<typeof db>[0] = {}) {
    const prisma = db(over)
    const s = svc(prisma)
    await s.list(WEEK, MONDAY)
    const k1 = prisma._payouts.find((p) => p.courierId === 'k1')!
    return { prisma, s, k1 }
  }

  it('pago agora: 2 despesas (Entregador + Combustível), competência = último dia da semana, favorecido', async () => {
    const { prisma, s, k1 } = await ready()
    const v = await s.approve(k1.id, { paid: true, paidAt: '2026-10-05', paymentMethod: 'Pix' }, 'admin1', MONDAY)
    expect(prisma._expenses).toHaveLength(2)
    expect(prisma._expenses[0]).toMatchObject({ categoryId: 'catE', amount: 4.5, payee: 'Antônio Ribeiro', paymentMethod: 'Pix', status: 'PAID', description: 'Entregador · Antônio Ribeiro · 28/09–04/10', createdById: 'admin1' })
    expect(prisma._expenses[1]).toMatchObject({ categoryId: 'catC', amount: 6.09, status: 'PAID' })
    // 00:00 BRT de 04/10 → competência outubro
    expect(prisma._expenses[0].competenceDate.toISOString()).toBe('2026-10-04T03:00:00.000Z')
    expect(v).toMatchObject({ status: 'APPROVED', paid: { state: 'PAGO', paidAt: '2026-10-05' }, final: 10.59 })
    expect(prisma._payouts.find((p) => p.id === k1.id)!.expenseIds).toEqual(prisma._expenses.map((e) => e.id))
    await expect(s.approve(k1.id, { paid: true }, 'admin1', MONDAY)).rejects.toMatchObject({ statusCode: 409 })
    expect(prisma._expenses).toHaveLength(2)
  })

  it('a pagar: exige vencimento e lança pendente; valores editados valem; sem combustível = 1 despesa', async () => {
    const { prisma, s } = await ready()
    const tereza = prisma._payouts.find((p) => p.courierId === 'k3')!
    await expect(s.approve(tereza.id, { paid: false }, 'admin1', MONDAY)).rejects.toMatchObject({ statusCode: 400 })
    await s.edit(tereza.id, { remunerationFinal: 60, fuelFinal: 0, adjustReason: 'Rota extra' })
    const v = await s.approve(tereza.id, { paid: false, dueDate: '2026-10-10' }, 'admin1', MONDAY)
    expect(prisma._expenses).toHaveLength(1)
    expect(prisma._expenses[0]).toMatchObject({ categoryId: 'catE', amount: 60, status: 'PENDING', paidAt: null })
    expect(prisma._expenses[0].dueDate.toISOString()).toBe('2026-10-10T03:00:00.000Z')
    expect(v.paid).toEqual({ state: 'A_PAGAR', paidAt: null, dueDate: '2026-10-10' })
  })

  it('mês fechado no Financeiro → 409, nada lançado e a proposta segue aberta', async () => {
    const { prisma, s, k1 } = await ready({ closed: ['2026-10'] })
    await expect(s.approve(k1.id, { paid: true }, 'admin1', MONDAY)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('FECHADO') })
    expect(prisma._expenses).toHaveLength(0)
    expect(prisma._payouts.find((p) => p.id === k1.id)!.status).toBe('PENDING')
  })

  it('falha ao lançar desfaz: apaga a despesa criada e volta a proposta', async () => {
    const { prisma, s, k1 } = await ready()
    prisma.expense.create.mockImplementationOnce(async ({ data }: { data: Row }) => {
      const row = { id: hex(999), ...data }
      prisma._expenses.push(row)
      return row
    })
    prisma.expense.create.mockRejectedValueOnce(new Error('rede'))
    await expect(s.approve(k1.id, { paid: true }, 'admin1', MONDAY)).rejects.toThrow('rede')
    expect(prisma._expenses).toHaveLength(0)
    expect(prisma._payouts.find((p) => p.id === k1.id)).toMatchObject({ status: 'PENDING', approvedAt: null })
  })

  it('descartar não cria despesa; nada a pagar → 400', async () => {
    const { prisma, s, k1 } = await ready()
    const v = await s.discard(k1.id, 'Rotas cobertas por outro')
    expect(v).toMatchObject({ status: 'DISCARDED', discardReason: 'Rotas cobertas por outro' })
    expect(prisma._expenses).toHaveLength(0)
    await expect(s.edit(k1.id, { remunerationFinal: 1, fuelFinal: 0 })).rejects.toMatchObject({ statusCode: 409 })
    const joana = prisma._payouts.find((p) => p.courierId === 'k2')!
    await s.edit(joana.id, { remunerationFinal: 0, fuelFinal: 0 })
    await expect(s.approve(joana.id, { paid: true }, 'admin1', MONDAY)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('histórico com pago × a pagar pelas despesas e o resumo das abertas', async () => {
    const { prisma, s, k1 } = await ready()
    await s.approve(k1.id, { paid: false, dueDate: '2026-10-10' }, 'admin1', MONDAY)
    let h = await s.history()
    expect(h.map((p) => p.paid?.state)).toEqual(['A_PAGAR'])
    // pago depois em Financeiro › Contas a pagar
    prisma._expenses.forEach((e) => Object.assign(e, { status: 'PAID', paidAt: new Date('2026-10-09T15:00:00Z') }))
    h = await s.history()
    expect(h[0].paid).toEqual({ state: 'PAGO', paidAt: '2026-10-09', dueDate: null })
    expect(h[0].expenses.map((e) => e.category)).toEqual(['Entregador', 'Combustível'])
    expect(await s.summary(MONDAY)).toEqual({ open: 2 })
  })
})

describe('aviso de segunda', () => {
  it('avisa uma vez por semana, só às segundas', async () => {
    const prisma = db()
    const s = svc(prisma)
    expect(await s.notifyPending(new Date('2026-10-06T11:00:00.000Z'))).toBe(0) // terça
    expect(await s.notifyPending(MONDAY)).toBe(3)
    expect(prisma._notifications.length).toBeGreaterThan(0)
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ type: 'ADMIN_PAYOUT_PENDING', title: 'Pagamento a aprovar', dedupeKey: 'payout:2026-09-28' })
    expect(prisma.notification.create.mock.calls[0][0].data.body).toBe('3 propostas da semana 28/09–04/10 · total estimado R$ 460,59.')
    expect(await s.notifyPending(MONDAY)).toBe(0)
  })
})

describe('rotas HTTP', () => {
  let app: FastifyInstance
  afterEach(async () => {
    await app?.close()
    vi.useRealTimers()
  })
  async function build(role: string, prisma = db()) {
    app = Fastify()
    app.decorate('prisma', prisma as never)
    app.decorateRequest('user', null)
    app.decorate('authenticate', async (request: { user: unknown }) => {
      request.user = { id: 'adm1', role }
    })
    await app.register(adminCourierPayoutsRoute)
    await app.ready()
    return prisma
  }

  it('não-admin → 403', async () => {
    await build('COURIER')
    expect((await app.inject({ method: 'GET', url: '/admin/courier-payouts' })).statusCode).toBe(403)
  })

  it('serializa a semana com a base do combustível; descartar sem motivo → 400; aprovar duas vezes → 409', async () => {
    vi.useFakeTimers({ now: MONDAY, toFake: ['Date'] })
    const prisma = await build('ADMIN')
    const res = await app.inject({ method: 'GET', url: `/admin/courier-payouts?week=${WEEK}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({ weekStart: WEEK, state: 'CLOSED', totals: { count: 3, open: 3 } })
    expect(body.proposals[0]).toMatchObject({ name: 'Antônio Ribeiro', status: 'PENDING', units: 3, fuelBasis: { kmPorLitro: 38, preco: 6.09, reason: null }, openRuns: 1, expenses: [] })
    const id = body.proposals[0].id
    expect((await app.inject({ method: 'POST', url: `/admin/courier-payouts/${id}/discard`, payload: { reason: '' } })).statusCode).toBe(400)
    const ok = await app.inject({ method: 'POST', url: `/admin/courier-payouts/${id}/approve`, payload: { paid: true, paymentMethod: 'Pix' } })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toMatchObject({ status: 'APPROVED', paid: { state: 'PAGO' }, expenses: [{ category: 'Entregador', amount: 4.5 }, { category: 'Combustível', amount: 6.09 }] })
    expect((await app.inject({ method: 'POST', url: `/admin/courier-payouts/${id}/approve`, payload: { paid: true } })).statusCode).toBe(409)
    expect((await app.inject({ method: 'GET', url: '/admin/courier-payouts/summary' })).json()).toEqual({ open: 2 })
    expect(prisma._expenses).toHaveLength(2)
  })
})
