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
                deliveryCount: { type: 'integer', description: 'Paradas confirmadas (com algo já pago) neste condomínio. Pão + Cestinha do mesmo cliente/turno = 1 parada.' },
                totalBreads: { type: 'integer', description: 'Pães já pagos neste condomínio — inclui o pão vendido dentro da Cestinha.' },
                projectedBreads: { type: 'integer', description: 'Pães previstos pela agenda, ainda não materializados.' },
                projectedDeliveries: { type: 'integer', description: 'Paradas puramente previstas (sem nada pago). Disjunto de deliveryCount.' },
                riskCount: { type: 'integer', description: 'Clientes previstos em risco (bloqueados ou sem saldo) neste condomínio.' },
                marketItemCount: { type: 'integer', description: 'Itens do mercadinho (não-pão) do condomínio — métrica paralela aos pães.' },
                marketBreads: { type: 'integer', description: 'Recorte de totalBreads que vem da Cestinha.' },
                bySlot: {
                  type: 'array',
                  description: 'Quebra por slot/turno: pães (pagos + previstos), paradas e itens do mercadinho.',
                  items: {
                    type: 'object',
                    properties: {
                      slotId: { type: 'string' },
                      label: { type: 'string' },
                      breads: { type: 'integer' },
                      deliveries: { type: 'integer' },
                      items: { type: 'integer', description: 'Itens do mercadinho do turno.' },
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
                    totalItems: { type: 'integer', description: 'Itens do mercadinho do turno — métrica paralela aos pães.' },
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
                    totalItems: { type: 'integer', description: 'Itens do mercadinho do dia — métrica paralela aos pães.' },
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
                          breads: { type: 'integer', description: 'Pães já pagos (o que será pedido) — inclui o pão da Cestinha.' },
                          projectedBreads: { type: 'integer', description: 'Previstos pela agenda (contexto).' },
                          deliveries: { type: 'integer', description: 'Paradas do turno (pão + Cestinha do mesmo cliente = 1).' },
                          riskCount: { type: 'integer' },
                          generated: { type: 'boolean' },
                          pastCutoff: { type: 'boolean' },
                          hasOrders: { type: 'boolean', description: 'true também quando o turno tem só Cestinha (0 pães, N itens).' },
                          items: { type: 'integer', description: 'Itens do mercadinho do turno.' },
                          marketBreads: { type: 'integer', description: 'Recorte de breads que vem da Cestinha.' },
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
              totalBreads: { type: 'integer', description: 'Pães totais (pagos + previstos), incluindo o pão da Cestinha.' },
              materializedBreads: { type: 'integer', description: 'Pães já pagos (pedidos de pão + pão da Cestinha).' },
              projectedBreads: { type: 'integer', description: 'Pães previstos pela agenda, ainda não materializados.' },
              deliveryCount: { type: 'integer', description: 'Paradas confirmadas. Pão + Cestinha do mesmo cliente/turno = 1 parada.' },
              projectedDeliveries: { type: 'integer', description: 'Paradas puramente previstas (sem nada pago). Disjunto de deliveryCount.' },
              riskCount: { type: 'integer', description: 'Clientes previstos em risco (bloqueados ou sem saldo).' },
              marketItemCount: { type: 'integer', description: 'Itens do mercadinho do condomínio — métrica paralela aos pães.' },
              bySlot: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    slotId: { type: 'string' },
                    label: { type: 'string' },
                    breads: { type: 'integer' },
                    deliveries: { type: 'integer' },
                    items: { type: 'integer', description: 'Itens do mercadinho do turno.' },
                  },
                },
              },
              byType: {
                type: 'object',
                description: 'Quebra dos pães JÁ PAGOS por origem: single + scheduled + cestinha.',
                properties: {
                  single: { type: 'integer', description: 'Pães avulsos.' },
                  scheduled: { type: 'integer', description: 'Pães de agenda.' },
                  cestinha: { type: 'integer', description: 'Pães vendidos dentro da Cestinha.' },
                },
              },
              deliveries: {
                type: 'array',
                description: 'Uma linha por PARADA (userId + turno): pedido de pão, Cestinha, previsto ou a combinação.',
                items: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string' },
                    name: { type: 'string' },
                    apartment: { type: 'string' },
                    block: { type: 'string' },
                    quantity: { type: 'integer', description: 'Total de pães da parada (pago + previsto).' },
                    slotId: { type: 'string' },
                    slotLabel: { type: 'string' },
                    type: { type: 'string', description: 'SINGLE (avulso) | SCHEDULED (agenda).' },
                    source: { type: 'string', description: 'order (tem algo pago) | projected (só previsto).' },
                    risk: { type: 'string', description: "'' | 'no-credit' | 'blocked'." },
                    marketItems: {
                      type: 'array',
                      description: 'Itens do mercadinho desta parada.',
                      items: {
                        type: 'object',
                        properties: { name: { type: 'string' }, qty: { type: 'integer' } },
                      },
                    },
                    marketItemCount: { type: 'integer' },
                    breadFromMarket: { type: 'integer', description: 'Pães desta parada que vêm da Cestinha.' },
                    origin: { type: 'string', description: 'bread | market (só-Cestinha) | both (parada combinada).' },
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
        description: 'Retorna o histórico de pedidos ao fornecedor com status FINALIZED — tanto os do turno (`kind: DELIVERY_BATCH`) quanto as reposições de inventário (`kind: RESTOCK`, sem turno). Pedidos DRAFT não são listados aqui. Ordenado do mais recente. Restrito a ADMIN.',
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
                slotId: { type: 'string', nullable: true, description: 'Turno do pedido (manha/tarde). null em RESTOCK.' },
                slotLabel: { type: 'string', nullable: true, description: 'Rótulo do turno (ex.: "Manhã"). null em RESTOCK.' },
                status: { type: 'string', description: 'Status: sempre FINALIZED nesta listagem.' },
                kind: { type: 'string', nullable: true, description: 'DELIVERY_BATCH (do turno) | RESTOCK (reposição). Ausente em pedidos antigos = DELIVERY_BATCH.' },
                totalQuantity: { type: 'integer', description: 'Total de PÃES pedidos (0 em RESTOCK — o campo alimenta o relatório de desperdício).' },
                totalItems: { type: 'integer', nullable: true, description: 'Unidades de produtos não-pão.' },
                totalValue: { type: 'number', nullable: true, description: 'Custo total do pedido (R$).' },
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

  // 4b. Rateio proposto (demanda × matriz de fornecimento) — rota ESTÁTICA, antes das /:id
  fastify.get(
    '/admin/supplier-orders/split-preview',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Rateio proposto do pedido (admin)',
        description:
          'Devolve, sem criar nada, a demanda de compra do turno agrupada POR PRODUTO e, para cada produto, os fornecedores que o fornecem com a quantidade sugerida pelo rateio padrão e o custo de cada um. É a base do passo "Dividir" — o front não reimplementa o motor de rateio. `unsourced` lista os produtos com demanda e sem fornecedor cadastrado. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['slotId'],
          properties: {
            slotId: { type: 'string', description: 'Turno (manha/tarde).' },
            date: { type: 'string', description: 'Data de entrega (YYYY-MM-DD, BRT). Sem ela, Regra A.' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              products: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string' },
                    productName: { type: 'string' },
                    isBread: { type: 'boolean', description: 'true no produto-pão (demanda também vem dos pedidos de pão).' },
                    demand: { type: 'integer', description: 'Unidades a comprar deste produto.' },
                    options: {
                      type: 'array',
                      description: 'Fornecedores deste produto (matriz de fornecimento).',
                      items: {
                        type: 'object',
                        properties: {
                          supplierId: { type: 'string' },
                          supplierName: { type: 'string' },
                          unitCost: { type: 'number' },
                          defaultSharePct: { type: 'integer' },
                          isPreferred: { type: 'boolean' },
                          minOrderQty: { type: 'integer', nullable: true },
                          suggested: { type: 'integer', description: 'Quantidade sugerida pelo rateio padrão.' },
                        },
                      },
                    },
                  },
                },
              },
              unsourced: {
                type: 'array',
                description: 'Produtos com demanda e SEM fornecedor cadastrado — não podem ser pedidos.',
                items: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string' },
                    productName: { type: 'string' },
                    qty: { type: 'integer' },
                  },
                },
              },
              totalQuantity: { type: 'integer' },
              totalValue: { type: 'number' },
            },
          },
        },
      },
    },
    ctrl.getSplitPreview.bind(ctrl),
  )

  // 4c. Reposição de inventário (RESTOCK, D-9) — rotas ESTÁTICAS, antes das /:id
  fastify.get(
    '/admin/supplier-orders/restock-suggestion',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Sugestão de reposição de inventário (admin)',
        description:
          'Produtos de estoque FIXO (geleia, café) que precisam de reposição, com quanto comprar e de quem, sem criar nada. A quantidade sai da COBERTURA: ritmo de venda dos últimos 30 dias × dias que se quer cobrir − estoque atual. Produto sem venda medida na janela vem com `basis: FALLBACK` (a sugestão é um piso, não uma previsão — um item esgotado há semanas vende zero justamente porque está esgotado). `unsourced` lista quem precisa de reposição e não tem fornecedor cadastrado. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            coverDays: { type: 'integer', minimum: 1, maximum: 365, description: 'Dias de estoque a cobrir (padrão 30).' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              coverDays: { type: 'integer', description: 'Dias de cobertura usados no cálculo.' },
              products: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string' },
                    productName: { type: 'string' },
                    stock: { type: 'integer', description: 'Estoque atual.' },
                    sold: { type: 'integer', description: 'Unidades vendidas na janela de histórico.' },
                    dailyRate: { type: 'number', description: 'Média diária de venda.' },
                    coverDays: { type: 'number', nullable: true, description: 'Dias que o estoque atual cobre (null sem venda medida).' },
                    suggestedQty: { type: 'integer', description: 'Quantidade sugerida de compra.' },
                    basis: { type: 'string', description: 'CONSUMPTION (ritmo medido) | FALLBACK (sem histórico — piso).' },
                    lowStock: { type: 'boolean', description: 'Estoque na faixa crítica (mesmo limiar do aviso ao admin).' },
                    outOfStock: { type: 'boolean', description: 'Estoque zerado.' },
                    options: {
                      type: 'array',
                      description: 'Fornecedores deste produto (matriz de fornecimento) com a fatia sugerida.',
                      items: {
                        type: 'object',
                        properties: {
                          supplierId: { type: 'string' },
                          supplierName: { type: 'string' },
                          unitCost: { type: 'number' },
                          defaultSharePct: { type: 'integer' },
                          isPreferred: { type: 'boolean' },
                          minOrderQty: { type: 'integer', nullable: true },
                          suggested: { type: 'integer', description: 'Quantidade sugerida deste fornecedor.' },
                          belowMinimum: { type: 'boolean', description: 'Abaixo do pedido mínimo — aviso, não bloqueio.' },
                        },
                      },
                    },
                  },
                },
              },
              unsourced: {
                type: 'array',
                description: 'Produtos que precisam de reposição e NÃO têm fornecedor cadastrado.',
                items: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string' },
                    productName: { type: 'string' },
                    qty: { type: 'integer' },
                  },
                },
              },
              totalQuantity: { type: 'integer', description: 'Unidades sugeridas no total.' },
              totalValue: { type: 'number', description: 'Custo total sugerido (R$).' },
            },
          },
        },
      },
    },
    ctrl.getRestockSuggestion.bind(ctrl),
  )

  fastify.post(
    '/admin/supplier-orders/restock',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Comprar reposição de inventário (admin)',
        description:
          'Cria e finaliza um pedido ao fornecedor do tipo RESTOCK (D-9): produtos de estoque FIXO, SEM turno e sem data de entrega. Aceita apenas produtos `stockType: FIXED` que o fornecedor realmente fornece (o custo vem da matriz de fornecimento — D-8); pão e produtos de capacidade diária são comprados pela demanda do turno e são recusados aqui. `totalQuantity` do pedido fica 0 de propósito (esse campo é "pães" e alimenta o relatório de desperdício); as unidades vão em `totalItems`. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              minItems: 1,
              description: 'Linhas do pedido: produto FIXO, fornecedor que o fornece e quantidade.',
              items: {
                type: 'object',
                required: ['supplierId', 'productId', 'quantity'],
                properties: {
                  supplierId: { type: 'string', description: 'ID do fornecedor.' },
                  productId: { type: 'string', description: 'ID do produto (stockType FIXED).' },
                  quantity: { type: 'integer', minimum: 1, description: 'Unidades a comprar.' },
                },
              },
            },
          },
        },
        response: {
          201: {
            type: 'object',
            description: 'Pedido de reposição criado e finalizado.',
            properties: {
              id: { type: 'string', description: 'ID do PurchaseOrder criado.' },
              totalItems: { type: 'integer', description: 'Unidades compradas.' },
              totalValue: { type: 'number', description: 'Custo total (R$).' },
            },
          },
        },
      },
    },
    ctrl.createRestock.bind(ctrl),
  )

  // 5. Download PDF — produces application/pdf
  fastify.get(
    '/admin/supplier-orders/:id/pdf',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Download PDF do pedido ao fornecedor (admin)',
        description: 'Gera e retorna o PDF do pedido ao fornecedor. Com ?supplierId=, produz o documento ENVIÁVEL daquele fornecedor: cabeçalho com nome/CNPJ dele e tabela agrupada por PRODUTO, sem expor os preços dos outros. Sem o parâmetro, produz o consolidado interno. Funciona para DRAFT e FINALIZED. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do pedido ao fornecedor (MongoDB ObjectId).' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            supplierId: {
              type: 'string',
              description: 'Gera o documento SÓ deste fornecedor (enviável: mostra apenas as linhas e os custos dele, agrupados por produto). Omitido = consolidado interno com todos os fornecedores — NÃO envie a um fornecedor.',
            },
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
        description: 'Gera e retorna o Excel (.xlsx) do pedido ao fornecedor. Com ?supplierId=, produz a planilha daquele fornecedor (agrupada por produto). Sem o parâmetro, o consolidado interno. Funciona para DRAFT e FINALIZED. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do pedido ao fornecedor (MongoDB ObjectId).' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            supplierId: {
              type: 'string',
              description: 'Gera o documento SÓ deste fornecedor (enviável: mostra apenas as linhas e os custos dele, agrupados por produto). Omitido = consolidado interno com todos os fornecedores — NÃO envie a um fornecedor.',
            },
          },
        },
      },
    },
    ctrl.getExcel.bind(ctrl),
  )

  // 7. Fornecedores do pedido — um botão de download por fornecedor na tela
  fastify.get(
    '/admin/supplier-orders/:id/suppliers',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Fornecedores presentes no pedido (admin)',
        description: 'Lista os fornecedores que têm itens neste pedido, com o total de unidades e o valor de cada um. Base do download por fornecedor (?supplierId= no /pdf e /excel). Restrito a ADMIN.',
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
            properties: {
              suppliers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    supplierId: { type: 'string' },
                    supplierName: { type: 'string' },
                    quantity: { type: 'integer', description: 'Total de unidades (todos os produtos) deste fornecedor.' },
                    total: { type: 'number', description: 'Valor total em R$ deste fornecedor.' },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.getOrderSuppliers.bind(ctrl),
  )
}
