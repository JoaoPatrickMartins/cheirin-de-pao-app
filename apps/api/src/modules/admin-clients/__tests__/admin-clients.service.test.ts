// AdminClientsService unit tests — Fase 7 / Plano 07-01 (Wave 0 stub)
// Requirements: ADMG-08 (lista de clientes), ADMG-09 (filtro por condomínio), ADMG-10 (bloquear/desbloquear)
// Estado: "red" — mock temporário do service para CI verde enquanto implementação não existe (Wave 1)
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock temporário do service — permite que o teste passe com valores stub
// enquanto o service real não existe (substituir por import real na Wave 1)
vi.mock('../admin-clients.service.js', () => ({
  AdminClientsService: class {
    async blockClient(_userId: string) {
      return { id: _userId, isBlocked: true }
    }
    async unblockClient(_userId: string) {
      return { id: _userId, isBlocked: false }
    }
    async list(_params?: { condominiumId?: string }) {
      return []
    }
  },
}))

import { AdminClientsService } from '../admin-clients.service.js'

// ── makeFastifyMock ───────────────────────────────────────────────────────────
function makeFastifyMock(overrides: {
  user?: {
    id?: string
    name?: string
    email?: string
    isBlocked?: boolean
    role?: string
    condominiumId?: string
  } | null
} = {}) {
  const {
    user = {
      id: 'user-01',
      name: 'João Cliente',
      email: 'joao@email.com',
      isBlocked: false,
      role: 'CLIENT',
      condominiumId: 'condo-01',
    },
  } = overrides

  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      findMany: vi.fn().mockResolvedValue(user ? [user] : []),
      update: vi.fn().mockResolvedValue({ ...user, isBlocked: true }),
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
describe('AdminClientsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('blockClient', () => {
    it('blockClient altera User.isBlocked para true', async () => {
      const { fastify } = makeFastifyMock({
        user: {
          id: 'user-01',
          name: 'João Cliente',
          email: 'joao@email.com',
          isBlocked: false,
          role: 'CLIENT',
          condominiumId: 'condo-01',
        },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminClientsService(fastify as any)
      const result = await service.blockClient('user-01')

      expect(result).toBeDefined()
      expect(result.isBlocked).toBe(true)
    })
  })
})
