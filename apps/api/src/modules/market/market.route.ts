import { FastifyPluginAsync } from 'fastify'
import { MarketController } from './market.controller.js'

/**
 * marketRoute — catálogo do mini market "Além do Pãozin" para o cliente (autenticado).
 */
export const marketRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new MarketController(fastify)

  fastify.get(
    '/market/catalog',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['market'],
        summary: 'Catálogo do mini market (cliente)',
        description:
          'Retorna categorias ativas e produtos ativos do mini market, com flags soldOut/limited (estoque fixo). Restrito a usuários autenticados.',
        security: [{ bearerAuth: [] }],
      },
    },
    ctrl.catalog.bind(ctrl),
  )

  // ── Cestinha (carrinho persistente por usuário) ──
  // Validação real via Zod no controller — rotas sem body/response schema (evita o Fastify
  // "comer" campos fora do response schema).
  fastify.get(
    '/market/cart',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['market'],
        summary: 'Obter a Cestinha do usuário',
        description:
          'Retorna a Cestinha do usuário autenticado com snapshot de produto (nome/preço/foto), breadQty, subtotal recalculado no servidor e mínimo da Cestinha.',
        security: [{ bearerAuth: [] }],
      },
    },
    ctrl.getCart.bind(ctrl),
  )

  fastify.put(
    '/market/cart',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['market'],
        summary: 'Substituir a Cestinha do usuário',
        description:
          'Substitui itens (+ breadQty) da Cestinha do usuário autenticado. Ignora produtos inativos/inexistentes.',
        security: [{ bearerAuth: [] }],
      },
    },
    ctrl.updateCart.bind(ctrl),
  )

  // ── Checkout (pagamento misto crédito + dinheiro) ──
  fastify.post(
    '/market/checkout',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['market'],
        summary: 'Finalizar a Cestinha (checkout)',
        description:
          'Valida (mínimo, corte do slot, disponibilidade, estoque), recalcula o total no servidor, reserva estoque + debita crédito e cria o MarketOrder. Se sobra dinheiro, cria o pagamento (Pix/cartão, purpose MARKET). Idempotente por idempotencyKey.',
        security: [{ bearerAuth: [] }],
      },
    },
    ctrl.checkout.bind(ctrl),
  )

  // ── Acompanhamento / histórico (C7) + cancelamento ──
  const auth = { preHandler: [fastify.authenticate] }
  const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'string', description: 'ID do MarketOrder.' } } }

  fastify.get('/market/orders/today', {
    ...auth,
    schema: { tags: ['market'], summary: 'Cestinhas de hoje do usuário', security: [{ bearerAuth: [] }] },
  }, ctrl.ordersToday.bind(ctrl))

  fastify.get('/market/orders/next', {
    ...auth,
    schema: { tags: ['market'], summary: 'Próximas Cestinhas do usuário', security: [{ bearerAuth: [] }] },
  }, ctrl.ordersNext.bind(ctrl))

  fastify.get('/market/orders/history', {
    ...auth,
    schema: { tags: ['market'], summary: 'Histórico de Cestinhas do usuário', security: [{ bearerAuth: [] }] },
  }, ctrl.ordersHistory.bind(ctrl))

  fastify.post('/market/orders/:id/cancel', {
    ...auth,
    schema: {
      tags: ['market'],
      summary: 'Cancelar Cestinha (antes do corte)',
      description: 'Cancela a Cestinha antes do corte do slot: devolve estoque e estorna TUDO em crédito (inclusive a parte em dinheiro, ceil a favor do cliente). Sem estorno no gateway. Idempotente.',
      security: [{ bearerAuth: [] }],
      params: idParams,
    },
  }, ctrl.cancelOrder.bind(ctrl))
}
