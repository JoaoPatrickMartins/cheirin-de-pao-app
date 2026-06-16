import { FastifyPluginAsync } from 'fastify'

export const condominiumsRoute: FastifyPluginAsync = async (fastify) => {
  // Public route — no preHandler required
  fastify.get('/condominiums', {
    schema: {
      tags: ['condominiums'],
      summary: 'Listar condomínios disponíveis',
      description: 'Retorna todos os condomínios cadastrados no sistema, ordenados por nome. Utilizado no onboarding do cliente para que ele escolha seu condomínio. Rota pública — não requer autenticação.',
      response: {
        200: {
          type: 'array',
          description: 'Lista de condomínios disponíveis para seleção no cadastro.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID único do condomínio (MongoDB ObjectId).' },
              name: { type: 'string', description: 'Nome do condomínio (ex: Residencial das Flores).' },
              type: { type: 'string', description: 'Tipo: SINGLE_ENTRANCE (entrada única) ou BLOCKS (por blocos).' },
              neighborhood: { type: 'string', description: 'Bairro ou cidade do condomínio, extraído do endereço.' },
            },
          },
        },
        500: {
          type: 'object',
          description: 'Erro interno ao buscar condomínios.',
          properties: {
            error: { type: 'string', description: 'Mensagem de erro.' },
          },
        },
      },
    },
  }, async (_request, reply) => {
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
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro ao carregar condomínios.' })
    }
  })
}
