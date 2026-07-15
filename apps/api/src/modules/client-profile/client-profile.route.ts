import { FastifyPluginAsync } from 'fastify'
import { ClientProfileController } from './client-profile.controller.js'

export const clientProfileRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new ClientProfileController(fastify)
  const rateLimit = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }

  fastify.get('/client/profile', {
    preHandler: [fastify.authenticate],
    schema: { tags: ['client-profile'], security: [{ bearerAuth: [] }], summary: 'Obter perfil do cliente' },
  }, ctrl.getProfile.bind(ctrl))

  fastify.patch('/client/profile', {
    preHandler: [fastify.authenticate],
    schema: { tags: ['client-profile'], security: [{ bearerAuth: [] }], summary: 'Atualizar perfil do cliente' },
  }, ctrl.updateProfile.bind(ctrl))

  fastify.get('/client/onboarding', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['client-profile'],
      security: [{ bearerAuth: [] }],
      summary: 'Status do tutorial de primeiro acesso',
      description:
        'Fonte de verdade do onboarding. `completed=false` → o app deve exibir o tutorial automaticamente. Restrito a CLIENT.',
      response: {
        200: {
          type: 'object',
          properties: {
            completed: { type: 'boolean' },
            onboardingCompletedAt: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, ctrl.getOnboarding.bind(ctrl))

  fastify.post('/client/onboarding/complete', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['client-profile'],
      security: [{ bearerAuth: [] }],
      summary: 'Marcar tutorial de primeiro acesso como concluído',
      description:
        'Registra a conclusão/pulo do tutorial. Idempotente — chamadas repetidas mantêm a data original. Restrito a CLIENT.',
      response: {
        200: {
          type: 'object',
          properties: {
            completed: { type: 'boolean' },
            onboardingCompletedAt: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, ctrl.completeOnboarding.bind(ctrl))

  fastify.post('/client/profile/contact/request-change', {
    preHandler: [fastify.authenticate],
    ...rateLimit,
    schema: { tags: ['client-profile'], security: [{ bearerAuth: [] }], summary: 'Solicitar mudança de contato (envia OTP)' },
  }, ctrl.requestContactChange.bind(ctrl))

  fastify.post('/client/profile/contact/confirm-change', {
    preHandler: [fastify.authenticate],
    ...rateLimit,
    schema: { tags: ['client-profile'], security: [{ bearerAuth: [] }], summary: 'Confirmar mudança de contato (valida OTP)' },
  }, ctrl.confirmContactChange.bind(ctrl))
}
