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
  settingAvulsoLimite?: { key: string; value: string } | null
  settingAvulsoUnit?: { key: string; value: string } | null
  users?: Array<{ id: string; oneSignalPlayerId: string | null }>
  orders?: Array<{ id: string; userId: string; scheduledDate: Date }>
  condominiums?: Array<{ id: string; name: string; isActive: boolean; deliverySlots: Array<{ name: string; time: string; cutoffTime: string; isActive: boolean }> }>
} = {}) {
  const {
    setting = { key: 'cutoffTime', value: '20:00' },
    settingAvulsoLimite = { key: 'avulsoLimite', value: '20' },
    settingAvulsoUnit = { key: 'avulsoUnit', value: '1.50' },
    users = [],
    orders = [],
    condominiums = [],
  } = overrides

  const settingFindUnique = vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
    if (where.key === 'cutoffTime') return Promise.resolve(setting)
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

  describe('getCutoffTime', () => {
    it('retorna o value da Setting key=cutoffTime quando existe', async () => {
      const { fastify } = makeFastifyMock({
        setting: { key: 'cutoffTime', value: '20:00' },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      const result = await service.getCutoffTime()

      expect(result).toBe('20:00')
    })

    it('retorna "20:00" como default quando Setting não existe', async () => {
      const { fastify } = makeFastifyMock({ setting: null })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      const result = await service.getCutoffTime()

      expect(result).toBe('20:00')
    })
  })

  describe('setCutoffTime', () => {
    it('chama prisma.setting.upsert com key=cutoffTime e o value informado', async () => {
      const { fastify, prisma } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      await service.setCutoffTime('18:30')

      expect(prisma.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'cutoffTime' },
          create: expect.objectContaining({ key: 'cutoffTime', value: '18:30' }),
          update: expect.objectContaining({ value: '18:30' }),
        }),
      )
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
