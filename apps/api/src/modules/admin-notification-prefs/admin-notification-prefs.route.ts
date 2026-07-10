import { FastifyPluginAsync } from 'fastify'
import { AdminNotificationPrefsController } from './admin-notification-prefs.controller.js'
import { ADMIN_NOTIFICATION_TYPES } from './admin-notification-prefs.schema.js'

const prefsObjectSchema = {
  type: 'object',
  description: 'Mapa completo de toggles por tipo (true = ligado).',
  properties: Object.fromEntries(ADMIN_NOTIFICATION_TYPES.map((t) => [t, { type: 'boolean' }])),
} as const

/**
 * adminNotificationPrefsRoute — liga/desliga de notificações do admin.
 *
 * Rotas:
 *   GET /admin/notification-prefs  — mapa completo (defaults=true)
 *   PUT /admin/notification-prefs  — patch parcial { [type]: boolean }
 */
export const adminNotificationPrefsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminNotificationPrefsController(fastify)

  fastify.get(
    '/admin/notification-prefs',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — notifications'],
        summary: 'Preferências de notificação do admin',
        description: 'Retorna o mapa completo de toggles (todos os tipos, default ligado). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: { type: 'object', properties: { prefs: prefsObjectSchema } },
        },
      },
    },
    ctrl.get.bind(ctrl),
  )

  fastify.put(
    '/admin/notification-prefs',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — notifications'],
        summary: 'Atualizar preferências de notificação do admin',
        description: 'Aplica um patch parcial de toggles e retorna o mapa completo resultante. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(ADMIN_NOTIFICATION_TYPES.map((t) => [t, { type: 'boolean' }])),
        },
        response: {
          200: { type: 'object', properties: { prefs: prefsObjectSchema } },
        },
      },
    },
    ctrl.update.bind(ctrl),
  )
}
