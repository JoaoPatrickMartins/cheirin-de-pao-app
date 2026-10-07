// AdminCouriersService — cadastro de entregadores (ADMG-07/08) ampliado na Onda 6 do plano do
// entregador (A3): foto, veículo, regras, pagamento, disponibilidade, crachá e folgas.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminCouriersService } from '../admin-couriers.service.js'
import { backfillBadgeNumbers } from '../../../lib/courier-badge.js'

const now = new Date('2026-10-02T12:00:00.000Z')

const row = (over: Record<string, unknown> = {}) => ({
  id: 'courier-01',
  name: 'João Entregador',
  cpf: '12345678901',
  phone: '(11) 98888-0000',
  email: 'joao@courier.com',
  isBlocked: false,
  role: 'COURIER',
  createdAt: new Date('2026-03-01T12:00:00Z'),
  courierPhotoUrl: null,
  courierVehicle: null,
  courierRules: null,
  courierPay: null,
  courierAvailability: null,
  badgeNumber: 7,
  badgeValidUntil: null,
  ...over,
})

function makeFastifyMock(over: { courier?: Record<string, unknown> | null; list?: unknown[]; maxBadge?: number | null } = {}) {
  const courier = over.courier === undefined ? row() : over.courier
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue(over.list ?? (courier ? [courier] : [])),
      findFirst: vi.fn().mockImplementation(async (args: { orderBy?: unknown }) => (args.orderBy ? (over.maxBadge === null ? null : { badgeNumber: over.maxBadge ?? 41 }) : courier)),
      findUniqueOrThrow: vi.fn().mockResolvedValue(courier),
      create: vi.fn().mockResolvedValue({ id: 'new-1' }),
      update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...(courier ?? {}), ...data, isBlocked: data.isBlocked ?? courier?.isBlocked })),
    },
    courierTimeOff: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 't1', ...data })),
      delete: vi.fn().mockResolvedValue({}),
    },
    courierRouteTemplate: { findMany: vi.fn().mockResolvedValue([]) },
    legalAcceptance: { findMany: vi.fn().mockResolvedValue([]) },
    order: { findMany: vi.fn().mockResolvedValue([]) },
    marketOrder: { findMany: vi.fn().mockResolvedValue([]) },
    setting: { findUnique: vi.fn().mockResolvedValue(null) },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { prisma, service: new AdminCouriersService({ prisma, log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } } as any) }
}

beforeEach(() => vi.clearAllMocks())

describe('list', () => {
  it('cadastro completo, regras no padrão, folga de hoje e sugestão de rota pendente', async () => {
    const { prisma, service } = makeFastifyMock({ list: [row(), row({ id: 'courier-02', name: 'Rui', courierAvailability: { dias: ['seg'], turnos: ['manha'] } })] })
    prisma.courierRouteTemplate.findMany.mockResolvedValue([{ courierId: 'courier-01', suggestion: { condominiumIds: ['a'] } }])
    const list = await service.list(now)
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { role: 'COURIER' } }))
    expect(list[0]).toMatchObject({ id: 'courier-01', rules: { fotoEntrega: true, fotoNaoEntrega: true, podeReordenar: false, podeRecados: false }, routeSuggestion: true, offToday: null, badgeNumber: 7 })
    // 02/10/2026 é sexta: Rui só trabalha segunda.
    expect(list[1]).toMatchObject({ offToday: 'FORA_DA_ESCALA', routeSuggestion: false })
  })

  it('termo do entregador (plano-termos-legais §6): a última versão aceita de cada um; quem nunca aceitou, null', async () => {
    const { prisma, service } = makeFastifyMock({ list: [row(), row({ id: 'courier-02', name: 'Rui' })] })
    prisma.legalAcceptance.findMany.mockResolvedValue([
      { userId: 'courier-01', version: '1.0', acceptedAt: new Date('2026-10-05T09:00:00Z') },
      { userId: 'courier-01', version: '0.9', acceptedAt: new Date('2026-09-01T09:00:00Z') },
    ])
    const [antonio, rui] = await service.list(now)
    expect(antonio.terms).toEqual({ acceptedVersion: '1.0', acceptedAt: '2026-10-05T09:00:00.000Z' })
    expect(rui.terms).toEqual({ acceptedVersion: null, acceptedAt: null })
    expect(prisma.legalAcceptance.findMany.mock.calls[0][0]).toMatchObject({ where: { doc: 'COURIER_TERMS' }, orderBy: { acceptedAt: 'desc' } })
  })
})

describe('create', () => {
  it('cria com role COURIER, validade 31/12 do ano e o próximo nº do crachá', async () => {
    const { prisma, service } = makeFastifyMock()
    await service.create({ name: 'Maria Entregadora', cpf: '98765432100', phone: '(11) 97777-0000', email: 'maria@courier.com' }, now)
    const data = prisma.user.create.mock.calls[0][0].data
    expect(data).toMatchObject({ role: 'COURIER', name: 'Maria Entregadora', cpf: '98765432100' })
    expect(data.badgeValidUntil.toISOString()).toBe('2026-12-31T15:00:00.000Z')
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'new-1' }, data: { badgeNumber: 42 } })
  })

  it('bicicleta não guarda combustível nem consumo; pagamento e escala vão como vieram', async () => {
    const { prisma, service } = makeFastifyMock()
    await service.create(
      {
        name: 'Rui',
        cpf: '98765432100',
        vehicle: { tipo: 'BIKE', combustivel: 'GASOLINA', kmPorLitro: 30 },
        pay: { modalidade: 'PER_ROUTE', valor: 25, pagaCombustivel: false },
        availability: { dias: ['seg', 'ter'], turnos: ['manha'] },
        badgeValidUntil: null,
      },
      now,
    )
    const data = prisma.user.create.mock.calls[0][0].data
    expect(data.courierVehicle).toEqual({ tipo: 'BIKE', modelo: null, placa: null, combustivel: null, kmPorLitro: null })
    expect(data.courierPay).toEqual({ modalidade: 'PER_ROUTE', valor: 25, pagaCombustivel: false })
    expect(data.courierAvailability).toEqual({ dias: ['seg', 'ter'], turnos: ['manha'] })
    expect(data.badgeValidUntil).toBeNull()
  })

  it('nº do crachá que colidiu (cadastro simultâneo) tenta o seguinte', async () => {
    const { prisma, service } = makeFastifyMock()
    prisma.user.update.mockRejectedValueOnce(Object.assign(new Error('E11000 duplicate key'), { code: 'P2002' }))
    await service.create({ name: 'Maria', cpf: '98765432100' }, now)
    expect(prisma.user.update.mock.calls.map(([a]) => a.data.badgeNumber)).toEqual([42, 43])
  })
})

describe('toggle', () => {
  it('alterna isBlocked; 404 sem entregador; 400 quem não é COURIER', async () => {
    const { prisma, service } = makeFastifyMock()
    await service.toggle('courier-01')
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'courier-01' }, data: { isBlocked: true } }))
    await expect(makeFastifyMock({ courier: null }).service.toggle('x')).rejects.toMatchObject({ statusCode: 404 })
    await expect(makeFastifyMock({ courier: row({ role: 'ADMIN' }) }).service.toggle('x')).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/COURIER/) })
  })
})

describe('updateCourier', () => {
  it('404 quando não existe', async () => {
    await expect(makeFastifyMock({ courier: null }).service.updateCourier('x', { name: 'Novo' })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('só os campos enviados; CPF nunca; foto e regras; null limpa o veículo', async () => {
    const { prisma, service } = makeFastifyMock()
    const view = await service.updateCourier('courier-01', {
      name: 'Novo Nome',
      photoUrl: 'https://cdn.exemplo/couriers/a.jpg',
      rules: { fotoEntrega: false, fotoNaoEntrega: true, podeReordenar: true, podeRecados: false },
      vehicle: null,
      badgeValidUntil: '2027-06-30',
    })
    const data = prisma.user.update.mock.calls[0][0].data
    expect(data).not.toHaveProperty('cpf')
    expect(data).toMatchObject({ name: 'Novo Nome', courierPhotoUrl: 'https://cdn.exemplo/couriers/a.jpg', courierVehicle: null, courierRules: { podeReordenar: true } })
    expect(data).not.toHaveProperty('courierPay')
    expect(view.badgeValidUntil).toBe('2027-06-30')
  })
})

describe('folgas (F-8)', () => {
  it('cadastra e avisa as rotas já despachadas que a folga atinge', async () => {
    const { prisma, service } = makeFastifyMock()
    prisma.order.findMany.mockResolvedValue([
      { scheduledDate: new Date('2026-10-05T15:00:00Z'), slotId: 'manha', userId: 'u1' },
      { scheduledDate: new Date('2026-10-05T15:00:00Z'), slotId: 'manha', userId: 'u2' },
    ])
    prisma.marketOrder.findMany.mockResolvedValue([{ scheduledDate: new Date('2026-10-05T15:00:00Z'), slotId: 'manha', userId: 'u2' }])
    const r = await service.addTimeOff('courier-01', { startDate: '2026-10-05', endDate: '2026-10-06', reason: 'Consulta' }, 'adm1')
    expect(prisma.courierTimeOff.create).toHaveBeenCalledWith({ data: { courierId: 'courier-01', startDate: '2026-10-05', endDate: '2026-10-06', reason: 'Consulta', createdById: 'adm1' } })
    expect(r.overlaps).toEqual([{ date: '2026-10-05', slotId: 'manha', slotLabel: '☀️ Manhã', stops: 2 }])
    expect(prisma.order.findMany.mock.calls[0][0].where).toMatchObject({ courierId: 'courier-01', status: { in: ['OUT_FOR_DELIVERY'] } })
  })

  it('remover folga de outro entregador → 404', async () => {
    const { prisma, service } = makeFastifyMock()
    prisma.courierTimeOff.findUnique.mockResolvedValue({ id: 't1', courierId: 'outro' })
    await expect(service.deleteTimeOff('courier-01', 't1')).rejects.toMatchObject({ statusCode: 404 })
    expect(prisma.courierTimeOff.delete).not.toHaveBeenCalled()
  })
})

describe('backfillBadgeNumbers (boot)', () => {
  it('numera quem não tem, na ordem de cadastro; sem ninguém faltando, não faz nada', async () => {
    const { prisma } = makeFastifyMock({ maxBadge: 3 })
    prisma.user.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    let max = 3
    prisma.user.findFirst.mockImplementation(async () => ({ badgeNumber: max }))
    prisma.user.update.mockImplementation(async ({ data }: { data: { badgeNumber: number } }) => {
      max = data.badgeNumber
      return {}
    })
    expect(await backfillBadgeNumbers(prisma as never)).toBe(2)
    expect(prisma.user.update.mock.calls.map(([a]) => [a.where.id, a.data.badgeNumber])).toEqual([
      ['a', 4],
      ['b', 5],
    ])
    expect(prisma.user.findMany.mock.calls[0][0]).toMatchObject({ where: { role: 'COURIER' }, orderBy: { createdAt: 'asc' } })

    const none = makeFastifyMock()
    none.prisma.user.findMany.mockResolvedValue([])
    expect(await backfillBadgeNumbers(none.prisma as never)).toBe(0)
    expect(none.prisma.user.update).not.toHaveBeenCalled()
  })
})
