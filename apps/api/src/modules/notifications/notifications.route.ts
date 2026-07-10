import { FastifyPluginAsync } from 'fastify'
import { NotificationsController } from './notifications.controller.js'

/**
 * notificationsRoute — registra rotas de notificações push.
 *
 * T-04-03-05: preHandler: fastify.authenticate garante que apenas usuários
 * autenticados registram seu player_id. userId extraído do JWT no controller.
 */
export const notificationsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new NotificationsController(fastify)

  fastify.post(
    '/users/push-token',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['notifications'],
        summary: 'Registrar token de push (Player ID)',
        description: 'Registra o Player ID do OneSignal para o dispositivo atual do cliente. Necessário para receber notificações push (pedido a caminho, pedido entregue, créditos baixos). O Player ID é gerado pelo SDK do OneSignal na primeira abertura do PWA. Substitui tokens anteriores do mesmo dispositivo.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['playerId'],
          properties: {
            playerId: { type: 'string', description: 'Player ID único do OneSignal para este dispositivo. Gerado automaticamente pelo SDK OneSignal no frontend.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Token registrado com sucesso.',
            properties: {
              message: { type: 'string', description: 'Confirmação de registro do token de push.' },
            },
          },
        },
      },
    },
    ctrl.savePushToken.bind(ctrl),
  )

  fastify.get(
    '/notifications/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['notifications'],
        summary: 'Listar notificações do cliente',
        description: 'Retorna as últimas 30 notificações do cliente autenticado, ordenadas da mais recente para a mais antiga. Inclui notificações lidas e não lidas. Útil para exibir o histórico de notificações no app.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            description: 'Lista das últimas 30 notificações.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID da notificação (MongoDB ObjectId).' },
                title: { type: 'string', description: 'Título da notificação.' },
                body: { type: 'string', description: 'Corpo/mensagem da notificação.' },
                isRead: { type: 'boolean', description: 'true se a notificação foi lida pelo cliente.' },
                createdAt: { type: 'string', description: 'Data/hora de criação (ISO 8601).' },
              },
            },
          },
        },
      },
    },
    ctrl.getNotifications.bind(ctrl),
  )

  fastify.patch(
    '/notifications/read-all',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['notifications'],
        summary: 'Marcar todas as notificações como lidas',
        description: 'Marca todas as notificações não lidas do cliente autenticado como lidas em uma única operação. Usar ao abrir o centro de notificações no app para zerar o badge de não lidas.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'Todas as notificações marcadas como lidas.',
            properties: {
              updatedCount: { type: 'integer', description: 'Número de notificações que foram marcadas como lidas.' },
            },
          },
        },
      },
    },
    ctrl.readAll.bind(ctrl),
  )

  fastify.get(
    '/notifications/unread-count',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['notifications'],
        summary: 'Contagem de notificações não lidas',
        description: 'Retorna apenas o contador de notificações não lidas do cliente. Usar para exibir o badge de notificações no ícone do sino. Requisição leve — apenas um count no banco, sem retornar os dados completos.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'Contador de não lidas.',
            properties: {
              count: { type: 'integer', description: 'Número de notificações não lidas. Use para o badge do ícone de notificações.' },
            },
          },
        },
      },
    },
    ctrl.getUnreadCount.bind(ctrl),
  )
}
