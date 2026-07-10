// NotificationsService unit tests — Fase 5 / Plano 05-02
// Requirements: ACOMP-04 (central de notificações in-app), ACOMP-05 (marcar como lido)
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── helpers de mock ──────────────────────────────────────────────────────────

/**
 * Cria um mock do fastify com prisma controlável por teste.
 * T-05-04: userId sempre de request.user!.id (JWT) — nunca de query param ou body.
 * Estes testes verificam que userId é sempre o argumento passado ao método (não outro valor).
 */
function makeFastifyMock(overrides: {
  notificationFindMany?: unknown[]
  notificationUpdateMany?: unknown
  notificationCount?: number
} = {}) {
  const {
    notificationFindMany = [],
    notificationUpdateMany = { count: 0 },
    notificationCount = 0,
  } = overrides

  const notificationMock = {
    findMany: vi.fn().mockResolvedValue(notificationFindMany),
    updateMany: vi.fn().mockResolvedValue(notificationUpdateMany),
    count: vi.fn().mockResolvedValue(notificationCount),
    create: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({}),
  }

  return {
    fastify: {
      prisma: { notification: notificationMock },
      log: { error: vi.fn(), warn: vi.fn() },
    } as unknown,
    notificationMock,
  }
}

// ── testes ───────────────────────────────────────────────────────────────────

describe('NotificationsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Caso 05-09a: getByUserId ─────────────────────────────────────────────

  it('05-09a: getByUserId chama prisma.notification.findMany com where.userId correto (nunca outro userId)', async () => {
    const { fastify, notificationMock } = makeFastifyMock({
      notificationFindMany: [{ id: 'notif-1', userId: 'userId-x', isRead: false }],
    })

    const { NotificationsService } = await import('../notifications.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new NotificationsService(fastify as any)

    await service.getByUserId('userId-x')

    expect(notificationMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'userId-x' }),
      }),
    )

    // Garantia: userId nunca é outro valor (isolamento por userId)
    const call = notificationMock.findMany.mock.calls[0][0]
    expect(call.where.userId).toBe('userId-x')
    expect(call.where.userId).not.toBe('userId-y')
    expect(call.where.userId).not.toBe('admin')
  })

  // ── Caso 05-09b: markAllRead ─────────────────────────────────────────────

  it('05-09b: markAllRead chama updateMany com where: { userId, isRead: false } e data: { isRead: true }', async () => {
    const { fastify, notificationMock } = makeFastifyMock()

    const { NotificationsService } = await import('../notifications.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new NotificationsService(fastify as any)

    await service.markAllRead('userId-x')

    expect(notificationMock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'userId-x', isRead: false }),
        data: expect.objectContaining({ isRead: true }),
      }),
    )

    // Garantia de isolamento: userId correto e apenas isRead: false
    const call = notificationMock.updateMany.mock.calls[0][0]
    expect(call.where.userId).toBe('userId-x')
    expect(call.where.isRead).toBe(false)
    expect(call.data.isRead).toBe(true)
  })

  // ── Caso 05-09c: countUnread ─────────────────────────────────────────────

  it('05-09c: countUnread chama prisma.notification.count com where: { userId, isRead: false }', async () => {
    const { fastify, notificationMock } = makeFastifyMock({ notificationCount: 5 })

    const { NotificationsService } = await import('../notifications.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new NotificationsService(fastify as any)

    const result = await service.countUnread('userId-x')

    expect(notificationMock.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'userId-x', isRead: false }),
      }),
    )

    // Garantia: retorna o valor do count do prisma
    expect(result).toBe(5)
  })
})
