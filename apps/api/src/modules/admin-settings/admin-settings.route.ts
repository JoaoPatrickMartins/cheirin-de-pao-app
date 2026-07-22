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
      tags: ['settings'],
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

  // Pedido mínimo — objeto de mínimos por dia da agenda (aplica-se por turno) + pedido único.
  const agendaMinSchema = {
    type: 'object',
    description: 'Mínimo por dia da semana (0 = sem mínimo). Aplica-se por turno quando a qtd do dia > 0.',
    properties: {
      seg: { type: 'integer' },
      ter: { type: 'integer' },
      qua: { type: 'integer' },
      qui: { type: 'integer' },
      sex: { type: 'integer' },
      sab: { type: 'integer' },
      dom: { type: 'integer' },
    },
  }

  fastify.get(
    '/admin/settings/pedido-minimo',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Consultar pedidos mínimos (admin)',
        description:
          'Retorna o pedido mínimo do pedido único e o mínimo por dia da semana da agenda (aplica-se por turno). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'Configuração de pedido mínimo.',
            properties: {
              unico: { type: 'integer', description: 'Quantidade mínima de pães por pedido único.' },
              agenda: agendaMinSchema,
            },
          },
        },
      },
    },
    ctrl.getPedidoMinimo.bind(ctrl),
  )

  fastify.patch(
    '/admin/settings/pedido-minimo',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Atualizar pedidos mínimos (admin)',
        description:
          'Atualiza o pedido mínimo do pedido único (1..20) e o mínimo por dia da agenda (0..12 por dia). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['unico', 'agenda'],
          properties: {
            unico: { type: 'integer', minimum: 1, maximum: 20, description: 'Novo mínimo do pedido único.' },
            agenda: {
              type: 'object',
              required: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'],
              properties: {
                seg: { type: 'integer', minimum: 0, maximum: 12 },
                ter: { type: 'integer', minimum: 0, maximum: 12 },
                qua: { type: 'integer', minimum: 0, maximum: 12 },
                qui: { type: 'integer', minimum: 0, maximum: 12 },
                sex: { type: 'integer', minimum: 0, maximum: 12 },
                sab: { type: 'integer', minimum: 0, maximum: 12 },
                dom: { type: 'integer', minimum: 0, maximum: 12 },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Configuração de pedido mínimo atualizada.',
            properties: {
              ok: { type: 'boolean' },
              unico: { type: 'integer' },
              agenda: agendaMinSchema,
            },
          },
        },
      },
    },
    ctrl.setPedidoMinimo.bind(ctrl),
  )

  fastify.get(
    '/admin/settings/gancho',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Consultar config do gancho de porta (admin)',
        description:
          'Retorna o mínimo de pães num pedido único para ganhar o gancho grátis e o preço de um gancho adicional (reposição por defeito/perda, cobrado via Pix). A compra de combo sempre dá direito ao gancho grátis. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'Configuração do gancho de porta.',
            properties: {
              pedidoUnicoMin: { type: 'integer', description: 'Mínimo de pães no pedido único para o gancho grátis.' },
              preco: { type: 'number', description: 'Preço de um gancho adicional em reais.' },
            },
          },
        },
      },
    },
    ctrl.getGancho.bind(ctrl),
  )

  fastify.patch(
    '/admin/settings/gancho',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Atualizar config do gancho de porta (admin)',
        description:
          'Atualiza o mínimo de pães do pedido único (1..50) para o gancho grátis e o preço do gancho adicional. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['pedidoUnicoMin', 'preco'],
          properties: {
            pedidoUnicoMin: { type: 'integer', minimum: 1, maximum: 50, description: 'Novo mínimo de pães do pedido único.' },
            preco: { type: 'number', minimum: 0, description: 'Novo preço do gancho adicional em reais.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Configuração do gancho atualizada.',
            properties: {
              ok: { type: 'boolean' },
              pedidoUnicoMin: { type: 'integer' },
              preco: { type: 'number' },
            },
          },
        },
      },
    },
    ctrl.setGancho.bind(ctrl),
  )

  // Restrições por dia da semana — dias bloqueados + limite de pedidos (global).
  const weekdayBoolSchema = {
    type: 'object',
    properties: {
      seg: { type: 'boolean' }, ter: { type: 'boolean' }, qua: { type: 'boolean' },
      qui: { type: 'boolean' }, sex: { type: 'boolean' }, sab: { type: 'boolean' },
      dom: { type: 'boolean' },
    },
  }
  const weekdayLimitSchema = {
    type: 'object',
    description: 'Máximo de pedidos por dia da semana (0 = ilimitado).',
    properties: {
      seg: { type: 'integer' }, ter: { type: 'integer' }, qua: { type: 'integer' },
      qui: { type: 'integer' }, sex: { type: 'integer' }, sab: { type: 'integer' },
      dom: { type: 'integer' },
    },
  }

  fastify.get(
    '/admin/settings/restricoes-dias',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Consultar restrições por dia da semana (admin)',
        description:
          'Retorna os dias da semana bloqueados para agendamento e o limite máximo de pedidos por dia (0 = ilimitado). Aplica-se globalmente a pedidos únicos e à agenda semanal. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'Restrições por dia da semana.',
            properties: {
              diasBloqueados: weekdayBoolSchema,
              limitePedidosDia: weekdayLimitSchema,
            },
          },
        },
      },
    },
    ctrl.getRestricoes.bind(ctrl),
  )

  fastify.patch(
    '/admin/settings/restricoes-dias',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Atualizar restrições por dia da semana (admin)',
        description:
          'Bloqueia/desbloqueia dias da semana e define o limite máximo de pedidos por dia (0 = ilimitado). Ao bloquear um dia, clientes cuja agenda entrega nesse dia são avisados para reconfigurar. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['diasBloqueados', 'limitePedidosDia'],
          properties: {
            diasBloqueados: {
              type: 'object',
              required: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'],
              properties: {
                seg: { type: 'boolean' }, ter: { type: 'boolean' }, qua: { type: 'boolean' },
                qui: { type: 'boolean' }, sex: { type: 'boolean' }, sab: { type: 'boolean' },
                dom: { type: 'boolean' },
              },
            },
            limitePedidosDia: {
              type: 'object',
              required: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'],
              properties: {
                seg: { type: 'integer', minimum: 0 }, ter: { type: 'integer', minimum: 0 },
                qua: { type: 'integer', minimum: 0 }, qui: { type: 'integer', minimum: 0 },
                sex: { type: 'integer', minimum: 0 }, sab: { type: 'integer', minimum: 0 },
                dom: { type: 'integer', minimum: 0 },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Restrições atualizadas.',
            properties: {
              ok: { type: 'boolean' },
              diasBloqueados: weekdayBoolSchema,
              limitePedidosDia: weekdayLimitSchema,
            },
          },
        },
      },
    },
    ctrl.setRestricoes.bind(ctrl),
  )
}
