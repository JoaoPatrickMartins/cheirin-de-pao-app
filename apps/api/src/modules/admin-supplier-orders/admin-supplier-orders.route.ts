// admin-supplier-orders.route.ts — registro de rotas do pedido ao fornecedor
// Padrão baseado em admin-orders.route.ts
// Requirements: ADMO-05..09
// T-07-04-01: preHandler authenticate em todas as rotas
// IMPORTANTE: GET /admin/supplier-orders/draft registrado ANTES de /:id para evitar conflito

import { FastifyPluginAsync } from 'fastify'
import { AdminSupplierOrdersController } from './admin-supplier-orders.controller.js'

/**
 * adminSupplierOrdersRoute — registra rotas de pedido ao fornecedor.
 *
 * Ordem de registro (crítico para evitar conflito /:id vs /draft):
 * 1. GET  /admin/supplier-orders/draft      — rota exata primeiro
 * 2. POST /admin/supplier-orders            — criação
 * 3. GET  /admin/supplier-orders            — histórico
 * 4. PATCH /admin/supplier-orders/:id/finalize
 * 5. GET  /admin/supplier-orders/:id/pdf
 * 6. GET  /admin/supplier-orders/:id/excel
 */
export const adminSupplierOrdersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminSupplierOrdersController(fastify)

  // 1. Draft — deve vir ANTES de /:id para não ser interceptado como parâmetro
  fastify.get(
    '/admin/supplier-orders/draft',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Prévia do pedido ao fornecedor (draft)',
        description: 'Gera a prévia do pedido a ser feito ao fornecedor para UM turno (slotId), baseado nas agendas semanais ativas e pedidos avulsos do turno. Não persiste nada. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['slotId'],
          properties: {
            slotId: { type: 'string', description: 'Turno (manha/tarde).' },
            date: { type: 'string', description: 'Data de entrega YYYY-MM-DD. Sem ela, próxima entrega (Regra A).' },
          },
        },
        response: {
          200: {
            type: 'array',
            description: 'Prévia consolidada por condomínio para o turno.',
            items: {
              type: 'object',
              properties: {
                condominiumId: { type: 'string', description: 'ID do condomínio.' },
                name: { type: 'string', description: 'Nome do condomínio.' },
                deliveryCount: { type: 'integer', description: 'Entregas já materializadas (pedidos existentes) neste condomínio.' },
                totalBreads: { type: 'integer', description: 'Pães já materializados (pedidos existentes) neste condomínio.' },
                projectedBreads: { type: 'integer', description: 'Pães previstos pela agenda, ainda não materializados.' },
                projectedDeliveries: { type: 'integer', description: 'Entregas previstas pela agenda, ainda não materializadas.' },
                riskCount: { type: 'integer', description: 'Clientes previstos em risco (bloqueados ou sem saldo) neste condomínio.' },
                bySlot: {
                  type: 'array',
                  description: 'Quebra de pães por slot/turno (materializados + previstos).',
                  items: {
                    type: 'object',
                    properties: {
                      slotId: { type: 'string' },
                      label: { type: 'string' },
                      breads: { type: 'integer' },
                      deliveries: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.getDraft.bind(ctrl),
  )

  // 1a. Status de geração — informa se o pedido de amanhã já foi gerado (trava a aba Compra)
  fastify.get(
    '/admin/supplier-orders/generated-status',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Status de geração do pedido de amanhã',
        description:
          'Informa se o pedido ao fornecedor do turno (slotId) já foi gerado (FINALIZED). Usado pela aba Compra para mostrar o estado "já gerado" e evitar geração duplicada.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['slotId'],
          properties: {
            slotId: { type: 'string', description: 'Turno (manha/tarde).' },
            date: { type: 'string', description: 'Data de entrega YYYY-MM-DD. Sem ela, próxima entrega (Regra A).' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              generated: { type: 'boolean' },
              orderId: { type: 'string' },
              totalQuantity: { type: 'integer' },
              date: { type: 'string' },
              slotLabel: { type: 'string' },
            },
          },
        },
      },
    },
    ctrl.generatedStatus.bind(ctrl),
  )

  // 1c. Estado dos turnos — data de entrega, tem pedidos e compra finalizada (por turno)
  fastify.get(
    '/admin/supplier-orders/slots-status',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Estado dos turnos para a aba Compra',
        description:
          'Para cada turno ativo: data de entrega (Regra A), se há pedidos e se a compra foi finalizada. Ordenado pelo próximo corte. A aba Compra usa para abrir no turno certo e mostrar a data correta.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              slots: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    slotId: { type: 'string' },
                    label: { type: 'string' },
                    emoji: { type: 'string' },
                    time: { type: 'string' },
                    cutoffTime: { type: 'string' },
                    deliveryDate: { type: 'string' },
                    hasOrders: { type: 'boolean' },
                    generated: { type: 'boolean' },
                    totalBreads: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.slotsStatus.bind(ctrl),
  )

  // 1d. Próximos dias de entrega — alimenta a pré-tela "Dias em aberto"
  fastify.get(
    '/admin/supplier-orders/upcoming-days',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Próximos dias de entrega para a aba Compra',
        description:
          'Lista os próximos N dias (default 7, BRT) com seus turnos: total de pães (confirmados + previstos), entregas, clientes em risco, se a compra já foi gerada e se o corte já passou. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'string', description: 'Quantos dias retornar (1–31, default 7).' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              days: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string', description: 'Dia de entrega (YYYY-MM-DD, BRT).' },
                    totalBreads: { type: 'integer' },
                    hasOrders: { type: 'boolean' },
                    allGenerated: { type: 'boolean' },
                    anyPending: { type: 'boolean' },
                    slots: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          slotId: { type: 'string' },
                          label: { type: 'string' },
                          emoji: { type: 'string' },
                          time: { type: 'string' },
                          cutoffTime: { type: 'string' },
                          cutoffAt: { type: 'string', description: 'Instante do corte (ISO).' },
                          deliveryDate: { type: 'string' },
                          breads: { type: 'integer', description: 'Confirmados (o que será pedido).' },
                          projectedBreads: { type: 'integer', description: 'Previstos pela agenda (contexto).' },
                          deliveries: { type: 'integer' },
                          riskCount: { type: 'integer' },
                          generated: { type: 'boolean' },
                          pastCutoff: { type: 'boolean' },
                          hasOrders: { type: 'boolean' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.upcomingDays.bind(ctrl),
  )

  // 1e. Split padrão (percentual do fornecedor principal) — usado pelo "Gerar direto"/rede de segurança
  fastify.get(
    '/admin/supplier-orders/default-split',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Split padrão de compra (percentual do principal)',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: { principalPercent: { type: 'integer', description: '0–100' } },
          },
        },
      },
    },
    ctrl.getDefaultSplit.bind(ctrl),
  )

  fastify.patch(
    '/admin/supplier-orders/default-split',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Definir split padrão de compra (percentual do principal)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['principalPercent'],
          properties: { principalPercent: { type: 'integer', minimum: 0, maximum: 100 } },
        },
        response: {
          200: {
            type: 'object',
            properties: { principalPercent: { type: 'integer' } },
          },
        },
      },
    },
    ctrl.setDefaultSplit.bind(ctrl),
  )

  // 1b. Detalhe por condomínio — também ANTES de /:id (rota mais específica primeiro)
  fastify.get(
    '/admin/supplier-orders/draft/:condominiumId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Detalhe por condomínio da prévia do pedido (admin)',
        description: 'Detalhamento por cliente das entregas de um condomínio para amanhã: cliente, ap/bloco, quantidade, slot, tipo (avulso/agenda), origem (confirmado/previsto) e flag de risco. Inclui quebra por slot e por tipo. Não persiste nada. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['condominiumId'],
          properties: {
            condominiumId: { type: 'string', description: 'ID do condomínio (MongoDB ObjectId).' },
          },
        },
        querystring: {
          type: 'object',
          required: ['slotId'],
          properties: {
            slotId: { type: 'string', description: 'Turno (manha/tarde).' },
            date: { type: 'string', description: 'Data de entrega YYYY-MM-DD. Sem ela, próxima entrega (Regra A).' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Detalhe das entregas do condomínio para o turno.',
            properties: {
              condominiumId: { type: 'string' },
              name: { type: 'string' },
              totalBreads: { type: 'integer', description: 'Pães totais (materializados + previstos).' },
              materializedBreads: { type: 'integer', description: 'Pães já confirmados (pedidos existentes).' },
              projectedBreads: { type: 'integer', description: 'Pães previstos pela agenda, ainda não materializados.' },
              deliveryCount: { type: 'integer', description: 'Entregas confirmadas.' },
              projectedDeliveries: { type: 'integer', description: 'Clientes com entrega prevista.' },
              riskCount: { type: 'integer', description: 'Clientes previstos em risco (bloqueados ou sem saldo).' },
              bySlot: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    slotId: { type: 'string' },
                    label: { type: 'string' },
                    breads: { type: 'integer' },
                    deliveries: { type: 'integer' },
                  },
                },
              },
              byType: {
                type: 'object',
                properties: {
                  single: { type: 'integer', description: 'Pães avulsos.' },
                  scheduled: { type: 'integer', description: 'Pães de agenda.' },
                },
              },
              deliveries: {
                type: 'array',
                description: 'Uma linha por entrega (materializada ou prevista).',
                items: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string' },
                    name: { type: 'string' },
                    apartment: { type: 'string' },
                    block: { type: 'string' },
                    quantity: { type: 'integer' },
                    slotId: { type: 'string' },
                    slotLabel: { type: 'string' },
                    type: { type: 'string', description: 'SINGLE (avulso) | SCHEDULED (agenda).' },
                    source: { type: 'string', description: 'order (confirmado) | projected (previsto).' },
                    risk: { type: 'string', description: "'' | 'no-credit' | 'blocked'." },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.getCondominiumDetail.bind(ctrl),
  )

  // 2. Criar pedido
  fastify.post(
    '/admin/supplier-orders',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Criar pedido ao fornecedor (admin)',
        description: 'Cria um pedido definitivo ao fornecedor com status DRAFT. Um pedido deve ser criado por dia para amanhã. O cutoffTime pode ser sobrescrito para este pedido específico. Items define a quantidade a pedir de cada fornecedor (normalmente apenas o fornecedor principal). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['items', 'slotId'],
          properties: {
            items: {
              type: 'array',
              description: 'Lista de itens do pedido, um por fornecedor.',
              items: {
                type: 'object',
                required: ['supplierId', 'quantity'],
                properties: {
                  supplierId: { type: 'string', description: 'ID do fornecedor (MongoDB ObjectId).' },
                  quantity: { type: 'integer', minimum: 1, description: 'Quantidade de pãezinhos a pedir.' },
                },
              },
            },
            cutoffTime: { type: 'string', description: 'Horário de corte específico para este pedido (HH:MM). Opcional.' },
            slotId: { type: 'string', description: 'Turno (manha/tarde) — o pedido é por turno.' },
            date: { type: 'string', description: 'Data de entrega YYYY-MM-DD. Sem ela, próxima entrega (Regra A).' },
          },
        },
        response: {
          201: {
            type: 'object',
            description: 'Pedido ao fornecedor criado com status DRAFT.',
            properties: {
              id: { type: 'string', description: 'ID do pedido ao fornecedor criado.' },
            },
          },
        },
      },
    },
    ctrl.create.bind(ctrl),
  )

  // 2b. Gerar direto — cria o pedido do turno com quantidade esperada + split padrão
  fastify.post(
    '/admin/supplier-orders/quick',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Gerar direto (1 toque) o pedido ao fornecedor',
        description:
          'Cria e finaliza o pedido do turno usando a quantidade esperada (confirmados + previstos) e o split padrão (principal leva tudo, ou 75/25 com reserva). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['slotId'],
          properties: {
            slotId: { type: 'string', description: 'Turno (manha/tarde).' },
            date: { type: 'string', description: 'Data de entrega YYYY-MM-DD. Sem ela, próxima entrega (Regra A).' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: { id: { type: 'string', description: 'ID do pedido criado.' } },
          },
        },
      },
    },
    ctrl.createQuick.bind(ctrl),
  )

  // 3. Histórico de pedidos FINALIZED
  fastify.get(
    '/admin/supplier-orders',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Histórico de pedidos ao fornecedor (admin)',
        description: 'Retorna o histórico de pedidos ao fornecedor com status FINALIZED. Pedidos DRAFT não são listados aqui. Ordenado do mais recente. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            description: 'Lista de pedidos finalizados.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID do pedido.' },
                date: { type: 'string', description: 'Data de referência do pedido (ISO 8601).' },
                slotId: { type: 'string', description: 'Turno do pedido (manha/tarde).' },
                slotLabel: { type: 'string', description: 'Rótulo do turno (ex.: "Manhã").' },
                status: { type: 'string', description: 'Status: sempre FINALIZED nesta listagem.' },
                totalQuantity: { type: 'integer', description: 'Total de pãezinhos pedidos.' },
                cutoffTime: { type: 'string', description: 'Horário de corte do pedido (ISO 8601).' },
                createdAt: { type: 'string', description: 'Data/hora de criação.' },
                updatedAt: { type: 'string', description: 'Data/hora da última atualização.' },
              },
            },
          },
        },
      },
    },
    ctrl.getHistory.bind(ctrl),
  )

  // 4. Finalizar pedido
  fastify.patch(
    '/admin/supplier-orders/:id/finalize',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Finalizar pedido ao fornecedor (admin)',
        description: 'Transiciona o pedido do status DRAFT para FINALIZED. Pedidos finalizados não podem ser alterados. A finalização confirma o pedido junto ao fornecedor. Apenas pedidos em status DRAFT podem ser finalizados. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do pedido ao fornecedor (MongoDB ObjectId).' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Pedido finalizado com sucesso.',
            properties: {
              ok: { type: 'boolean', description: 'Indica sucesso da finalização.' },
            },
          },
        },
      },
    },
    ctrl.finalize.bind(ctrl),
  )

  // 5. Download PDF — produces application/pdf
  fastify.get(
    '/admin/supplier-orders/:id/pdf',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Download PDF do pedido ao fornecedor (admin)',
        description: 'Gera e retorna o PDF do pedido ao fornecedor para envio/impressão. Produz arquivo application/pdf. O PDF contém detalhamento completo do pedido: fornecedor, itens, quantidades e data. Funciona para pedidos DRAFT e FINALIZED. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do pedido ao fornecedor (MongoDB ObjectId).' },
          },
        },
      },
    },
    ctrl.getPdf.bind(ctrl),
  )

  // 6. Download Excel — produces application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  fastify.get(
    '/admin/supplier-orders/:id/excel',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Download Excel do pedido ao fornecedor (admin)',
        description: 'Gera e retorna o Excel (.xlsx) do pedido ao fornecedor. Produz arquivo application/vnd.openxmlformats-officedocument.spreadsheetml.sheet. Útil para análises e controle em planilha. Funciona para pedidos DRAFT e FINALIZED. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do pedido ao fornecedor (MongoDB ObjectId).' },
          },
        },
      },
    },
    ctrl.getExcel.bind(ctrl),
  )
}
