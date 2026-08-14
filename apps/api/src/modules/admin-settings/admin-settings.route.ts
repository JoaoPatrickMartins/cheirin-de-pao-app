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

  // Slots de entrega: PADRÃO global (fonte da verdade do corte) + personalização por condomínio.
  // O `cutoffTime` é SEMPRE global; `time` e `isActive` podem ser personalizados por condomínio.
  const slotItemSchema = {
    type: 'object',
    properties: {
      slotId: { type: 'string', description: 'Identificador estável do slot (read-only).' },
      name: { type: 'string', description: 'Nome interno do slot (read-only).' },
      label: { type: 'string', description: 'Rótulo de exibição (editável apenas no padrão global).' },
      emoji: { type: 'string', description: 'Emoji de exibição (editável apenas no padrão global).' },
      time: { type: 'string', description: 'Horário de entrega HH:MM. Personalizável por condomínio.' },
      cutoffTime: { type: 'string', description: 'Horário de corte HH:MM. SEMPRE global.' },
      isActive: { type: 'boolean', description: 'Slot ativo. Personalizável por condomínio.' },
      timeCustom: { type: 'boolean', description: 'Presente na consulta por condomínio: true = horário definido localmente; false = herdado do padrão.' },
      activeCustom: { type: 'boolean', description: 'Presente na consulta por condomínio: true = ativação definida localmente; false = herdada do padrão.' },
    },
  }

  const condoIdQuerySchema = {
    type: 'object',
    properties: {
      condominiumId: {
        type: 'string',
        pattern: '^[0-9a-fA-F]{24}$',
        description: 'Escopo da consulta. Ausente = padrão global; presente = aquele condomínio.',
      },
    },
  }

  fastify.get(
    '/admin/settings/slots',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Consultar slots de entrega — padrão global ou de um condomínio (admin)',
        description: 'Sem condominiumId, retorna o PADRÃO global de slots (fonte da verdade do horário de corte). Com condominiumId, retorna os slots EFETIVOS daquele condomínio, com timeCustom/activeCustom indicando o que foi personalizado e o que é herdado do padrão. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: condoIdQuerySchema,
        response: {
          200: {
            type: 'object',
            description: 'Slots do escopo consultado.',
            properties: {
              slots: { type: 'array', items: slotItemSchema },
              condominiumId: { type: ['string', 'null'], description: 'Escopo consultado (null = padrão global).' },
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
        summary: 'Atualizar slots de entrega — padrão global ou de um condomínio (admin)',
        description:
          'Sem condominiumId, edita o PADRÃO global (time, cutoffTime, label, emoji, isActive) e propaga para os condomínios — preservando o que cada um personalizou. Com condominiumId, personaliza apenas time/isActive daquele condomínio; null volta a herdar o padrão. O horário de corte é global e não pode ser definido por condomínio. Responde 422 quando o horário informado inverteria a regra de qual dia recebe a entrega naquele corte. A identidade (name/slotId) nunca é editável. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['slots'],
          properties: {
            condominiumId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Ausente = edita o padrão global; presente = personaliza aquele condomínio.',
            },
            slots: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['slotId'],
                properties: {
                  slotId: { type: 'string', description: 'Identificador do slot a editar.' },
                  time: { type: ['string', 'null'], pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$', description: 'Novo horário de entrega HH:MM. null (só por condomínio) = voltar a herdar o padrão.' },
                  cutoffTime: { type: 'string', pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$', description: 'Novo horário de corte HH:MM. Apenas no padrão global.' },
                  label: { type: 'string', description: 'Novo rótulo de exibição. Apenas no padrão global.' },
                  emoji: { type: 'string', description: 'Novo emoji de exibição. Apenas no padrão global.' },
                  isActive: { type: ['boolean', 'null'], description: 'Ativar/desativar o slot. null (só por condomínio) = voltar a herdar o padrão.' },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Slots atualizados no escopo informado.',
            properties: {
              ok: { type: 'boolean' },
              slots: { type: 'array', items: slotItemSchema },
              condominiumId: { type: ['string', 'null'], description: 'Escopo editado (null = padrão global).' },
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

  // De onde veio cada seção das restrições resolvidas — a UI usa para o badge "herdado".
  const rulesSourceSchema = {
    type: 'object',
    description: "Origem de cada seção: 'condo' = personalizado naquele condomínio; 'global' = herdado do padrão.",
    properties: {
      blocked: { type: 'string', enum: ['global', 'condo'] },
      limits: { type: 'string', enum: ['global', 'condo'] },
    },
  }

  fastify.get(
    '/admin/settings/restricoes-dias',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Consultar restrições por dia da semana — padrão ou por condomínio (admin)',
        description:
          'Retorna os dias da semana bloqueados e o limite máximo de pedidos por dia (0 = ilimitado). Sem condominiumId devolve o PADRÃO global; com condominiumId devolve o valor EFETIVO daquele condomínio (override quando existe, senão o padrão) mais `source`, que diz por seção de onde o valor veio. Quando resolvido para um condomínio, o limite conta apenas as entregas daquele condomínio. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: condoIdQuerySchema,
        response: {
          200: {
            type: 'object',
            description: 'Restrições por dia da semana no escopo consultado.',
            properties: {
              diasBloqueados: weekdayBoolSchema,
              limitePedidosDia: weekdayLimitSchema,
              source: rulesSourceSchema,
              condominiumId: { type: ['string', 'null'] },
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
        summary: 'Atualizar restrições por dia da semana — padrão ou por condomínio (admin)',
        description:
          'Bloqueia/desbloqueia dias da semana e define o limite máximo de pedidos por dia (0 = ilimitado). Sem condominiumId grava o PADRÃO global (os dois mapas são obrigatórios). Com condominiumId grava o override daquele condomínio, e null em um mapa significa voltar a herdar o padrão. Ao bloquear um dia, clientes cuja agenda entrega nesse dia são avisados para reconfigurar (no escopo editado). Não cancela pedidos já materializados — para isso use o bloqueio de data com cancelExisting. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['diasBloqueados', 'limitePedidosDia'],
          properties: {
            condominiumId: {
              type: 'string',
              pattern: '^[0-9a-fA-F]{24}$',
              description: 'Ausente = grava o padrão global; presente = grava o override daquele condomínio.',
            },
            diasBloqueados: {
              type: ['object', 'null'],
              description: 'null (só com condominiumId) = voltar a herdar o padrão global.',
              required: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'],
              properties: {
                seg: { type: 'boolean' }, ter: { type: 'boolean' }, qua: { type: 'boolean' },
                qui: { type: 'boolean' }, sex: { type: 'boolean' }, sab: { type: 'boolean' },
                dom: { type: 'boolean' },
              },
            },
            limitePedidosDia: {
              type: ['object', 'null'],
              description: 'null (só com condominiumId) = voltar a herdar o padrão global.',
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
            description: 'Restrições atualizadas (valores efetivos após a edição).',
            properties: {
              ok: { type: 'boolean' },
              diasBloqueados: weekdayBoolSchema,
              limitePedidosDia: weekdayLimitSchema,
              source: rulesSourceSchema,
              condominiumId: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
    ctrl.setRestricoes.bind(ctrl),
  )

  // ---------------------------------------------------------------- bloqueios de data/período
  const blockItemSchema = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      condominiumId: { type: ['string', 'null'], description: 'null = bloqueio GLOBAL (todos os condomínios).' },
      condominiumName: { type: ['string', 'null'], description: 'Nome do condomínio (null nos bloqueios globais).' },
      startDate: { type: 'string', description: 'Primeiro dia bloqueado (AAAA-MM-DD, dia BRT).' },
      endDate: { type: 'string', description: 'Último dia bloqueado, inclusive (AAAA-MM-DD, dia BRT).' },
      reason: { type: ['string', 'null'], description: 'Motivo exibido ao cliente (ex.: "Feriado").' },
      isPast: { type: 'boolean', description: 'true quando o período já terminou.' },
    },
  }

  fastify.get(
    '/admin/settings/bloqueios-data',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Listar bloqueios de data/período (admin)',
        description:
          'Lista os bloqueios de data única ou período. Sem condominiumId traz todos (globais e de cada condomínio); com condominiumId traz os daquele condomínio mais os globais, que também valem lá. Por padrão esconde períodos já encerrados — use includePast=true para o histórico. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            condominiumId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
            includePast: { type: 'string', enum: ['true', 'false'], description: 'true para incluir períodos encerrados.' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { blocks: { type: 'array', items: blockItemSchema } },
          },
        },
      },
    },
    ctrl.listBloqueiosData.bind(ctrl),
  )

  fastify.get(
    '/admin/settings/bloqueios-data/impacto',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Prévia de impacto de um bloqueio de data (admin)',
        description:
          'Dry-run: informa o que já existe nas datas informadas (pedidos, Cestinhas, clientes, agendas afetadas e quantos pãezins seriam estornados). Não altera nada — serve para o admin decidir entre apenas impedir novos pedidos ou cancelar o que existe com estorno. Considera apenas de hoje em diante. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['startDate', 'endDate'],
          properties: {
            condominiumId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$', description: 'Ausente = impacto de um bloqueio GLOBAL.' },
            startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Impacto do bloqueio.',
            properties: {
              days: { type: 'integer', description: 'Dias do período ainda por vir.' },
              orders: { type: 'integer', description: 'Pedidos de pão que seriam cancelados.' },
              breads: { type: 'integer', description: 'Total de pães envolvidos (pedidos + Cestinhas).' },
              cestinhas: { type: 'integer', description: 'Cestinhas que seriam canceladas.' },
              cestinhaItems: { type: 'integer', description: 'Itens de mercadinho nas Cestinhas envolvidas.' },
              clients: { type: 'integer', description: 'Clientes distintos com pedido/Cestinha no período.' },
              schedules: { type: 'integer', description: 'Clientes com agenda ativa que entrega em algum dia do período.' },
              refundableCredits: { type: 'number', description: 'Pãezins que voltariam aos clientes (decimal).' },
            },
          },
        },
      },
    },
    ctrl.impactoBloqueioData.bind(ctrl),
  )

  fastify.post(
    '/admin/settings/bloqueios-data',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Criar bloqueio de data ou período (admin)',
        description:
          'Bloqueia uma data única (startDate igual a endDate) ou um período contínuo, para todos os condomínios (sem condominiumId) ou só para um. Vale para pedido único, agenda (o corte não gera) e Cestinha, em todos os turnos. Com cancelExisting=true, cancela os pedidos e Cestinhas do período estornando os pãezins e devolvendo o estoque; sem ele, apenas impede novos pedidos. Clientes afetados são avisados. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['startDate', 'endDate'],
          properties: {
            condominiumId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$', description: 'Ausente = bloqueio GLOBAL.' },
            startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Igual a startDate para uma data única.' },
            reason: { type: 'string', maxLength: 60, description: 'Motivo exibido ao cliente (ex.: "Feriado").' },
            cancelExisting: { type: 'boolean', description: 'true = cancela pedidos/Cestinhas do período com estorno.' },
          },
        },
        response: {
          201: {
            type: 'object',
            description: 'Bloqueio criado.',
            properties: {
              ok: { type: 'boolean' },
              block: blockItemSchema,
              cancelled: {
                type: 'object',
                properties: {
                  orders: { type: 'integer' },
                  cestinhas: { type: 'integer' },
                  refundedCredits: { type: 'number' },
                },
              },
              notified: { type: 'integer', description: 'Clientes avisados.' },
            },
          },
        },
      },
    },
    ctrl.createBloqueioData.bind(ctrl),
  )

  fastify.delete(
    '/admin/settings/bloqueios-data/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — settings'],
        summary: 'Remover bloqueio de data ou período (admin)',
        description:
          'Remove o bloqueio, liberando novamente as datas. NÃO ressuscita pedidos que tenham sido cancelados: o estorno já devolveu os pãezins ao cliente, que pede de novo se quiser. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } },
        },
        response: {
          200: { type: 'object', properties: { ok: { type: 'boolean' } } },
        },
      },
    },
    ctrl.deleteBloqueioData.bind(ctrl),
  )
}
