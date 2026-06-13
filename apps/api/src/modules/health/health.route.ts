import { FastifyPluginAsync } from 'fastify'

export const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    try {
      await fastify.prisma.$runCommandRaw({ ping: 1 })
      return reply.send({ ok: true, db: 'connected' })
    } catch (err) {
      return reply.status(503).send({ ok: false, db: 'disconnected', error: String(err) })
    }
  })
}
