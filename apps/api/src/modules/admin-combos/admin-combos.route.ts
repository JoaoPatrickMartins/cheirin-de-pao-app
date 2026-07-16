import { FastifyPluginAsync } from 'fastify'
import { AdminCombosController } from './admin-combos.controller.js'

/**
 * adminCombosRoute — rotas CRUD de combos + toggle de promoções para o admin.
 *
 * T-07-02-05: preHandler: [fastify.authenticate] garante JWT válido em todas as rotas.
 * T-07-02-01: Role check ADMIN fica inline no controller (per D-11).
 */
export const adminCombosRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminCombosController(fastify)

  fastify.get(
    '/admin/combos',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — combos'],
        summary: 'Listar combos (admin)',
        description: 'Retorna todos os combos cadastrados, incluindo inativos e em promoção. Dados completos incluindo preço, quantidade e status. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            description: 'Lista de todos os combos.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID do combo (MongoDB ObjectId).' },
                name: { type: 'string', description: 'Nome do combo.' },
                quantity: { type: 'integer', description: 'Quantidade de pãezinhos incluídos.' },
                price: { type: 'number', description: 'Preço em reais.' },
                tag: { type: 'string', nullable: true, description: 'Tag promocional (ex: "Mais Popular").' },
                description: { type: 'string', nullable: true, description: 'Subtítulo curto do card (ex.: "O equilíbrio da casa").' },
                showEconomy: { type: 'boolean', description: 'Se a tag de economia está ligada para este combo.' },
                economyPercent: { type: 'integer', nullable: true, description: 'Economia % vs. avulso, calculada (null quando não há economia positiva ou a tag está desligada).' },
                economySavings: { type: 'number', nullable: true, description: 'Economia em R$ vs. avulso, calculada.' },
                isActive: { type: 'boolean', description: 'Se o combo está disponível para compra.' },
                createdAt: { type: 'string', description: 'Data de criação.' },
                discount: {
                  type: 'object',
                  nullable: true,
                  description: 'Promoção ativa do combo (null se não houver).',
                  properties: {
                    type: { type: 'string', description: 'Tipo de desconto ("PERCENT" ou "FIXED").' },
                    value: { type: 'number', description: 'Valor do desconto.' },
                    expiresAt: { type: 'string', nullable: true, description: 'Fim da promoção (ISO 8601).' },
                    active: { type: 'boolean', description: 'Se a promoção está ativa.' },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.list.bind(ctrl),
  )

  fastify.get(
    '/admin/combos/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — combos'],
        summary: 'Obter combo por ID (admin)',
        description: 'Retorna os dados completos de um combo específico para preencher o formulário de edição. Retorna 404 se o combo não existir. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do combo (MongoDB ObjectId).' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Combo encontrado.',
            properties: {
              id: { type: 'string', description: 'ID do combo (MongoDB ObjectId).' },
              name: { type: 'string', description: 'Nome do combo.' },
              quantity: { type: 'integer', description: 'Quantidade de pãezinhos incluídos.' },
              price: { type: 'number', description: 'Preço em reais.' },
              tag: { type: 'string', nullable: true, description: 'Tag de destaque (ex: "Mais Popular").' },
              description: { type: 'string', nullable: true, description: 'Subtítulo curto do card (ex.: "O equilíbrio da casa").' },
              showEconomy: { type: 'boolean', nullable: true, description: 'Se a tag de economia está ligada.' },
              isActive: { type: 'boolean', description: 'Se o combo está disponível para compra.' },
              createdAt: { type: 'string', description: 'Data de criação.' },
            },
          },
        },
      },
    },
    ctrl.getById.bind(ctrl),
  )

  fastify.post(
    '/admin/combos',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — combos'],
        summary: 'Criar combo (admin)',
        description: 'Cria um novo combo de pãezinhos. O preço por unidade do combo deve ser menor que o preço avulso configurado para incentivar a compra em combos. A tag é opcional e aparece como destaque no card do combo no frontend.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'quantity', 'price'],
          properties: {
            name: { type: 'string', description: 'Nome do combo (ex: "Combo 10 Pãezinhos").' },
            quantity: { type: 'integer', minimum: 1, description: 'Quantidade de pãezinhos incluídos no combo.' },
            price: { type: 'number', minimum: 0.01, description: 'Preço total do combo em reais.' },
            tag: { type: 'string', description: 'Tag de destaque opcional (ex: "Mais Popular", "Melhor Custo-Benefício").' },
            description: { type: 'string', maxLength: 60, description: 'Subtítulo curto exibido no card (ex.: "O equilíbrio da casa").' },
            showEconomy: { type: 'boolean', description: 'Liga/desliga a tag de economia (calculada vs. o preço avulso). Padrão: ligada.' },
          },
        },
        response: {
          201: {
            type: 'object',
            description: 'Combo criado com sucesso.',
            properties: {
              id: { type: 'string', description: 'ID do combo criado.' },
              name: { type: 'string', description: 'Nome do combo.' },
              quantity: { type: 'integer', description: 'Quantidade de pãezinhos.' },
              price: { type: 'number', description: 'Preço do combo.' },
              tag: { type: 'string', nullable: true, description: 'Tag de destaque.' },
              description: { type: 'string', nullable: true, description: 'Subtítulo curto do card.' },
              showEconomy: { type: 'boolean', nullable: true, description: 'Se a tag de economia está ligada.' },
              isActive: { type: 'boolean', description: 'Se o combo está disponível para compra.' },
              createdAt: { type: 'string', description: 'Data de criação.' },
            },
          },
        },
      },
    },
    ctrl.create.bind(ctrl),
  )

  fastify.patch(
    '/admin/combos/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — combos'],
        summary: 'Atualizar combo (admin)',
        description: 'Atualiza campos parciais de um combo existente. Apenas os campos enviados são modificados. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do combo a atualizar (MongoDB ObjectId).' },
          },
        },
        body: {
          type: 'object',
          description: 'Campos parciais a atualizar no combo.',
          properties: {
            name: { type: 'string', description: 'Novo nome do combo.' },
            quantity: { type: 'integer', minimum: 1, description: 'Nova quantidade de pãezinhos.' },
            price: { type: 'number', minimum: 0.01, description: 'Novo preço em reais.' },
            tag: { type: 'string', description: 'Nova tag de destaque.' },
            description: { type: 'string', maxLength: 60, description: 'Novo subtítulo curto do card.' },
            showEconomy: { type: 'boolean', description: 'Liga/desliga a tag de economia.' },
            isActive: { type: 'boolean', description: 'Ativar ou desativar o combo.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Combo atualizado.',
            properties: {
              id: { type: 'string', description: 'ID do combo.' },
              name: { type: 'string', description: 'Nome atualizado.' },
              quantity: { type: 'integer', description: 'Quantidade de pãezinhos.' },
              price: { type: 'number', description: 'Preço em reais.' },
              tag: { type: 'string', nullable: true, description: 'Tag de destaque.' },
              description: { type: 'string', nullable: true, description: 'Subtítulo curto do card.' },
              showEconomy: { type: 'boolean', nullable: true, description: 'Se a tag de economia está ligada.' },
              isActive: { type: 'boolean', description: 'Se o combo está disponível para compra.' },
              createdAt: { type: 'string', description: 'Data de criação.' },
              affectedAutoRecharge: { type: 'integer', description: 'Clientes cuja compra automática foi desligada por este update (ao desativar o combo).' },
            },
          },
        },
      },
    },
    ctrl.update.bind(ctrl),
  )

  fastify.delete(
    '/admin/combos/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — combos'],
        summary: 'Remover combo (admin)',
        description: 'Remove um combo do sistema. Combos com pagamentos históricos associados não podem ser removidos — use isActive=false para desativar. Retorna 409 se o combo tiver histórico de pagamentos. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do combo a remover (MongoDB ObjectId).' },
          },
        },
        response: {
          204: {
            type: 'null',
            description: 'Combo removido com sucesso (sem corpo na resposta).',
          },
        },
      },
    },
    ctrl.remove.bind(ctrl),
  )

  fastify.patch(
    '/admin/combos/:id/promotion',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — combos'],
        summary: 'Ativar/desativar promoção de combo (admin)',
        description: 'Ativa ou desativa a tag de promoção de um combo. Quando active=true, o combo aparece com destaque especial na listagem de combos do cliente. Use para promover combos sazonalmente. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do combo (MongoDB ObjectId).' },
          },
        },
        body: {
          type: 'object',
          required: ['active'],
          properties: {
            active: { type: 'boolean', description: 'true para ativar promoção, false para desativar.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Status de promoção atualizado.',
            properties: {
              ok: { type: 'boolean', description: 'Indica sucesso da operação.' },
              active: { type: 'boolean', description: 'Novo status de promoção (true = ativa).' },
            },
          },
        },
      },
    },
    ctrl.togglePromotion.bind(ctrl),
  )
}
