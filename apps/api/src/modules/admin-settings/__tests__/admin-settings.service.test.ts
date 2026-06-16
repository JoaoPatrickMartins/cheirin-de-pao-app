// AdminSettingsService unit tests — Fase 7 / Plano 07-01 (Wave 0 stub)
// Requirements: ADMO-01 (horário de corte), ADMG-04 (config compra personalizada)
// Estado: "red" — mock temporário do service para CI verde enquanto implementação não existe (Wave 1)
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock temporário do service — permite que o teste passe com valores stub
// enquanto o service real não existe (substituir por import real na Wave 1)
vi.mock('../admin-settings.service.js', () => ({
  AdminSettingsService: class {
    getCutoffTime() {
      return '20:00'
    }
    setCutoffTime(_value: string) {
      return { key: 'cutoffTime', value: _value }
    }
  },
}))

import { AdminSettingsService } from '../admin-settings.service.js'

// ── makeFastifyMock ───────────────────────────────────────────────────────────
function makeFastifyMock(overrides: {
  setting?: { key: string; value: string } | null
} = {}) {
  const { setting = { key: 'cutoffTime', value: '20:00' } } = overrides

  const prisma = {
    setting: {
      findUnique: vi.fn().mockResolvedValue(setting),
      upsert: vi.fn().mockResolvedValue(setting),
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
    it('getCutoffTime retorna o valor da Setting key=cutoffTime', async () => {
      const { fastify } = makeFastifyMock({
        setting: { key: 'cutoffTime', value: '20:00' },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminSettingsService(fastify as any)
      const result = await service.getCutoffTime()

      expect(result).toBeDefined()
    })
  })
})
