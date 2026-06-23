import { FastifyPluginAsync } from 'fastify'
import { normalizeSlot } from '../../lib/delivery-slots.js'

export const condominiumsRoute: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /client/condominium/slots
   *
   * Retorna os slots de entrega ativos do condomínio do cliente autenticado.
   *
   * SEGURANÇA (IDOR): condominiumId é obtido EXCLUSIVAMENTE de user.condominiumId
   * (via DB a partir do JWT) — nunca de query param ou body.
   */
  fastify.get('/client/condominium/slots', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['condominiums'],
      summary: 'Listar slots ativos do condomínio do cliente',
      description:
        'Retorna os slots de entrega ativos do condomínio vinculado ao cliente autenticado. O condominiumId é extraído do JWT — nunca aceita condominiumId de query param.',
      response: {
        200: {
          type: 'array',
          description: 'Lista de slots de entrega ativos.',
          items: {
            type: 'object',
            properties: {
              slotId: { type: 'string', description: 'Identificador estável do slot (manha | tarde).' },
              name: { type: 'string', description: '"manha" ou "tarde".' },
              label: { type: 'string', description: 'Rótulo de exibição (ex.: "Manhã").' },
              emoji: { type: 'string', description: 'Emoji de exibição do slot.' },
              time: { type: 'string', description: 'Horário de entrega (HH:MM).' },
              cutoffTime: { type: 'string', description: 'Horário de corte (HH:MM).' },
              isActive: { type: 'boolean', description: 'Slot ativo.' },
            },
          },
        },
        404: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const user = request.user!

    // Busca condominiumId do usuário autenticado — NUNCA de query param
    const dbUser = await fastify.prisma.user.findUnique({
      where: { id: user.id },
      select: { condominiumId: true },
    })

    if (!dbUser?.condominiumId) {
      return reply.code(404).send({ message: 'Usuário sem condomínio vinculado' })
    }

    const condo = await fastify.prisma.condominium.findUnique({
      where: { id: dbUser.condominiumId },
      select: { deliverySlots: true },
    })

    if (!condo) {
      return reply.code(404).send({ message: 'Condomínio não encontrado' })
    }

    const activeSlots = condo.deliverySlots.filter((s) => s.isActive).map(normalizeSlot)
    return reply.send(activeSlots)
  })

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
