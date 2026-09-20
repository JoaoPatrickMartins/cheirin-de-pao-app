import { FastifyPluginAsync } from 'fastify'
import { BannersController } from './banners.controller.js'

/**
 * bannersRoute — banners, avisos e promoções do cliente (autenticado).
 *
 * A telemetria é uma rota só, com o evento no path (`seen` | `click` | `dismiss`), porque as três
 * escrevem no MESMO documento (BannerView) e diferem apenas no campo que tocam.
 */
export const bannersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new BannersController(fastify)

  fastify.get(
    '/client/banners',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['banners'],
        summary: 'Banners do cliente',
        description:
          'Peças já filtradas por janela de exibição, condomínio e frequência, agrupadas por formato: { popup, strip, market[] }. O destino vem como URL pronta (actionUrl) — null quando a peça é só aviso.',
        security: [{ bearerAuth: [] }],
      },
    },
    ctrl.list.bind(ctrl),
  )

  fastify.post(
    '/client/banners/:id/:event',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['banners'],
        summary: 'Registrar exibição, clique ou dispensa',
        description:
          'Fire-and-forget: responde 202 mesmo com id inexistente ou evento inválido. `seen` incrementa a contagem de exibições; `click` e `dismiss` marcam a data e NÃO recontam a impressão.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'event'],
          properties: {
            id: { type: 'string', description: 'ID do banner.' },
            event: { type: 'string', enum: ['seen', 'click', 'dismiss'], description: 'O que aconteceu.' },
          },
        },
      },
    },
    ctrl.track.bind(ctrl),
  )
}
