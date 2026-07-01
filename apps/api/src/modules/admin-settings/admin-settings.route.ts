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
                  slotId: { type: 'string', description: 'Identificador estável do slot (manha | tarde).' },
                  name: { type: 'string', description: 'Nome interno do slot (manha | tarde).' },
                  label: { type: 'string', description: 'Rótulo de exibição (ex.: "Manhã").' },
                  emoji: { type: 'string', description: 'Emoji de exibição do slot.' },
                  time: { type: 'string', description: 'Horário de entrega (HH:MM).' },
                  cutoffTime: { type: 'string', description: 'Horário de corte do slot (HH:MM).' },
                  locked: { type: 'boolean', description: 'true se o corte da próxima entrega desse slot já passou.' },
                  deliveryWhen: { type: 'string', description: 'Quando é a próxima entrega do slot: "hoje" ou "amanhã".' },
                },
              },
            },
          },
        },
      },
    },
  }, ctrl.cutoffStatus.bind(ctrl))

  // Config GLOBAL de slots de entrega — fonte da verdade dos horários de corte (um por slot).
  const slotItemSchema = {
    type: 'object',
    properties: {
      slotId: { type: 'string', description: 'Identificador estável do slot (read-only).' },
      name: { type: 'string', description: 'Nome interno do slot (read-only).' },
      label: { type: 'string', description: 'Rótulo de exibição (editável).' },
      emoji: { type: 'string', description: 'Emoji de exibição (editável).' },
      time: { type: 'string', description: 'Horário de entrega HH:MM (read-only na Etapa A).' },
      cutoffTime: { type: 'string', description: 'Horário de corte HH:MM (editável).' },
      isActive: { type: 'boolean', description: 'Slot ativo (editável).' },
    },
  }

  fastify.get(
    '/admin/settings/slots',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Consultar config global de slots de entrega (admin)',
        description: 'Retorna a configuração global dos slots de entrega, cada um com seu horário de corte (cutoffTime). É a fonte da verdade: ao editar, os horários são propagados para todos os condomínios. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'Config global de slots.',
            properties: {
              slots: { type: 'array', items: slotItemSchema },
            },
          },
        },
      },
    },
    ctrl.getSlots.bind(ctrl),
  )

  fastify.patch(
    '/admin/settings/slots',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Atualizar config global de slots de entrega (admin)',
        description: 'Edita a config global dos slots (time, cutoffTime, label, emoji, isActive) e propaga para todos os condomínios. A identidade (name/slotId) NÃO é editável. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['slots'],
          properties: {
            slots: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['slotId'],
                properties: {
                  slotId: { type: 'string', description: 'Identificador do slot a editar.' },
                  time: { type: 'string', pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$', description: 'Novo horário de entrega HH:MM.' },
                  cutoffTime: { type: 'string', pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$', description: 'Novo horário de corte HH:MM.' },
                  label: { type: 'string', description: 'Novo rótulo de exibição.' },
                  emoji: { type: 'string', description: 'Novo emoji de exibição.' },
                  isActive: { type: 'boolean', description: 'Ativar/desativar o slot.' },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Config global atualizada e propagada.',
            properties: {
              ok: { type: 'boolean' },
              slots: { type: 'array', items: slotItemSchema },
            },
          },
        },
      },
    },
    ctrl.setSlots.bind(ctrl),
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
