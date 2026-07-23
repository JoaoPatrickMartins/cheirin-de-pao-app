import { FastifyPluginAsync } from 'fastify'
import { AdminMarketController } from './admin-market.controller.js'

/**
 * adminMarketRoute — mini market "Além do Pãozin" (admin): CRUD de produtos e categorias,
 * ajuste de estoque, upload de foto e config (mínimo da Cestinha).
 *
 * Segurança: preHandler authenticate (JWT) + role ADMIN inline no controller.
 * Validação real via Zod no controller — por isso as rotas não declaram body/response schema
 * (evita também o Fastify "comer" campos fora do response schema).
 */
export const adminMarketRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminMarketController(fastify)
  const auth = { preHandler: [fastify.authenticate] }
  const tag = 'admin — market'
  const idParams = {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', description: 'ID (MongoDB ObjectId).' } },
  }

  // ── Produtos ──
  fastify.get('/admin/market/products', {
    ...auth,
    schema: { tags: [tag], summary: 'Listar produtos (admin)', security: [{ bearerAuth: [] }] },
  }, ctrl.listProducts.bind(ctrl))

  fastify.get('/admin/market/products/:id', {
    ...auth,
    schema: { tags: [tag], summary: 'Obter produto por ID (admin)', security: [{ bearerAuth: [] }], params: idParams },
  }, ctrl.getProduct.bind(ctrl))

  fastify.post('/admin/market/products', {
    ...auth,
    schema: { tags: [tag], summary: 'Criar produto (admin)', security: [{ bearerAuth: [] }] },
  }, ctrl.createProduct.bind(ctrl))

  fastify.patch('/admin/market/products/:id', {
    ...auth,
    schema: { tags: [tag], summary: 'Atualizar produto (admin)', security: [{ bearerAuth: [] }], params: idParams },
  }, ctrl.updateProduct.bind(ctrl))

  fastify.delete('/admin/market/products/:id', {
    ...auth,
    schema: { tags: [tag], summary: 'Remover produto (admin)', security: [{ bearerAuth: [] }], params: idParams },
  }, ctrl.removeProduct.bind(ctrl))

  fastify.patch('/admin/market/products/:id/stock', {
    ...auth,
    schema: { tags: [tag], summary: 'Ajustar estoque do produto (admin)', security: [{ bearerAuth: [] }], params: idParams },
  }, ctrl.setStock.bind(ctrl))

  // Upload de foto (multipart/form-data) → { url }
  fastify.post('/admin/market/upload', {
    ...auth,
    schema: { tags: [tag], summary: 'Upload de foto de produto (admin)', security: [{ bearerAuth: [] }], consumes: ['multipart/form-data'] },
  }, ctrl.uploadImage.bind(ctrl))

  // ── Categorias ──
  fastify.get('/admin/market/categories', {
    ...auth,
    schema: { tags: [tag], summary: 'Listar categorias (admin)', security: [{ bearerAuth: [] }] },
  }, ctrl.listCategories.bind(ctrl))

  fastify.post('/admin/market/categories', {
    ...auth,
    schema: { tags: [tag], summary: 'Criar categoria (admin)', security: [{ bearerAuth: [] }] },
  }, ctrl.createCategory.bind(ctrl))

  fastify.patch('/admin/market/categories/:id', {
    ...auth,
    schema: { tags: [tag], summary: 'Atualizar categoria (admin)', security: [{ bearerAuth: [] }], params: idParams },
  }, ctrl.updateCategory.bind(ctrl))

  fastify.delete('/admin/market/categories/:id', {
    ...auth,
    schema: { tags: [tag], summary: 'Remover categoria (admin)', security: [{ bearerAuth: [] }], params: idParams },
  }, ctrl.removeCategory.bind(ctrl))

  // ── Config ──
  fastify.get('/admin/market/config', {
    ...auth,
    schema: { tags: [tag], summary: 'Config do mini market (admin)', security: [{ bearerAuth: [] }] },
  }, ctrl.getConfig.bind(ctrl))

  fastify.patch('/admin/market/config', {
    ...auth,
    schema: { tags: [tag], summary: 'Atualizar config do mini market (admin)', security: [{ bearerAuth: [] }] },
  }, ctrl.setConfig.bind(ctrl))
}
