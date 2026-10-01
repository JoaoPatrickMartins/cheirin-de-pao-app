import { FastifyPluginAsync } from 'fastify'
import { getPublicLandingInfo } from './public-landing.service.js'

/**
 * GET /public/landing — dados da página pública /sobre/ (plano-pagina-sobre.md §4.1). Rota pública.
 * TODO campo da resposta precisa estar no schema: o `fast-json-stringify` descarta o resto.
 */
export const publicLandingRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/public/landing',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['public'],
        summary: 'Dados da página Sobre (turnos e Indique e Ganhe)',
        description:
          'Rota pública, 60 req/min por IP, cache de 5 min. A página /sobre/ vem com o texto neutro no HTML e troca por cima com isto. `shifts`: turno ativo em pelo menos um condomínio ativo (sem nenhum, vale o padrão global). `referral`: só `{ active: false }` com o programa desligado; ligado, `reward` (quem indica, já com a campanha do dia) e `friendBonus` (o amigo, 0 = sem bônus). Sem horários nem nomes de condomínio.',
        response: {
          200: {
            type: 'object',
            properties: {
              shifts: {
                type: 'object',
                properties: {
                  manha: { type: 'boolean', description: 'Turno da manhã ativo.' },
                  tarde: { type: 'boolean', description: 'Turno da tarde ativo.' },
                },
              },
              referral: {
                type: 'object',
                properties: {
                  active: { type: 'boolean', description: 'Programa Indique e Ganhe ligado.' },
                  reward: { type: 'integer', description: 'Pãezins de quem indica (só com o programa ligado).' },
                  friendBonus: { type: 'integer', description: 'Pãezins do amigo no 1º pedido (só com o programa ligado).' },
                },
              },
            },
          },
          500: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (_request, reply) => {
      try {
        const info = await getPublicLandingInfo(fastify.prisma)
        return reply.header('Cache-Control', 'public, max-age=300').send(info)
      } catch (err) {
        fastify.log.error(err)
        // A página fica com o texto neutro do HTML — nada quebra do lado de lá.
        return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
      }
    },
  )
}
