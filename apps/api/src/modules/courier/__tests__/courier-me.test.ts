// O próprio entregador (Onda 6): perfil/crachá (E14/E15), meus números (E17) e a escala (E18).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CourierMeService, scheduleLabel } from '../courier-me.js'

const now = new Date('2026-10-02T12:00:00.000Z') // sexta, 09:00 BRT

function setup(over: { user?: Record<string, unknown>; orders?: unknown[]; markets?: unknown[]; runs?: unknown[]; offs?: unknown[]; settings?: Record<string, string>; accepted?: { version: string; acceptedAt: Date } | null } = {}) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        name: 'Antônio Ribeiro',
        phone: '11998887766',
        cpf: '12345678900',
        createdAt: new Date('2026-03-10T12:00:00Z'),
        isBlocked: false,
        courierPhotoUrl: null,
        courierVehicle: { tipo: 'MOTO', placa: 'ABC1D23', combustivel: 'GASOLINA', kmPorLitro: 38 },
        courierRules: null,
        courierAvailability: { dias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'], turnos: ['manha', 'tarde'] },
        badgeNumber: 427,
        badgeValidUntil: new Date('2026-12-31T15:00:00Z'),
        ...over.user,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    legalAcceptance: {
      findFirst: vi.fn().mockResolvedValue(over.accepted ?? null),
      create: vi.fn().mockImplementation(async ({ data }: { data: { acceptedAt: Date } }) => ({ ...data })),
    },
    order: { findMany: vi.fn().mockResolvedValue(over.orders ?? []) },
    marketOrder: { findMany: vi.fn().mockResolvedValue(over.markets ?? []) },
    deliveryProof: { findMany: vi.fn().mockResolvedValue([]) },
    courierTimeOff: { findMany: vi.fn().mockResolvedValue(over.offs ?? []) },
    courierRun: { findMany: vi.fn().mockResolvedValue(over.runs ?? []) },
    condominium: { findMany: vi.fn().mockResolvedValue([{ name: 'Edifício Aurora' }, { name: 'Residencial Jardins' }]) },
    setting: {
      findUnique: vi.fn().mockResolvedValue(null),
      // switches "O que o entregador vê" do A5 (route-config)
      findMany: vi.fn().mockResolvedValue(Object.entries(over.settings ?? {}).map(([key, value]) => ({ key, value }))),
    },
  }
  return { prisma, service: new CourierMeService({ prisma, log: { warn: vi.fn() } } as never) }
}

beforeEach(() => vi.clearAllMocks())

describe('scheduleLabel', () => {
  it('seguidos → "Seg a sáb"; todos; soltos', () => {
    expect(scheduleLabel(['seg', 'ter', 'qua', 'qui', 'sex', 'sab'])).toBe('Seg a sáb')
    expect(scheduleLabel(null)).toBe('Todos os dias')
    expect(scheduleLabel(['seg', 'qua', 'sex'])).toBe('Seg, qua e sex')
  })
})

describe('me (E14/E15)', () => {
  it('crachá ativo com nº de 4 dígitos, CPF mascarado, hoje e 30 dias', async () => {
    const { service } = setup({
      orders: [
        { slotId: 'manha', condominiumId: 'c1', userId: 'u1', scheduledDate: now, status: 'DELIVERED', quantity: 4 },
        { slotId: 'manha', condominiumId: 'c2', userId: 'u2', scheduledDate: now, status: 'NOT_DELIVERED', quantity: 4 },
      ],
      offs: [{ startDate: '2026-10-12', endDate: '2026-10-13' }],
    })
    const me = await service.me('k1', now)
    expect(me).toMatchObject({
      firstName: 'Antônio',
      cpfMasked: '***.456.789-**',
      badge: { number: '0427', validUntil: '2026-12-31', active: true, reason: 'ATIVO' },
      today: { slots: [{ slotId: 'manha', label: 'Manhã', emoji: '☀️' }], condos: ['Edifício Aurora', 'Residencial Jardins'] },
      deliveries30: 1,
      scheduleLabel: 'Seg a sáb',
      nextTimeOff: { startDate: '2026-10-12', endDate: '2026-10-13' },
      rules: { fotoEntrega: true },
      showFuel: false, // padrão: os três switches do A5 desligados
    })
  })

  it('showFuel verdadeiro com qualquer um dos três switches do A5 ligado', async () => {
    expect((await setup({ settings: { entregadorVeCombFimRota: 'true' } }).service.me('k1', now)).showFuel).toBe(true)
    expect((await setup({ settings: { entregadorVeCombGanhos: 'true' } }).service.me('k1', now)).showFuel).toBe(true)
  })

  it('crachá vencido ou entregador desativado = inativo', async () => {
    expect((await setup({ user: { badgeValidUntil: new Date('2026-09-30T15:00:00Z') } }).service.me('k1', now)).badge).toMatchObject({ active: false, reason: 'VENCIDO' })
    expect((await setup({ user: { isBlocked: true } }).service.me('k1', now)).badge).toMatchObject({ active: false, reason: 'DESATIVADO' })
  })
})

describe('Termo do Entregador Parceiro (plano-termos-legais §6)', () => {
  it('/courier/me diz a versão vigente e a aceita', async () => {
    expect((await setup().service.me('k1', now)).terms).toEqual({ version: '1.0', acceptedVersion: null, acceptedAt: null })
    const done = setup({ accepted: { version: '1.0', acceptedAt: new Date('2026-10-05T09:00:00Z') } })
    expect((await done.service.me('k1', now)).terms).toEqual({ version: '1.0', acceptedVersion: '1.0', acceptedAt: '2026-10-05T09:00:00.000Z' })
  })

  it('aceitar grava versão, quando, IP, navegador e aparelho; de novo não duplica; versão antiga → 409', async () => {
    const { prisma, service } = setup()
    const r = await service.acceptTerms('k1', '1.0', { ip: '200.1.2.3', userAgent: 'Mozilla/5.0', deviceId: 'dev-1' }, now)
    expect(r).toEqual({ version: '1.0', acceptedAt: now.toISOString() })
    expect(prisma.legalAcceptance.create).toHaveBeenCalledWith({ data: { userId: 'k1', doc: 'COURIER_TERMS', version: '1.0', acceptedAt: now, ip: '200.1.2.3', userAgent: 'Mozilla/5.0', deviceId: 'dev-1' } })

    const again = setup({ accepted: { version: '1.0', acceptedAt: new Date('2026-10-05T09:00:00Z') } })
    expect((await again.service.acceptTerms('k1', '1.0', {}, now)).acceptedAt).toBe('2026-10-05T09:00:00.000Z')
    expect(again.prisma.legalAcceptance.create).not.toHaveBeenCalled()

    await expect(setup().service.acceptTerms('k1', '0.9', {}, now)).rejects.toMatchObject({ statusCode: 409, code: 'OUTDATED' })
  })
})

describe('segredo do crachá (Onda 11 · T-23/T-24)', () => {
  it('gera na 1ª chamada (32 bytes, base64url) e devolve o mesmo depois; leva a hora do servidor', async () => {
    const { prisma, service } = setup({ user: { badgeSecret: undefined } })
    const first = await service.badgeKey('k1', now)
    expect(first.secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(first.serverTime).toBe(now.toISOString())
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'k1' }, data: { badgeSecret: first.secret } })

    const again = setup({ user: { badgeSecret: 'ja-existe' } })
    expect((await again.service.badgeKey('k1', now)).secret).toBe('ja-existe')
    expect(again.prisma.user.update).not.toHaveBeenCalled()
  })

  it('desativado ou vencido: secret null e nada é gravado', async () => {
    const blocked = setup({ user: { isBlocked: true, badgeSecret: 'ja-existe' } })
    expect(await blocked.service.badgeKey('k1', now)).toEqual({ secret: null, serverTime: now.toISOString() })
    const expired = setup({ user: { badgeValidUntil: new Date('2026-09-30T15:00:00Z') } })
    expect((await expired.service.badgeKey('k1', now)).secret).toBeNull()
    expect(expired.prisma.user.update).not.toHaveBeenCalled()
  })
})

describe('stats (E17)', () => {
  it('conta paradas (pão + Cestinha = 1), sucesso, pães, rotas encerradas e entregas por dia', async () => {
    const d1 = new Date('2026-10-01T15:00:00Z')
    const { service } = setup({
      orders: [
        { userId: 'u1', slotId: 'manha', scheduledDate: d1, status: 'DELIVERED', quantity: 4 },
        { userId: 'u2', slotId: 'manha', scheduledDate: d1, status: 'NOT_DELIVERED', quantity: 6 },
        { userId: 'u3', slotId: 'tarde', scheduledDate: now, status: 'DELIVERED', quantity: 2 },
      ],
      markets: [{ userId: 'u1', slotId: 'manha', scheduledDate: d1, status: 'DELIVERED', breadQty: 2 }],
      runs: [
        { startedAt: new Date('2026-10-01T08:00:00Z'), endedAt: new Date('2026-10-01T09:20:00Z'), plannedKm: 9.6, fuelEstimate: 1.54 },
        { startedAt: new Date('2026-10-02T08:00:00Z'), endedAt: new Date('2026-10-02T09:00:00Z'), plannedKm: 6.2, fuelEstimate: null },
      ],
    })
    const s = await service.stats('k1', 7, now)
    expect(s).toMatchObject({ days: 7, deliveries: 2, failed: 1, successRate: 0.667, breads: 8, avgRouteMin: 70, fuelVisible: false })
    // padrão do A5: km e combustível não vão ao entregador
    expect(s).not.toHaveProperty('km')
    expect(s).not.toHaveProperty('fuel')
    expect(s.perDay).toHaveLength(7)
    expect(s.perDay[6]).toEqual({ date: '2026-10-02', delivered: 1, failed: 0 })
    expect(s.perDay[5]).toEqual({ date: '2026-10-01', delivered: 1, failed: 1 })
    expect(s.recent).toEqual([
      { date: '2026-10-02', delivered: 1, failed: 0, slots: ['🌙'] },
      { date: '2026-10-01', delivered: 1, failed: 1, slots: ['☀️'] },
    ])
  })

  it('com o switch "Meus números" ligado: km e combustível das rotas encerradas', async () => {
    const { service } = setup({
      settings: { entregadorVeCombNumeros: 'true' },
      runs: [
        { startedAt: new Date('2026-10-01T08:00:00Z'), endedAt: new Date('2026-10-01T09:20:00Z'), plannedKm: 9.6, fuelEstimate: 1.54 },
        { startedAt: new Date('2026-10-02T08:00:00Z'), endedAt: new Date('2026-10-02T09:00:00Z'), plannedKm: 6.2, fuelEstimate: null },
      ],
    })
    expect(await service.stats('k1', 7, now)).toMatchObject({ fuelVisible: true, km: 15.8, fuel: 1.54 })
    expect(await setup({ settings: { entregadorVeCombNumeros: 'true' } }).service.stats('k1', 7, now)).toMatchObject({ km: null, fuel: null })
  })

  it('sem nada: zeros e taxa nula', async () => {
    const s = await setup().service.stats('k1', 30, now)
    expect(s).toMatchObject({ deliveries: 0, successRate: null, avgRouteMin: null })
    expect(s.perDay).toHaveLength(30)
  })
})

describe('schedule (E18)', () => {
  it('semana de segunda a domingo: domingo fora da escala, folga cadastrada, próximo turno', async () => {
    const { service } = setup({ offs: [{ startDate: '2026-10-03', endDate: '2026-10-03', reason: 'Consulta' }] })
    const sch = await service.schedule('k1', now)
    expect(sch.weekStart).toBe('2026-09-28')
    expect(sch.week.map((d) => [d.weekday, d.off, d.slots.length])).toEqual([
      ['seg', null, 2],
      ['ter', null, 2],
      ['qua', null, 2],
      ['qui', null, 2],
      ['sex', null, 2],
      ['sab', 'FOLGA', 0],
      ['dom', 'FORA_DA_ESCALA', 0],
    ])
    expect(sch.week[4].today).toBe(true)
    expect(sch.todayOff).toBeNull()
    expect(sch.timeOffs).toEqual([{ startDate: '2026-10-03', endDate: '2026-10-03', reason: 'Consulta' }])
    // Sábado de folga, domingo fora: o próximo turno é segunda de manhã.
    expect(sch.nextShift).toMatchObject({ date: '2026-10-05', slotId: 'manha' })
  })

  it('hoje de folga', async () => {
    const sch = await setup({ offs: [{ startDate: '2026-10-02', endDate: '2026-10-02', reason: null }] }).service.schedule('k1', now)
    expect(sch.todayOff).toBe('FOLGA')
  })
})
