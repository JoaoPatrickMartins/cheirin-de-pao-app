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

  // ── Cestinhas (MarketOrder) ──
  // Rota estática antes da dinâmica /orders/:id (padrão das demais rotas admin).
  fastify.get('/admin/market/orders', {
    ...auth,
    schema: {
      tags: [tag],
      summary: 'Listar Cestinhas (admin)',
      description:
        'Lista os pedidos do mini market com filtros (intervalo de datas de entrega, status CSV, condomínio, busca por cliente/apto) e paginação. Cada linha traz itens com preço, split crédito×dinheiro, pagamento, entregador e os marcos do ciclo.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Data de entrega inicial (YYYY-MM-DD, BRT).' },
          to: { type: 'string', description: 'Data de entrega final (YYYY-MM-DD, BRT).' },
          status: { type: 'string', description: 'CSV de status (ex.: "SCHEDULED,DELIVERED"). Valores desconhecidos são ignorados.' },
          condominiumId: { type: 'string' },
          q: { type: 'string', description: 'Busca por nome do cliente ou apartamento.' },
          limit: { type: 'integer', description: 'Máx. de itens (1–200, default 50).' },
          skip: { type: 'integer', description: 'Offset de paginação.' },
        },
      },
    },
  }, ctrl.listOrders.bind(ctrl))

  fastify.get('/admin/market/orders/:id', {
    ...auth,
    schema: {
      tags: [tag],
      summary: 'Obter Cestinha por ID (admin)',
      security: [{ bearerAuth: [] }],
      params: idParams,
    },
  }, ctrl.getOrder.bind(ctrl))

  fastify.post('/admin/market/orders/:id/cancel', {
    ...auth,
    schema: {
      tags: [tag],
      summary: 'Cancelar Cestinha (admin)',
      description:
        'Cancela uma Cestinha SEM o gate de corte do cliente e devolve os pãezinhos (inclusive a parte paga em dinheiro, convertida — DEC-36) e o estoque dos produtos. Idempotente. Sem estorno no gateway. É o caminho que faltava: passado o corte o cliente é barrado e o estorno genérico de purpose=MARKET é bloqueado em Pagamentos de propósito.',
      security: [{ bearerAuth: [] }],
      params: idParams,
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Motivo do cancelamento (auditoria).' },
          refundCredits: { type: 'boolean', description: 'Devolve os pãezinhos. Default true.' },
          returnStock: { type: 'boolean', description: 'Devolve o estoque dos produtos. Default true.' },
        },
      },
    },
  }, ctrl.cancelOrder.bind(ctrl))

  // Rota estática num segmento próprio (`stock-outlook` ≠ `orders`), então não há risco de ser
  // capturada pelas rotas `/orders/:id` — ao contrário do `split-preview` dos pedidos ao fornecedor,
  // que precisou vir antes por dividir o segmento com `/:id`.
  fastify.get('/admin/market/stock-outlook', {
    ...auth,
    schema: {
      tags: [tag],
      summary: 'Comprometido por produto e por dia (admin)',
      description:
        'Onda G1 — o que já está comprometido de cada produto em cada um dos próximos dias, para preparar e comprar. `confirmed` são pedidos que existem de verdade (é por ele que se prepara: aguardando pagamento pode morrer no sweep); `reserved`/`capacity`/`available` são o contador de vagas do dia (inclui aguardando pagamento, é por ele que se sabe se ainda dá para vender). A diferença entre os dois é o que está preso em carrinho não pago. Produto FIXO traz `stock` em vez de vagas. Restrito a ADMIN.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: { days: { type: 'integer', minimum: 1, maximum: 30, description: 'Janela em dias (padrão 7).' } },
      },
    },
  }, ctrl.stockOutlook.bind(ctrl))

  fastify.post('/admin/market/orders/:id/resolve-loss', {
    ...auth,
    schema: {
      tags: [tag],
      summary: 'Resolver Cestinha não entregue (admin)',
      description:
        'Dá o desfecho FÍSICO de uma Cestinha marcada como NÃO ENTREGUE (Onda G2): os itens voltaram à prateleira (`returnStock`) e/ou o cliente recebe os pãezinhos de volta (`refundCredits`). Os dois campos são obrigatórios — a política é que ninguém decida isso por omissão, porque só quem recebeu o entregador de volta sabe o que aconteceu com a mercadoria. Preserva o status e o motivo originais da falha; o desfecho vai em `lossReason`. Idempotente: resolver de novo devolve o estado sem estornar duas vezes. Estoque DAILY não é liberado de propósito (o `reserved` é a capacidade de um dia já encerrado). Restrito a ADMIN.',
      security: [{ bearerAuth: [] }],
      params: idParams,
      body: {
        type: 'object',
        required: ['returnStock', 'refundCredits'],
        properties: {
          returnStock: { type: 'boolean', description: 'true se os itens voltaram ao estoque (só produtos FIXED).' },
          refundCredits: { type: 'boolean', description: 'true para devolver os pãezinhos ao cliente.' },
          reason: { type: 'string', description: 'O que aconteceu (perdido, avariado, devolvido…).' },
        },
      },
    },
  }, ctrl.resolveLoss.bind(ctrl))
}
