// AdminSettingsService unit tests — Fase 7 / Plano 07-02 (Wave 1 — implementação real)
// Requirements: ADMO-01 (horário de corte), ADMG-04 (config compra personalizada)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AdminSettingsService, parseAgendaMinimos } from '../admin-settings.service.js'

// Mock do OneSignal — evita chamadas de rede reais no processCutoff
vi.mock('@onesignal/node-onesignal', () => ({
  createConfiguration: vi.fn().mockReturnValue({}),
  DefaultApi: vi.fn().mockImplementation(function () {
    return { createNotification: vi.fn().mockResolvedValue({}) }
  }),
  Notification: vi.fn().mockImplementation(function () {
    return { app_id: '', include_subscription_ids: [], headings: {}, contents: {} }
  }),
}))

// ── makeFastifyMock ───────────────────────────────────────────────────────────
function makeFastifyMock(overrides: {
  setting?: { key: string; value: string } | null
  deliverySlots?: { key: string; value: string } | null
  settingAvulsoLimite?: { key: string; value: string } | null
  settingAvulsoUnit?: { key: string; value: string } | null
  /** Config do gancho — usado nos testes de getGanchoConfig/setGanchoConfig. */
  settingGanchoRecorrenciaMin?: { key: string; value: string } | null
  settingGanchoRecorrenciaDesde?: { key: string; value: string } | null
  users?: Array<{ id: string; oneSignalPlayerId: string | null }>
  orders?: Array<{ id: string; userId: string; scheduledDate: Date }>
  condominiums?: Array<{ id: string; name: string; isActive: boolean; deliverySlots: Array<{ slotId?: string; name: string; label?: string; emoji?: string; time: string; cutoffTime: string; isActive: boolean }> }>
  /** O que `condominium.findUnique` devolve — os overrides de restrições daquele condomínio. */
  condoOverrides?: { id?: string; blockedDaysOverride?: unknown; dayLimitOverride?: unknown } | null
} = {}) {
  const {
    setting = { key: 'cutoffTime', value: '20:00' },
    deliverySlots = null,
    settingAvulsoLimite = { key: 'avulsoLimite', value: '20' },
    settingAvulsoUnit = { key: 'avulsoUnit', value: '1.50' },
    users = [],
    orders = [],
    condominiums = [],
  } = overrides

  const settingFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
    if (where.key === 'cutoffTime') return Promise.resolve(setting)
    if (where.key === 'deliverySlots') return Promise.resolve(deliverySlots)
    if (where.key === 'avulsoLimite') return Promise.resolve(settingAvulsoLimite)
    if (where.key === 'avulsoUnit') return Promise.resolve(settingAvulsoUnit)
    if (where.key === 'ganchoRecorrenciaMin') return Promise.resolve(overrides.settingGanchoRecorrenciaMin ?? null)
    if (where.key === 'ganchoRecorrenciaDesde') return Promise.resolve(overrides.settingGanchoRecorrenciaDesde ?? null)
    return Promise.resolve(null)
  })

  const prisma = {
    setting: {
      findUnique: settingFindUnique,
      upsert: vi.fn().mockImplementation(({ create }: { create: { key: string; value: string } }) =>
        Promise.resolve(create),
      ),
    },
    user: {
      findMany: vi.fn().mockResolvedValue(users),
    },
    order: {
      findMany: vi.fn().mockResolvedValue(orders),
    },
    condominium: {
      findMany: vi.fn().mockResolvedValue(condominiums),
      // Override por condomínio das restrições por dia. Default: sem override → herda o padrão.
      findUnique: vi.fn().mockResolvedValue(overrides.condoOverrides ?? null),
      update: vi.fn().mockResolvedValue({}),
    },
    schedule: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
  }

  return {
    fastify: {
      prisma,
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    } as unknown,
    prisma,
  }
}

// ── Testes ────────────────────────────────────────────────────────────────────
describe('AdminSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getDeliverySlots', () => {
    it('retorna a config global default (manha 22:00 / tarde 10:00) quando Setting não existe', async () => {
      const { fastify } = makeFastifyMock({ deliverySlots: null })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      const result = await service.getDeliverySlots()

      expect(result.map((s) => s.slotId).sort()).toEqual(['manha', 'tarde'])
      const manha = result.find((s) => s.slotId === 'manha')!
      expect(manha.cutoffTime).toBe('22:00')
      expect(manha.time).toBe('06:30')
      const tarde = result.find((s) => s.slotId === 'tarde')!
      expect(tarde.cutoffTime).toBe('10:00')
    })

    it('retorna a config global persistida quando existe', async () => {
      const custom = [
        { slotId: 'manha', name: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30', cutoffTime: '21:00', isActive: true },
        { slotId: 'tarde', name: 'tarde', label: 'Tarde', emoji: '🌙', time: '15:30', cutoffTime: '09:00', isActive: false },
      ]
      const { fastify } = makeFastifyMock({
        deliverySlots: { key: 'deliverySlots', value: JSON.stringify(custom) },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      const result = await service.getDeliverySlots()

      expect(result.find((s) => s.slotId === 'manha')!.cutoffTime).toBe('21:00')
      expect(result.find((s) => s.slotId === 'tarde')!.isActive).toBe(false)
    })
  })

  describe('setDeliverySlots', () => {
    it('persiste a config global (upsert key=deliverySlots) com o novo cutoff', async () => {
      const { fastify, prisma } = makeFastifyMock({ deliverySlots: null })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      await service.setDeliverySlots([{ slotId: 'manha', cutoffTime: '21:30' }])

      expect(prisma.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: 'deliverySlots' } }),
      )
      const call = prisma.setting.upsert.mock.calls[0][0] as { create: { value: string } }
      const saved = JSON.parse(call.create.value) as Array<{ slotId: string; cutoffTime: string }>
      expect(saved.find((s) => s.slotId === 'manha')!.cutoffTime).toBe('21:30')
    })

    it('propaga aos condomínios preservando time/name, alterando só cutoffTime e preenchendo slotId', async () => {
      const condo = {
        id: 'condo-1',
        name: 'C1',
        isActive: true,
        deliverySlots: [
          { name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true },
          { name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true },
        ],
      }
      const { fastify, prisma } = makeFastifyMock({ deliverySlots: null, condominiums: [condo] })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      await service.setDeliverySlots([{ slotId: 'manha', cutoffTime: '21:00' }])

      expect(prisma.condominium.update).toHaveBeenCalledTimes(1)
      const arg = prisma.condominium.update.mock.calls[0][0] as {
        data: { deliverySlots: Array<{ slotId?: string; name: string; time: string; cutoffTime: string }> }
      }
      const manha = arg.data.deliverySlots.find((s) => s.name === 'manha')!
      expect(manha.time).toBe('06:30') // chave de junção preservada
      expect(manha.name).toBe('manha') // identidade preservada
      expect(manha.cutoffTime).toBe('21:00') // cutoff atualizado
      expect(manha.slotId).toBe('manha') // slotId preenchido
    })
  })

  describe('getAvulsoConfig', () => {
    it('retorna { limit, unitPrice } convertendo strings para números', async () => {
      const { fastify } = makeFastifyMock({
        settingAvulsoLimite: { key: 'avulsoLimite', value: '20' },
        settingAvulsoUnit: { key: 'avulsoUnit', value: '1.50' },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      const result = await service.getAvulsoConfig()

      expect(result).toEqual({ limit: 20, unitPrice: 1.5 })
    })

    it('retorna defaults { limit: 0, unitPrice: 0 } quando settings não existem', async () => {
      const { fastify } = makeFastifyMock({
        settingAvulsoLimite: null,
        settingAvulsoUnit: null,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      const result = await service.getAvulsoConfig()

      expect(result).toEqual({ limit: 0, unitPrice: 0 })
    })
  })

  describe('setAvulsoConfig', () => {
    it('chama upsert para avulsoLimite e avulsoUnit', async () => {
      const { fastify, prisma } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      await service.setAvulsoConfig(15, 2.5)

      expect(prisma.setting.upsert).toHaveBeenCalledTimes(2)
      expect(prisma.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'avulsoLimite' },
          create: expect.objectContaining({ value: '15' }),
        }),
      )
      expect(prisma.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'avulsoUnit' },
          create: expect.objectContaining({ value: '2.5' }),
        }),
      )
    })
  })

  describe('processCutoff', () => {
    // Condomínio com slot cujo corte (20:00) casa a hora BRT fixada nos testes
    const condoComCorte = {
      id: 'condo-1',
      name: 'Cond Teste',
      isActive: true,
      deliverySlots: [{ name: 'manha', time: '06:30', cutoffTime: '20:00', isActive: true }],
    }

    beforeEach(() => {
      // 2026-06-22T23:00:00Z = 20:00 BRT → casa o cutoffTime '20:00' do slot
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-22T23:00:00Z'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('não tenta enviar push se não há usuários CLIENT com oneSignalPlayerId', async () => {
      const { fastify, prisma } = makeFastifyMock({
        condominiums: [condoComCorte],
        users: [],
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      await service.processCutoff()

      // O slot da manhã (corte 20:00) casa a hora atual → busca clientes do condomínio
      expect(prisma.condominium.findMany).toHaveBeenCalled()
      expect(prisma.user.findMany).toHaveBeenCalled()
    })

    it('filtra usuários que já têm Order para amanhã e não envia push para eles', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { fastify, prisma } = makeFastifyMock({
        condominiums: [condoComCorte],
        users: [
          { id: 'user-1', oneSignalPlayerId: 'player-1' },
          { id: 'user-2', oneSignalPlayerId: 'player-2' },
        ],
        orders: [{ id: 'order-1', userId: 'user-1', scheduledDate: tomorrow }],
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      await service.processCutoff()

      // user-1 tem order amanhã, apenas user-2 deveria receber push
      expect(prisma.order.findMany).toHaveBeenCalled()
    })

    it('não busca clientes quando nenhum slot casa o horário de corte atual', async () => {
      const { fastify, prisma } = makeFastifyMock({
        // corte 09:00 — não casa as 20:00 BRT fixadas
        condominiums: [{ ...condoComCorte, deliverySlots: [{ name: 'manha', time: '06:30', cutoffTime: '09:00', isActive: true }] }],
        users: [{ id: 'user-1', oneSignalPlayerId: 'player-1' }],
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      await service.processCutoff()

      expect(prisma.condominium.findMany).toHaveBeenCalled()
      expect(prisma.user.findMany).not.toHaveBeenCalled()
    })
  })

  describe('parseAgendaMinimos', () => {
    it('faz parse de um JSON válido, clampando para [0..12] inteiro', () => {
      const r = parseAgendaMinimos(JSON.stringify({ seg: 3, ter: 20, qua: -5, qui: 2.9 }))
      expect(r.seg).toBe(3)
      expect(r.ter).toBe(12) // clamp no teto
      expect(r.qua).toBe(0) // negativo → 0
      expect(r.qui).toBe(2) // floor
      expect(r.dom).toBe(0) // ausente → 0
    })

    it('degrada para todos 0 em JSON inválido/ausente', () => {
      expect(parseAgendaMinimos('{invalido')).toEqual({ seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 })
      expect(parseAgendaMinimos(null)).toEqual({ seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 })
    })
  })

  describe('getPedidoMinimoConfig', () => {
    it('retorna defaults (unico=1, agenda zerada) quando as chaves não existem', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      const config = await service.getPedidoMinimoConfig()
      expect(config.unico).toBe(1)
      expect(config.agenda.seg).toBe(0)
    })
  })

  describe('setPedidoMinimoConfig', () => {
    it('faz upsert das duas chaves (pedidoMinimoUnico + pedidoMinimoAgenda)', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      const agenda = { seg: 3, ter: 2, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }
      await service.setPedidoMinimoConfig(4, agenda)

      expect(prisma.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: 'pedidoMinimoUnico' } }),
      )
      const calls = prisma.setting.upsert.mock.calls as Array<[{ where: { key: string }; create: { value: string } }]>
      const agendaCall = calls.find((c) => c[0].where.key === 'pedidoMinimoAgenda')
      expect(agendaCall).toBeDefined()
      expect(JSON.parse(agendaCall![0].create.value)).toEqual(agenda)
    })
  })

  describe('restrições por dia — padrão global vs. override por condomínio', () => {
    const TODOS_LIVRES = { seg: false, ter: false, qua: false, qui: false, sex: false, sab: false, dom: false }
    const SEM_LIMITE = { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }

    it('getRestricoes sem condomínio devolve o padrão global com source=global', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      const r = await service.getRestricoes()

      expect(r.source).toEqual({ blocked: 'global', limits: 'global' })
      // Não vale ler o condomínio quando o escopo é o padrão.
      expect(prisma.condominium.findUnique).not.toHaveBeenCalled()
    })

    it('getRestricoes com condomínio marca em source o que é personalizado', async () => {
      const { fastify } = makeFastifyMock({
        condoOverrides: { blockedDaysOverride: { dom: true }, dayLimitOverride: null },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      const r = await service.getRestricoes('condo-1')

      expect(r.blocked.dom).toBe(true)
      expect(r.source).toEqual({ blocked: 'condo', limits: 'global' })
    })

    it('setRestricoes sem condomínio faz upsert das duas chaves globais', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      await service.setRestricoes({ ...TODOS_LIVRES, dom: true }, { ...SEM_LIMITE, ter: 20 })

      const calls = prisma.setting.upsert.mock.calls as Array<[{ where: { key: string }; create: { value: string } }]>
      const diasCall = calls.find((c) => c[0].where.key === 'diasBloqueados')
      const limitesCall = calls.find((c) => c[0].where.key === 'limitePedidosDia')
      expect(JSON.parse(diasCall![0].create.value).dom).toBe(true)
      expect(JSON.parse(limitesCall![0].create.value).ter).toBe(20)
      // O padrão global NÃO toca em condomínio.
      expect(prisma.condominium.update).not.toHaveBeenCalled()
    })

    it('setRestricoes com condomínio grava o override e não mexe no Setting global', async () => {
      const { fastify, prisma } = makeFastifyMock({ condoOverrides: { id: 'condo-1' } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      await service.setRestricoes({ ...TODOS_LIVRES, sab: true }, { ...SEM_LIMITE, sab: 5 }, 'condo-1')

      expect(prisma.condominium.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'condo-1' },
          data: {
            blockedDaysOverride: expect.objectContaining({ sab: true }),
            dayLimitOverride: expect.objectContaining({ sab: 5 }),
          },
        }),
      )
      const keys = (prisma.setting.upsert.mock.calls as Array<[{ where: { key: string } }]>).map(
        (c) => c[0].where.key,
      )
      expect(keys).not.toContain('diasBloqueados')
      expect(keys).not.toContain('limitePedidosDia')
    })

    it('setRestricoes com null grava null (volta a herdar o padrão)', async () => {
      const { fastify, prisma } = makeFastifyMock({ condoOverrides: { id: 'condo-1' } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      await service.setRestricoes(null, null, 'condo-1')

      expect(prisma.condominium.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { blockedDaysOverride: null, dayLimitOverride: null },
        }),
      )
    })

    it('setRestricoes recusa (404) condomínio inexistente sem gravar', async () => {
      const { fastify, prisma } = makeFastifyMock({ condoOverrides: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      await expect(
        service.setRestricoes(TODOS_LIVRES, SEM_LIMITE, 'nope'),
      ).rejects.toMatchObject({ statusCode: 404 })
      expect(prisma.condominium.update).not.toHaveBeenCalled()
    })

    it('avisa apenas os clientes DAQUELE condomínio ao bloquear um dia no escopo local', async () => {
      const { fastify, prisma } = makeFastifyMock({ condoOverrides: { id: 'condo-1' } })
      // Depois do update, a leitura de "depois" precisa refletir o novo override.
      prisma.condominium.findUnique
        .mockResolvedValueOnce({ blockedDaysOverride: null, dayLimitOverride: null }) // antes
        .mockResolvedValueOnce({ id: 'condo-1' }) // existência
        .mockResolvedValueOnce({ blockedDaysOverride: { sab: true }, dayLimitOverride: null }) // depois

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      await service.setRestricoes({ ...TODOS_LIVRES, sab: true }, SEM_LIMITE, 'condo-1')

      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true, condominiumId: 'condo-1' }),
        }),
      )
    })
  })

  // ── Config do gancho de porta (regras do grátis + preço do adicional) ───────
  describe('gancho de porta', () => {
    interface UpsertArg {
      where: { key: string }
      create: { value: string }
      update: Record<string, unknown>
    }

    /** Chamadas de upsert do Setting indexadas por chave. */
    function upsertsByKey(prisma: ReturnType<typeof makeFastifyMock>['prisma']) {
      const calls = prisma.setting.upsert.mock.calls as unknown as UpsertArg[][]
      return new Map(calls.map((call) => [call[0].where.key, call[0]]))
    }

    it('getGanchoConfig devolve o avulsoUnit e a fidelidade desligada quando as chaves não existem', async () => {
      const { fastify } = makeFastifyMock({ settingAvulsoUnit: { key: 'avulsoUnit', value: '1.20' } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)

      const config = await service.getGanchoConfig()

      expect(config.avulsoUnit).toBe(1.2)
      expect(config.recorrenciaMin).toBe(0)
      expect(config.recorrenciaDesde).toBeNull()
    })

    it('setGanchoConfig grava o mínimo de pedidos da fidelidade', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)

      const result = await service.setGanchoConfig(10, 5, 5)

      expect(upsertsByKey(prisma).get('ganchoRecorrenciaMin')?.create.value).toBe('5')
      expect(result.recorrenciaMin).toBe(5)
    })

    it('grava o marco de vigência na PRIMEIRA ativação, sem reescrever se já existir', async () => {
      const { fastify, prisma } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)

      await service.setGanchoConfig(10, 5, 5)

      const marco = upsertsByKey(prisma).get('ganchoRecorrenciaDesde')
      expect(marco).toBeDefined()
      // `update: {}` é o que garante "cria só se ausente" — reescrever zeraria o progresso.
      expect(marco?.update).toEqual({})
      expect(new Date(marco!.create.value).getTime()).not.toBeNaN()
    })

    it('não toca no marco ao DESLIGAR a regra (0) — progresso dos clientes preservado', async () => {
      const { fastify, prisma } = makeFastifyMock({
        settingGanchoRecorrenciaDesde: { key: 'ganchoRecorrenciaDesde', value: '2026-08-01T00:00:00.000Z' },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)

      await service.setGanchoConfig(10, 5, 0)

      expect(upsertsByKey(prisma).get('ganchoRecorrenciaMin')?.create.value).toBe('0')
      expect(upsertsByKey(prisma).has('ganchoRecorrenciaDesde')).toBe(false)
    })

    it('recorrenciaMin omitido preserva o valor vigente (PWA em cache não desliga a regra)', async () => {
      const { fastify, prisma } = makeFastifyMock({
        settingGanchoRecorrenciaMin: { key: 'ganchoRecorrenciaMin', value: '7' },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)

      const result = await service.setGanchoConfig(12, 6)

      expect(upsertsByKey(prisma).has('ganchoRecorrenciaMin')).toBe(false)
      expect(upsertsByKey(prisma).has('ganchoRecorrenciaDesde')).toBe(false)
      expect(result.recorrenciaMin).toBe(7)
    })
  })
})
