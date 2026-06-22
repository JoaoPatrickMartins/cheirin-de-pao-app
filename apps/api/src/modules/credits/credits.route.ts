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
              isOnPromotion: { type: 'boolean', description: 'true se o combo está em promoção ativa.' },
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

  fastify.put(
    '/users/me/auto-recharge',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['credits'],
        summary: 'Configurar recarga automática',
        description: 'Configura a recarga automática de créditos do cliente. Mode "acabar" dispara recarga quando o saldo chega a zero. Mode "semanal" dispara toda semana no weekday configurado. Requer que o cliente tenha um card-token salvo para cobranças automáticas.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['mode', 'comboId'],
          properties: {
            mode: { type: 'string', enum: ['acabar', 'semanal'], description: '"acabar": recarga automática quando créditos acabam. "semanal": recarga em dia fixo da semana.' },
            weekday: { type: 'integer', minimum: 0, maximum: 6, description: 'Dia da semana para recarga (0=domingo, 6=sábado). Obrigatório quando mode="semanal".' },
            comboId: { type: 'string', description: 'ID do combo a comprar automaticamente na recarga.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Configuração de recarga automática salva.',
            properties: {
              autoRecharge: {
                type: 'object',
                description: 'Configuração atual de recarga automática.',
                properties: {
                  mode: { type: 'string', description: 'Modo configurado: "acabar" ou "semanal".' },
                  weekday: { type: 'integer', description: 'Dia da semana (quando mode=semanal).' },
                  comboId: { type: 'string', description: 'ID do combo configurado.' },
                },
              },
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
