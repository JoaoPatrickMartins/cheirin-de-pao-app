// A7 · Gancho na rota. Opções: hoje + 6 dias nos turnos ativos do condomínio, junto com o pão
// (pedido ou agenda) ou sozinho; entregador fixo quando o pão já saiu, senão sugerido e escolhido
// pelo admin. Tirar da rota volta para a fila; o estado aparece na lista.
import { describe, it, expect, vi } from 'vitest'
import { AdminHooksService } from '../admin-hooks.service.js'

// Sexta, 02/10/2026, 09:00 BRT. Janela: 02 (sex) … 08 (qui).
const now = new Date('2026-10-02T12:00:00.000Z')
const at = (d: string) => new Date(`${d}T09:30:00.000Z`)

type Row = { userId: string; scheduledDate: Date; slotId: string | null; status: string; courierId: string | null }
type Where = { userId?: string | { in: string[] }; scheduledDate?: { gte: Date; lte: Date }; status?: { in: string[] } }

/** Filtro mínimo do Prisma para as consultas de pedido do serviço. */
function pick(rows: Row[], where: Where) {
  return rows.filter((r) => {
    if (typeof where.userId === 'string' && r.userId !== where.userId) return false
    if (where.userId && typeof where.userId === 'object' && !where.userId.in.includes(r.userId)) return false
    if (where.scheduledDate && (r.scheduledDate < where.scheduledDate.gte || r.scheduledDate > where.scheduledDate.lte)) return false
    if (where.status && !where.status.in.includes(r.status)) return false
    return true
  })
}

const order = (userId: string, date: string, status: string, courierId: string | null = null): Row => ({ userId, scheduledDate: at(date), slotId: 'manha', status, courierId })

const ORDERS: Row[] = [
  order('u1', '2026-10-02', 'DELIVERED', 'k1'), // parada de hoje já resolvida → sai
  order('u1', '2026-10-03', 'OUT_FOR_DELIVERY', 'k1'), // pão despachado → entregador fixo
  order('u1', '2026-10-05', 'SEPARATED'), // pão separado, sem divisão ainda
  order('u1', '2026-10-07', 'CANCELLED'), // cliente pulou o dia: a agenda não conta → só o gancho
  // Vizinhos já despachados em 05/10: k1 leva dois do bloco B, k2 leva o do bloco A (o do cliente).
  order('u2', '2026-10-05', 'OUT_FOR_DELIVERY', 'k2'),
  order('u3', '2026-10-05', 'OUT_FOR_DELIVERY', 'k1'),
  order('u4', '2026-10-05', 'OUT_FOR_DELIVERY', 'k1'),
]

const PEOPLE = [
  { id: 'u1', name: 'Hugo Martins', condominiumId: 'c1', apartment: '3', block: 'A', phone: null, complement: null },
  { id: 'u2', name: 'Vizinha A', condominiumId: 'c1', apartment: '4', block: 'A', phone: null, complement: null },
  { id: 'u3', name: 'Vizinho B', condominiumId: 'c1', apartment: '5', block: 'B', phone: null, complement: null },
  { id: 'u4', name: 'Vizinha B', condominiumId: 'c1', apartment: '6', block: 'B', phone: null, complement: null },
]
const COURIERS = [
  { id: 'k1', name: 'Antônio Ribeiro', courierPhotoUrl: null, courierAvailability: null, isBlocked: false },
  { id: 'k2', name: 'Bruna Lopes', courierPhotoUrl: 'https://f/b.jpg', courierAvailability: null, isBlocked: false },
  { id: 'k3', name: 'Carlos Dias', courierPhotoUrl: null, courierAvailability: null, isBlocked: true },
  { id: 'k4', name: 'Dora Reis', courierPhotoUrl: null, courierAvailability: null, isBlocked: false },
]

function db(hook: Record<string, unknown> = {}, opts: { condo?: string | null } = {}) {
  const row = {
    id: 'h1',
    userId: 'u1',
    type: 'FREE',
    status: 'REQUESTED',
    reason: null,
    requestedAt: now,
    deliveredAt: null,
    routeDate: null,
    routeSlotId: null,
    routeCourierId: null,
    routeFailedAt: null,
    routeFailedReason: null,
    deliveredVia: null,
    deliveredById: null,
    ...hook,
  }
  const condo = opts.condo === undefined ? 'c1' : opts.condo
  const schedule = { userId: 'u1', condominiumId: 'c1', isActive: true, pausedAt: null, days: { manha: { qua: 2, qui: 2 } } }
  return {
    hookRequest: {
      findUnique: vi.fn(async () => row),
      update: vi.fn(async ({ data }: { data: object }) => ({ ...row, ...data })),
      findMany: vi.fn(async () => [row]),
      count: vi.fn(async () => 1),
    },
    order: { findMany: vi.fn(async ({ where }: { where: Where }) => pick(ORDERS, where)) },
    marketOrder: { findMany: vi.fn(async () => []) },
    schedule: { findUnique: vi.fn(async () => schedule), findMany: vi.fn(async () => [schedule]) },
    user: {
      findUnique: vi.fn(async () => ({ condominiumId: condo, block: 'A' })),
      findMany: vi.fn(async ({ where }: { where: { role?: string; condominiumId?: string; id?: { in: string[] } } }) => {
        if (where.role === 'COURIER') return COURIERS
        if (where.condominiumId) return PEOPLE.filter((p) => p.condominiumId === where.condominiumId)
        const ids = where.id?.in ?? []
        return [...PEOPLE, ...COURIERS].filter((u) => ids.includes(u.id))
      }),
    },
    condominium: {
      findUnique: vi.fn(async () => ({
        deliverySlots: [
          { slotId: 'manha', name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true },
          { slotId: 'tarde', name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: false, activeCustom: true },
        ],
      })),
      findMany: vi.fn(async () => [{ id: 'c1', name: 'Vila Verde' }]),
    },
    // Domingo sem entrega nas regras; 06/10 bloqueado por um feriado global.
    setting: { findUnique: vi.fn(async ({ where }: { where: { key: string } }) => (where.key === 'diasBloqueados' ? { value: '{"dom":true}' } : null)) },
    deliveryBlock: { findMany: vi.fn(async () => [{ id: 'b1', condominiumId: null, startDate: '2026-10-06', endDate: '2026-10-06', reason: 'Feriado' }]) },
    courierTimeOff: { findMany: vi.fn(async () => [{ courierId: 'k4', startDate: '2026-10-05', endDate: '2026-10-05' }]) },
    // k1 já encerrou a rota da manhã de 08/10.
    courierRun: { findMany: vi.fn(async () => [{ courierId: 'k1', date: '2026-10-08', slotId: 'manha' }]) },
    courierRouteTemplate: {
      findMany: vi.fn(async () => [
        { courierId: 'k2', slotId: 'manha', acceptedAt: null, updatedAt: new Date('2026-10-01') },
        { courierId: 'k1', slotId: 'manha', acceptedAt: new Date('2026-09-01'), updatedAt: new Date('2026-09-01') },
      ]),
    },
  }
}
const svc = (prisma: unknown) => new AdminHooksService({ prisma, log: { warn: vi.fn() } } as never)

describe('A7 · opções do "Enviar na rota"', () => {
  it('7 dias, turnos ativos, sem dia bloqueado nem parada resolvida; junto com o pão ou sozinho', async () => {
    const { options } = await svc(db()).routeOptions('h1', now)
    expect(options.map((o) => [o.date, o.slotId, o.withBread, o.courierLocked])).toEqual([
      ['2026-10-03', 'manha', true, true], // pão despachado
      ['2026-10-05', 'manha', true, false], // pão separado, sem divisão
      ['2026-10-07', 'manha', false, false], // pedido cancelado: só o gancho
      ['2026-10-08', 'manha', true, false], // agenda de quinta, pedido ainda não nasceu
    ])
  })

  it('consulta pedidos sem status inventado (CONFIRMED derrubava a busca)', async () => {
    const prisma = db()
    await svc(prisma).routeOptions('h1', now)
    const statuses = prisma.order.findMany.mock.calls.flatMap(([a]) => (a as { where: Where }).where.status?.in ?? [])
    expect(statuses).not.toContain('CONFIRMED')
  })

  it('entregador: fixo quando o pão saiu; senão divisão (mesmo bloco), depois rota salva (aceita primeiro)', async () => {
    const { options, couriers } = await svc(db()).routeOptions('h1', now)
    const by = Object.fromEntries(options.map((o) => [o.date, o]))
    expect(by['2026-10-03'].courier).toEqual({ id: 'k1', name: 'Antônio Ribeiro', photoUrl: null })
    expect(by['2026-10-05'].courier?.id).toBe('k2') // k1 tem mais paradas, mas k2 atende o bloco A
    expect(by['2026-10-07'].courier?.id).toBe('k1') // sem divisão: a rota salva aceita
    expect(by['2026-10-08'].courier?.id).toBe('k2') // k1 encerrou a rota: próxima rota salva
    // Indisponíveis por opção: folga (k4 em 05/10) e rota encerrada (k1 em 08/10).
    expect(by['2026-10-05'].unavailableCourierIds).toEqual(['k4'])
    expect(by['2026-10-08'].unavailableCourierIds).toEqual(['k1'])
    // Bloqueado não entra na lista de quem pode levar.
    expect(couriers.map((c) => c.id)).toEqual(['k1', 'k2', 'k4'])
  })

  it('cliente sem condomínio não tem opção', async () => {
    expect(await svc(db({}, { condo: null })).routeOptions('h1', now)).toEqual({ options: [], couriers: [] })
  })
})

describe('A7 · enviar e tirar da rota', () => {
  it('pão despachado: grava o entregador da parada e ignora o escolhido', async () => {
    const prisma = db()
    expect(await svc(prisma).sendOnRoute('h1', '2026-10-03', 'manha', 'k2', now)).toEqual({
      ok: true,
      route: { date: '2026-10-03', slotId: 'manha', courierName: 'Antônio Ribeiro', alone: false },
    })
    expect(prisma.hookRequest.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: { routeDate: '2026-10-03', routeSlotId: 'manha', routeCourierId: 'k1', routeFailedAt: null, routeFailedReason: null },
    })
  })

  it('só o gancho: exige quem leva e grava o escolhido', async () => {
    await expect(svc(db()).sendOnRoute('h1', '2026-10-07', 'manha', null, now)).rejects.toMatchObject({ statusCode: 400, message: 'Escolha quem leva o gancho' })
    const prisma = db()
    expect(await svc(prisma).sendOnRoute('h1', '2026-10-07', 'manha', 'k2', now)).toMatchObject({ route: { courierName: 'Bruna Lopes', alone: true } })
    expect(prisma.hookRequest.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ routeCourierId: 'k2' }) }))
  })

  it('recusa entregador de folga, bloqueado, dia fora da janela e gancho fora da fila', async () => {
    await expect(svc(db()).sendOnRoute('h1', '2026-10-05', 'manha', 'k4', now)).rejects.toMatchObject({ statusCode: 422 })
    await expect(svc(db()).sendOnRoute('h1', '2026-10-05', 'manha', 'k3', now)).rejects.toMatchObject({ statusCode: 422 })
    await expect(svc(db()).sendOnRoute('h1', '2026-10-04', 'manha', 'k2', now)).rejects.toMatchObject({ statusCode: 400 })
    await expect(svc(db({ status: 'DELIVERED' })).sendOnRoute('h1', '2026-10-03', 'manha', null, now)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('tirar da rota limpa os campos', async () => {
    const prisma = db({ routeDate: '2026-10-03', routeSlotId: 'manha', routeCourierId: 'k1' })
    await svc(prisma).removeFromRoute('h1')
    expect(prisma.hookRequest.update).toHaveBeenCalledWith({ where: { id: 'h1' }, data: { routeDate: null, routeSlotId: null, routeCourierId: null } })
  })
})

describe('A7 · estado na lista', () => {
  it('na rota (com pão ou sozinho), voltou para a fila com motivo, entregue pelo entregador', async () => {
    vi.useFakeTimers({ now, toFake: ['Date'] })
    try {
      const rota = (await svc(db({ routeDate: '2026-10-03', routeSlotId: 'manha', routeCourierId: 'k1' })).list()).items[0]
      expect(rota).toMatchObject({ routeState: 'rota', route: { date: '2026-10-03', slotId: 'manha', courierName: 'Antônio Ribeiro', overdue: false, alone: false } })
      const sozinho = (await svc(db({ routeDate: '2026-10-07', routeSlotId: 'manha', routeCourierId: 'k2' })).list()).items[0]
      expect(sozinho.route).toMatchObject({ alone: true, courierName: 'Bruna Lopes' })
      const agenda = (await svc(db({ routeDate: '2026-10-08', routeSlotId: 'manha', routeCourierId: 'k2' })).list()).items[0]
      expect(agenda.route?.alone).toBe(false)
      const volta = (await svc(db({ routeFailedAt: now, routeFailedReason: 'Cliente ausente' })).list()).items[0]
      expect(volta).toMatchObject({ routeState: 'volta', routeFailedReason: 'Cliente ausente' })
      const entregue = (await svc(db({ status: 'DELIVERED', deliveredVia: 'COURIER', deliveredById: 'k1' })).list({ status: 'delivered' })).items[0]
      expect(entregue).toMatchObject({ routeState: 'entregue', deliveredByName: 'Antônio Ribeiro' })
    } finally {
      vi.useRealTimers()
    }
  })
})
