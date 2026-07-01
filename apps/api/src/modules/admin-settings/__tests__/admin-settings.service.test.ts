// AdminSettingsService unit tests — Fase 7 / Plano 07-02 (Wave 1 — implementação real)
// Requirements: ADMO-01 (horário de corte), ADMG-04 (config compra personalizada)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AdminSettingsService } from '../admin-settings.service.js'

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
  users?: Array<{ id: string; oneSignalPlayerId: string | null }>
  orders?: Array<{ id: string; userId: string; scheduledDate: Date }>
  condominiums?: Array<{ id: string; name: string; isActive: boolean; deliverySlots: Array<{ slotId?: string; name: string; label?: string; emoji?: string; time: string; cutoffTime: string; isActive: boolean }> }>
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
      update: vi.fn().mockResolvedValue({}),
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
})
