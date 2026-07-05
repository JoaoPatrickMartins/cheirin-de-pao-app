// NotificationsService.notifyAdmins — respeita o toggle individual de cada admin.
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { NotificationType } from '@prisma/client'
import { NotificationsService } from '../notifications.service.js'

function makeFastify(admins: Array<Record<string, unknown>>) {
  const notificationCreate = vi.fn().mockResolvedValue({})
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue(admins),
    },
    notification: {
      create: notificationCreate,
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
  }
  return {
    fastify: { prisma, log: { error: vi.fn(), warn: vi.fn() } } as unknown as FastifyInstance,
    notificationCreate,
  }
}

const payload = {
  type: NotificationType.ADMIN_ORDER_PLACED,
  title: 'Novo pedido',
  body: 'Fulano · 2 pães',
  actionRoute: '/admin',
}

describe('NotificationsService.notifyAdmins', () => {
  it('persiste in-app para admin sem preferências (default ligado)', async () => {
    const { fastify, notificationCreate } = makeFastify([
      { id: 'a1', oneSignalPlayerId: null, adminNotificationPrefs: null },
    ])
    await new NotificationsService(fastify).notifyAdmins(payload)
    expect(notificationCreate).toHaveBeenCalledTimes(1)
    expect(notificationCreate.mock.calls[0][0].data.userId).toBe('a1')
    expect(notificationCreate.mock.calls[0][0].data.type).toBe('ADMIN_ORDER_PLACED')
  })

  it('PULA o admin que desligou explicitamente aquele tipo', async () => {
    const { fastify, notificationCreate } = makeFastify([
      { id: 'a1', oneSignalPlayerId: null, adminNotificationPrefs: { ADMIN_ORDER_PLACED: false } },
    ])
    await new NotificationsService(fastify).notifyAdmins(payload)
    expect(notificationCreate).not.toHaveBeenCalled()
  })

  it('notifica só os admins com o tipo ligado (mistura)', async () => {
    const { fastify, notificationCreate } = makeFastify([
      { id: 'on', oneSignalPlayerId: null, adminNotificationPrefs: { ADMIN_DELIVERY_DONE: false } },
      { id: 'off', oneSignalPlayerId: null, adminNotificationPrefs: { ADMIN_ORDER_PLACED: false } },
    ])
    await new NotificationsService(fastify).notifyAdmins(payload)
    expect(notificationCreate).toHaveBeenCalledTimes(1)
    expect(notificationCreate.mock.calls[0][0].data.userId).toBe('on')
  })
})
