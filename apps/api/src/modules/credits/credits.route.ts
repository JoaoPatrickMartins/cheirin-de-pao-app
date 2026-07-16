import { FastifyPluginAsync } from 'fastify'
import { CreditsController } from './credits.controller.js'

export const creditsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new CreditsController(fastify)

  fastify.get('/combos', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['credits'],
      summary: 'Listar combos disponíveis',
      description: 'Retorna todos os combos de pãezinhos disponíveis para compra. Combos com promoção ativa são destacados. O preço por unidade do combo é sempre menor que o preço avulso. Combos inativos não são retornados.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          description: 'Lista de combos ativos.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID do combo (MongoDB ObjectId).' },
              name: { type: 'string', description: 'Nome do combo (ex: Combo 10 Pãezinhos).' },
              quantity: { type: 'integer', description: 'Quantidade de pãezinhos incluídos no combo.' },
              price: { type: 'number', description: 'Preço total do combo em reais.' },
              tag: { type: 'string', description: 'Tag promocional opcional (ex: "Mais Popular", "Melhor Custo-Benefício").' },
              description: { type: 'string', nullable: true, description: 'Subtítulo curto exibido no card (ex.: "O equilíbrio da casa").' },
              economyPercent: { type: 'integer', nullable: true, description: 'Economia % vs. comprar avulso, calculada. null quando não há economia ou a tag está desligada.' },
              economySavings: { type: 'number', nullable: true, description: 'Economia em R$ vs. comprar avulso, calculada. Exibida no pill de economia do card.' },
              isOnPromotion: { type: 'boolean', description: 'true se o combo está em promoção ativa.' },
              antes: { type: 'number', description: 'Preço original (antes do desconto). Presente apenas quando isOnPromotion=true; usado para o preço riscado.' },
            },
          },
        },
      },
    },
  }, ctrl.listCombos.bind(ctrl))

  fastify.get('/pricing', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['credits'],
      summary: 'Consultar preço do pão avulso',
      description: 'Retorna o preço unitário do pão avulso e o limite máximo de pãezinhos por pedido avulso. O preço avulso é sempre maior que o preço por unidade de qualquer combo. Configurável pelo admin.',
      security: [{ bearerAuth: [] }],
      response: {
        // Campos precisam bater com o que o service retorna (avulsoUnit/avulsoLimite),
        // senão o fast-json-stringify descarta tudo e devolve {} → tela quebra no front.
        200: {
          type: 'object',
          description: 'Configuração de preço avulso.',
          properties: {
            avulsoUnit: { type: 'number', description: 'Preço unitário do pão avulso em reais.' },
            avulsoLimite: { type: 'integer', description: 'Quantidade máxima de pãezinhos permitida por pedido avulso.' },
            pedidoMinimoUnico: { type: 'integer', description: 'Quantidade mínima de pães por pedido único.' },
            pedidoMinimoAgenda: {
              type: 'object',
              description: 'Mínimo por dia da semana da agenda (0 = sem mínimo). Aplica-se por turno.',
              properties: {
                seg: { type: 'integer' },
                ter: { type: 'integer' },
                qua: { type: 'integer' },
                qui: { type: 'integer' },
                sex: { type: 'integer' },
                sab: { type: 'integer' },
                dom: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  }, ctrl.getPricing.bind(ctrl))

  fastify.get(
    '/credits/history',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['credits'],
        summary: 'Histórico de transações de crédito',
        description: 'Retorna o histórico completo de movimentação de créditos do cliente autenticado. Inclui créditos adicionados por pagamentos aprovados e créditos debitados por pedidos. Ordenado do mais recente para o mais antigo.',
        security: [{ bearerAuth: [] }],
        response: {
          // O controller retorna um ARRAY de transações (creditTransaction.findMany).
          // Schema precisa ser 'array' — com 'object' o fast-json-stringify devolvia {} (página em branco).
          200: {
            type: 'array',
            description: 'Transações de crédito do cliente, da mais recente para a mais antiga.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID da transação.' },
                type: { type: 'string', description: 'Tipo: PURCHASE, DELIVERY, ADMIN_GRANT, etc.' },
                quantity: { type: 'integer', description: 'Quantidade movimentada (positivo = entrada, negativo = saída).' },
                description: { type: 'string', nullable: true, description: 'Descrição legível, quando disponível.' },
                createdAt: { type: 'string', description: 'Data/hora da transação (ISO 8601).' },
              },
            },
          },
        },
      },
    },
    ctrl.getCreditHistory.bind(ctrl),
  )

  fastify.get(
    '/users/me/auto-recharge',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['credits'],
        summary: 'Status da recarga automática',
        description: 'Retorna o estado atual da recarga automática (ativa/inativa + combo), para badges de status e pré-preenchimento da tela de configuração.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              active: { type: 'boolean' },
              comboId: { type: 'string', nullable: true },
              comboName: { type: 'string', nullable: true },
              comboQuantity: { type: 'integer', nullable: true },
              price: { type: 'number', nullable: true },
            },
          },
        },
      },
    },
    ctrl.getAutoRecharge.bind(ctrl),
  )

  fastify.put(
    '/users/me/auto-recharge',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['credits'],
        summary: 'Configurar recarga automática',
        description: 'Liga/desliga e configura a recarga automática (campo active + comboId). A recarga é cobrada sem CVV no cartão padrão, no corte da agenda, quando o saldo não cobre a entrega.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['active'],
          properties: {
            active: { type: 'boolean', description: 'Liga/desliga a recarga automática.' },
            comboId: { type: 'string', description: 'Combo a recarregar. Obrigatório ao ativar.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Configuração salva.',
            properties: {
              ok: { type: 'boolean' },
            },
          },
        },
      },
    },
    ctrl.updateAutoRecharge.bind(ctrl),
  )
  // (Removido) PUT /users/me/card-token — endpoint legado do MVP MP (token de cartão).
  // A recarga automática agora usa o cartão padrão salvo (Stripe), sem token armazenado.
}
