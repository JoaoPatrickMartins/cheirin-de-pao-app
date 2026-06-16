import { FastifyPluginAsync } from 'fastify'

export const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', {
    schema: {
      tags: ['health'],
      summary: 'Verificar saúde da API',
      description: 'Verifica se a API está online e se a conexão com o MongoDB Atlas está ativa. Retorna ok=true e db="connected" quando tudo funciona. Retorna 503 se o MongoDB não responder ao ping.',
      response: {
        200: {
          type: 'object',
          description: 'API e banco de dados operacionais.',
          properties: {
            ok: { type: 'boolean', description: 'true quando a API está saudável e o banco responde.' },
            db: { type: 'string', description: 'Status da conexão MongoDB: "connected" ou "disconnected".' },
          },
        },
        503: {
          type: 'object',
          description: 'MongoDB não respondeu ao ping.',
          properties: {
            ok: { type: 'boolean', description: 'Sempre false quando o banco está indisponível.' },
            db: { type: 'string', description: 'Sempre "disconnected".' },
            error: { type: 'string', description: 'Mensagem de erro técnico.' },
          },
        },
      },
    },
  }, async (_request, reply) => {
    try {
      await fastify.prisma.$runCommandRaw({ ping: 1 })
      return reply.send({ ok: true, db: 'connected' })
    } catch (err) {
      return reply.status(503).send({ ok: false, db: 'disconnected', error: String(err) })
    }
  })
}
