import { FastifyPluginAsync } from 'fastify'

export const condominiumsRoute: FastifyPluginAsync = async (fastify) => {
  // Public route — no preHandler required
  fastify.get('/condominiums', async (_request, reply) => {
    try {
      const condominiums = await fastify.prisma.condominium.findMany({
        orderBy: { name: 'asc' },
      })
      const result = condominiums.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        neighborhood: c.address.complement ?? c.address.city,
      }))
      return reply.send(result)
    } catch (err) {
      return reply.status(500).send({ error: String(err) })
    }
  })
}
