import { FastifyPluginAsync } from 'fastify'
import { AdminBannersController } from './admin-banners.controller.js'

/**
 * adminBannersRoute — banners, avisos e promoções (admin): CRUD + upload da arte.
 *
 * Segurança: preHandler authenticate (JWT) + role ADMIN inline no controller.
 * Validação real via Zod no controller — por isso as rotas não declaram body/response schema
 * (evita também o Fastify "comer" campos fora do response schema).
 */
export const adminBannersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminBannersController(fastify)
  const auth = { preHandler: [fastify.authenticate] }
  const tag = 'admin — banners'
  const idParams = {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', description: 'ID (MongoDB ObjectId).' } },
  }

  fastify.get('/admin/banners', {
    ...auth,
    schema: {
      tags: [tag],
      summary: 'Listar banners (admin)',
      description:
        'Todas as peças com o status derivado (no ar / agendado / expirado / pausado) e as métricas (alcance, impressões, cliques, dispensas, CTR).',
      security: [{ bearerAuth: [] }],
    },
  }, ctrl.list.bind(ctrl))

  fastify.get('/admin/banners/:id', {
    ...auth,
    schema: { tags: [tag], summary: 'Obter banner por ID (admin)', security: [{ bearerAuth: [] }], params: idParams },
  }, ctrl.get.bind(ctrl))

  fastify.post('/admin/banners', {
    ...auth,
    schema: {
      tags: [tag],
      summary: 'Criar banner (admin)',
      description:
        'Formato define o conteúdo exigido: POPUP e MARKET pedem imagem + texto alternativo; STRIP pede título e recusa imagem.',
      security: [{ bearerAuth: [] }],
    },
  }, ctrl.create.bind(ctrl))

  fastify.patch('/admin/banners/:id', {
    ...auth,
    schema: {
      tags: [tag],
      summary: 'Atualizar banner (admin)',
      description:
        'O patch é validado JUNTO com o que já está gravado — trocar só o formato não passa se o resto do cadastro ficar inconsistente.',
      security: [{ bearerAuth: [] }],
      params: idParams,
    },
  }, ctrl.update.bind(ctrl))

  fastify.delete('/admin/banners/:id', {
    ...auth,
    schema: {
      tags: [tag],
      summary: 'Remover banner (admin)',
      description: 'Remove a peça e o histórico de exibições dela.',
      security: [{ bearerAuth: [] }],
      params: idParams,
    },
  }, ctrl.remove.bind(ctrl))

  // Upload da arte (multipart/form-data) → { url }
  fastify.post('/admin/banners/upload', {
    ...auth,
    schema: { tags: [tag], summary: 'Upload da arte do banner (admin)', security: [{ bearerAuth: [] }], consumes: ['multipart/form-data'] },
  }, ctrl.uploadArt.bind(ctrl))
}
