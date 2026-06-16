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

  // Rota pública — sem preHandler (nenhum token necessário)
  // Registrada ANTES das rotas autenticadas para evitar conflito de preHandler
  fastify.get('/settings/cutoff-status', {
    schema: {
      tags: ['admin — settings'],
      summary: 'Verificar status de corte de pedidos',
      description: 'Retorna se o horário de corte de pedidos já passou (isCutoff=true) e qual é o cutoffTime configurado. Rota pública — usada no frontend do cliente para mostrar se ainda é possível fazer pedidos avulsos para hoje. Após o cutoff, novos pedidos só são aceitos para o próximo dia útil.',
      response: {
        200: {
          type: 'object',
          description: 'Status atual do corte de pedidos.',
          properties: {
            isCutoff: { type: 'boolean', description: 'true se o horário de corte já passou e não é mais possível fazer pedidos para hoje.' },
            cutoffTime: { type: 'string', description: 'Horário de corte configurado no formato HH:MM (ex: "09:00").' },
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
