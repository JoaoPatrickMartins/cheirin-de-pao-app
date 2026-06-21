import { FastifyPluginAsync } from 'fastify'
import { SavedCardsRepository } from './saved-cards.repository.js'
import { SavedCardsService } from './saved-cards.service.js'
import { SavedCardsController } from './saved-cards.controller.js'

export const savedCardsRoute: FastifyPluginAsync = async (fastify) => {
  const repo = new SavedCardsRepository(fastify)
  const service = new SavedCardsService(fastify, repo)
  const controller = new SavedCardsController(service)

  const auth = { preHandler: [fastify.authenticate] }
  const tags = { tags: ['saved-cards'], security: [{ bearerAuth: [] }] }

  // GET /users/me/cards — CARD-01: lista cartões do usuário autenticado
  fastify.get('/users/me/cards', {
    ...auth,
    schema: { ...tags, summary: 'Listar cartões salvos do cliente' },
  }, controller.list.bind(controller))

  // POST /users/me/cards — CARD-07: cadastro avulso de cartão (sem cobrança)
  fastify.post('/users/me/cards', {
    ...auth,
    schema: { ...tags, summary: 'Cadastrar cartão salvo (sem cobrança)' },
  }, controller.create.bind(controller))

  // PATCH /users/me/cards/:id — CARD-04: definir cartão padrão (atômico via $transaction)
  fastify.patch('/users/me/cards/:id', {
    ...auth,
    schema: { ...tags, summary: 'Definir cartão salvo como padrão' },
  }, controller.setDefault.bind(controller))

  // DELETE /users/me/cards/:id — CARD-05: remover cartão (MP Customer API + Prisma)
  fastify.delete('/users/me/cards/:id', {
    ...auth,
    schema: { ...tags, summary: 'Remover cartão salvo' },
  }, controller.remove.bind(controller))
}
