import { FastifyPluginAsync } from 'fastify'
import { AdminSettingsController } from './admin-settings.controller.js'

/**
 * adminSettingsRoute — rotas de configurações globais do admin.
 *
 * T-07-02-05: preHandler: [fastify.authenticate] garante JWT válido nas rotas admin.
 * T-07-02-01: Role check ADMIN fica inline no controller (per D-11).
 *
 * Rota pública (sem autenticação):
 *   GET /settings/cutoff-status — status de corte para clientes (07-06)
 */
export const adminSettingsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminSettingsController(fastify)

  // Autenticada — o status é POR SLOT do condomínio do cliente (cada slot tem seu cutoffTime).
  fastify.get('/settings/cutoff-status', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['admin — settings'],
      summary: 'Status de corte por slot do condomínio do cliente',
      description: 'Retorna, para o condomínio do cliente autenticado, cada slot de entrega ativo com seu horário, horário de corte e se o corte do ciclo atual já passou (isPast). Usado pelo banner da Home.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          description: 'Status de corte por slot.',
          properties: {
            slots: {
              type: 'array',
              description: 'Slots de entrega ativos do condomínio do cliente.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Nome do slot (manha | tarde).' },
                  time: { type: 'string', description: 'Horário de entrega (HH:MM).' },
                  cutoffTime: { type: 'string', description: 'Horário de corte do slot (HH:MM).' },
                  isPast: { type: 'boolean', description: 'true se o corte do ciclo atual já passou.' },
                },
              },
            },
          },
        },
      },
    },
  }, ctrl.cutoffStatus.bind(ctrl))

  fastify.get(
    '/admin/settings/cutoff',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Consultar horário de corte de pedidos (admin)',
        description: 'Retorna o horário de corte de pedidos configurado. Após este horário, novos pedidos avulsos para o dia corrente são bloqueados. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'Configuração do horário de corte.',
            properties: {
              cutoffTime: { type: 'string', description: 'Horário de corte no formato HH:MM.' },
            },
          },
        },
      },
    },
    ctrl.getCutoff.bind(ctrl),
  )

  fastify.patch(
    '/admin/settings/cutoff',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Atualizar horário de corte de pedidos (admin)',
        description: 'Atualiza o horário de corte de pedidos do sistema. Afeta imediatamente: pedidos avulsos feitos após o novo cutoffTime para o dia corrente serão rejeitados. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['cutoffTime'],
          properties: {
            cutoffTime: { type: 'string', pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$', description: 'Novo horário de corte no formato HH:MM (ex: "09:00"). Após este horário, pedidos do dia corrente são bloqueados.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Horário de corte atualizado.',
            properties: {
              cutoffTime: { type: 'string', description: 'Novo horário de corte salvo.' },
            },
          },
        },
      },
    },
    ctrl.setCutoff.bind(ctrl),
  )

  fastify.get(
    '/admin/settings/avulso',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Consultar configurações de pedido avulso (admin)',
        description: 'Retorna o limite máximo de pãezinhos por pedido avulso e o preço unitário avulso. O preço avulso é sempre maior que o preço por unidade de qualquer combo para incentivar a compra em combos. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'Configuração de pedido avulso.',
            properties: {
              limit: { type: 'integer', description: 'Quantidade máxima de pãezinhos por pedido avulso.' },
              unitPrice: { type: 'number', description: 'Preço unitário do pão avulso em reais.' },
            },
          },
        },
      },
    },
    ctrl.getAvulso.bind(ctrl),
  )

  fastify.patch(
    '/admin/settings/avulso',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Atualizar configurações de pedido avulso (admin)',
        description: 'Atualiza o limite máximo e/ou o preço unitário do pedido avulso. Alterações refletem imediatamente para novos pedidos. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, description: 'Novo limite máximo de pãezinhos por pedido avulso.' },
            unitPrice: { type: 'number', minimum: 0.01, description: 'Novo preço unitário em reais para pedidos avulsos.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Configuração de avulso atualizada.',
            properties: {
              limit: { type: 'integer', description: 'Limite salvo.' },
              unitPrice: { type: 'number', description: 'Preço unitário salvo.' },
            },
          },
        },
      },
    },
    ctrl.setAvulso.bind(ctrl),
  )
}
