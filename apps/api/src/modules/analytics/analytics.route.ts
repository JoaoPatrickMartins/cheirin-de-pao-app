import { FastifyPluginAsync } from 'fastify'
import { AnalyticsController } from './analytics.controller.js'

/**
 * analyticsRoute — ingestão de eventos de acesso/login (rota PÚBLICA, sem auth).
 *
 * POST /analytics/event — registra um evento anônimo de acesso (abertura do app)
 * ou de login. Usado pelos Relatórios do admin (métricas de acesso, login e conversão).
 */
export const analyticsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AnalyticsController(fastify)

  fastify.post(
    '/analytics/event',
    {
      schema: {
        tags: ['analytics'],
        summary: 'Registrar evento de acesso/login',
        description:
          'Rota pública. Registra um evento anônimo para os Relatórios: "access" (abertura do app/PWA) ou "login" (login efetuado). O visitorId é o ID anônimo do dispositivo — sem PII. Fire-and-forget: sempre responde 202.',
        body: {
          type: 'object',
          required: ['type', 'visitorId'],
          properties: {
            type: { type: 'string', enum: ['access', 'login'], description: 'Tipo do evento.' },
            visitorId: { type: 'string', description: 'ID anônimo do dispositivo (device_id).' },
            userId: { type: 'string', description: 'ID do usuário (apenas em login).' },
            role: { type: 'string', enum: ['CLIENT', 'COURIER', 'ADMIN'], description: 'Role (apenas em login).' },
            path: { type: 'string', description: 'Rota/tela inicial.' },
            referrer: { type: 'string', description: 'Referrer da navegação.' },
            platform: { type: 'string', enum: ['pwa', 'browser'], description: 'Plataforma de acesso.' },
          },
        },
        response: {
          202: {
            type: 'object',
            description: 'Evento aceito.',
            properties: { ok: { type: 'boolean' } },
          },
        },
      },
    },
    ctrl.track.bind(ctrl),
  )
}
