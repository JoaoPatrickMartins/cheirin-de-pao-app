import { FastifyPluginAsync } from 'fastify'
import { AdminClientsController } from './admin-clients.controller.js'

/**
 * adminClientsRoute — registra rotas de gestão de clientes pelo Admin.
 *
 * T-07-03-01: preHandler: [fastify.authenticate] garante JWT válido.
 * T-07-03-04: Role check e verificação de role=CLIENT ficam no controller/service.
 * T-07-03-05: getDetail expõe dados somente leitura — Schedule + Orders — apenas a ADMIN.
 *
 * Rotas registradas:
 *   GET   /admin/clients          — lista clientes (query: ?condominiumId)
 *   GET   /admin/clients/:id      — detalhe com Schedule ativo + Orders 30 dias
 *   PATCH /admin/clients/:id/block — toggle isBlocked do cliente
 */
export const adminClientsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminClientsController(fastify)

  fastify.get(
    '/admin/clients',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — clients'],
        summary: 'Listar clientes (admin)',
        description: 'Retorna clientes cadastrados com busca, filtro de status, ordenação e paginação. Inclui status de bloqueio e saldo de créditos. Clientes bloqueados não podem fazer pedidos ou login. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            condominiumId: { type: 'string', description: 'Filtrar clientes por condomínio (MongoDB ObjectId). Omitir para listar todos.' },
            q: { type: 'string', description: 'Busca por nome, e-mail, CPF ou telefone.' },
            status: { type: 'string', enum: ['all', 'blocked', 'active', 'no-credits'], description: 'Filtro de status. Padrão: all.' },
            sort: { type: 'string', enum: ['name', 'credits', 'lastPurchase', 'recent'], description: 'Ordenação. Padrão: name.' },
            page: { type: 'integer', minimum: 1, description: 'Página (1-based). Padrão: 1.' },
            limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Itens por página. Padrão: 20.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Página de clientes com total para paginação.',
            properties: {
              items: {
                type: 'array',
                description: 'Clientes da página atual.',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'ID do cliente (MongoDB ObjectId).' },
                    name: { type: 'string', description: 'Nome completo do cliente.' },
                    condominiumId: { type: 'string', nullable: true, description: 'ID do condomínio do cliente.' },
                    apartment: { type: 'string', nullable: true, description: 'Apartamento do cliente.' },
                    block: { type: 'string', nullable: true, description: 'Bloco do cliente (se aplicável).' },
                    creditBalance: { type: 'integer', description: 'Saldo atual de créditos (pãezinhos disponíveis).' },
                    isBlocked: { type: 'boolean', description: 'true se o cliente está bloqueado.' },
                    createdAt: { type: 'string', description: 'Data de cadastro (ISO 8601).' },
                    lastPurchaseAt: { type: 'string', nullable: true, description: 'Data da última compra (ISO 8601), ou null.' },
                  },
                },
              },
              total: { type: 'integer', description: 'Total de clientes que casam com o filtro (antes da paginação).' },
              page: { type: 'integer', description: 'Página atual.' },
              limit: { type: 'integer', description: 'Itens por página.' },
            },
          },
        },
      },
    },
    ctrl.list.bind(ctrl),
  )

  fastify.get(
    '/admin/clients/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — clients'],
        summary: 'Detalhar cliente (admin)',
        description: 'Retorna dados completos de um cliente específico incluindo a agenda semanal ativa e os últimos 30 dias de pedidos. Dados somente leitura — para suporte e auditoria. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do cliente (MongoDB ObjectId).' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Dados completos do cliente.',
            properties: {
              id: { type: 'string', description: 'ID do cliente.' },
              name: { type: 'string', description: 'Nome completo.' },
              phone: { type: 'string', nullable: true, description: 'Telefone (apenas dígitos).' },
              email: { type: 'string', nullable: true, description: 'E-mail.' },
              cpf: { type: 'string', nullable: true, description: 'CPF (11 dígitos).' },
              birthDate: { type: 'string', nullable: true, description: 'Data de nascimento (ISO 8601), ou null.' },
              condominiumId: { type: 'string', nullable: true, description: 'ID do condomínio.' },
              condominiumName: { type: 'string', nullable: true, description: 'Nome do condomínio.' },
              apartment: { type: 'string', nullable: true, description: 'Apartamento.' },
              block: { type: 'string', nullable: true, description: 'Bloco (se aplicável).' },
              creditBalance: { type: 'integer', description: 'Saldo atual de créditos.' },
              isBlocked: { type: 'boolean', description: 'Status de bloqueio.' },
              createdAt: { type: 'string', description: 'Data de cadastro / membro desde (ISO 8601).' },
              schedule: {
                type: 'object',
                nullable: true,
                description: 'Agenda semanal ativa do cliente (null se não configurada).',
                properties: {
                  weeklyQty: {
                    type: 'object',
                    additionalProperties: { type: 'integer' },
                    nullable: true,
                    description: 'Pãezinhos por dia da semana (chave = dia, valor = quantidade).',
                  },
                  days: {
                    type: 'object',
                    additionalProperties: true,
                    nullable: true,
                    description: 'Agenda multi-slot: { slotId: { dia: quantidade } }.',
                  },
                  deliveryTime: { type: 'string', nullable: true, description: 'Horário de entrega configurado.' },
                  isActive: { type: 'boolean', description: 'Se a agenda está ativa.' },
                },
              },
              recentOrders: {
                type: 'array',
                description: 'Últimos 30 dias de pedidos do cliente.',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'ID do pedido.' },
                    scheduledDate: { type: 'string', description: 'Data do pedido.' },
                    quantity: { type: 'integer', description: 'Quantidade.' },
                    status: { type: 'string', description: 'Status do pedido.' },
                  },
                },
              },
              metrics: {
                type: 'object',
                description: 'Métricas agregadas do cliente para auditoria.',
                properties: {
                  totalSpent: { type: 'number', description: 'Total gasto (R$) em pagamentos PAID.' },
                  paymentsCount: { type: 'integer', description: 'Número de pagamentos confirmados.' },
                  breadsDelivered: { type: 'integer', description: 'Total de pães entregues (pedidos DELIVERED).' },
                  deliveredOrders: { type: 'integer', description: 'Número de pedidos entregues.' },
                  ordersCount: { type: 'integer', description: 'Número total de pedidos.' },
                  weeklyBreads: { type: 'integer', description: 'Pães por semana agendados na agenda ativa.' },
                },
              },
            },
          },
        },
      },
    },
    ctrl.getDetail.bind(ctrl),
  )

  fastify.patch(
    '/admin/clients/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — clients'],
        summary: 'Editar cadastro do cliente (admin)',
        description: 'Atualiza dados cadastrais do cliente (nome, contato, CPF, nascimento, condomínio/apto/bloco). Telefone e CPF são normalizados. Conflitos de unicidade (telefone/e-mail/CPF) retornam 409. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do cliente (MongoDB ObjectId).' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2, description: 'Nome completo.' },
            phone: { type: 'string', description: 'Telefone (com ou sem máscara — será normalizado).' },
            email: { type: 'string', description: 'E-mail.' },
            cpf: { type: 'string', description: 'CPF (com ou sem máscara — será normalizado e validado).' },
            birthDate: { type: 'string', description: 'Data de nascimento (ISO 8601) ou string vazia para limpar.' },
            condominiumId: { type: 'string', description: 'ID do condomínio.' },
            apartment: { type: 'string', description: 'Apartamento.' },
            block: { type: 'string', description: 'Bloco (se aplicável).' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Cadastro atualizado.',
            properties: {
              id: { type: 'string', description: 'ID do cliente.' },
              name: { type: 'string', description: 'Nome completo.' },
              phone: { type: 'string', nullable: true, description: 'Telefone (apenas dígitos).' },
              email: { type: 'string', nullable: true, description: 'E-mail.' },
              cpf: { type: 'string', nullable: true, description: 'CPF.' },
              birthDate: { type: 'string', nullable: true, description: 'Data de nascimento (ISO 8601).' },
              condominiumId: { type: 'string', nullable: true, description: 'ID do condomínio.' },
              apartment: { type: 'string', nullable: true, description: 'Apartamento.' },
              block: { type: 'string', nullable: true, description: 'Bloco.' },
            },
          },
        },
      },
    },
    ctrl.updateClient.bind(ctrl),
  )

  fastify.patch(
    '/admin/clients/:id/block',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — clients'],
        summary: 'Bloquear/desbloquear cliente (admin)',
        description: 'Alterna o status de bloqueio do cliente (toggle). Clientes bloqueados: não conseguem autenticar (OTP rejeitado), pedidos existentes não são cancelados automaticamente. Use para suspender contas com problemas de pagamento ou comportamento inadequado. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do cliente (MongoDB ObjectId).' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Status de bloqueio alternado.',
            properties: {
              id: { type: 'string', description: 'ID do cliente.' },
              isBlocked: { type: 'boolean', description: 'Novo status de bloqueio após o toggle.' },
            },
          },
        },
      },
    },
    ctrl.blockToggle.bind(ctrl),
  )

  fastify.post(
    '/admin/clients/:id/grant-credits',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — clients'],
        summary: 'Conceder créditos manualmente (admin)',
        description: 'Concede créditos a um cliente de forma manual com auditoria (adminId + reason). Operação atômica: CreditTransaction ADMIN_GRANT + User.creditBalance increment. Dispara push OneSignal (best-effort) e persiste notificação in-app CREDIT_GRANTED. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do cliente (MongoDB ObjectId).' },
          },
        },
        body: {
          type: 'object',
          required: ['quantity', 'reason'],
          properties: {
            quantity: { type: 'integer', minimum: 1, description: 'Quantidade de créditos a conceder (mínimo 1).' },
            reason: {
              type: 'string',
              enum: ['Acerto', 'Bonificação', 'Compensação', 'Promoção'],
              description: 'Motivo da concessão para fins de auditoria.',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Dados atualizados do cliente após concessão.',
            properties: {
              creditBalance: { type: 'integer', description: 'Novo saldo de créditos do cliente.' },
            },
          },
        },
      },
    },
    ctrl.grantCredits.bind(ctrl),
  )

  fastify.get(
    '/admin/clients/:id/credit-history',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — clients'],
        summary: 'Extrato de créditos do cliente (admin)',
        description: 'Retorna o histórico de transações de crédito do cliente (compras, entregas, estornos, expirações e concessões manuais), com o admin responsável quando aplicável. Ordenado do mais recente. Para auditoria. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'ID do cliente (MongoDB ObjectId).' } },
        },
        querystring: {
          type: 'object',
          properties: { limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Máximo de transações (padrão 50).' } },
        },
        response: {
          200: {
            type: 'array',
            description: 'Transações de crédito (mais recentes primeiro).',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID da transação.' },
                type: { type: 'string', description: 'PURCHASE | DELIVERY | REFUND | EXPIRY | ADMIN_GRANT.' },
                quantity: { type: 'integer', description: 'Variação de créditos (positiva = entrada, negativa = saída).' },
                description: { type: 'string', nullable: true, description: 'Descrição legível.' },
                reason: { type: 'string', nullable: true, description: 'Motivo (em ADMIN_GRANT).' },
                referenceId: { type: 'string', nullable: true, description: 'ID de referência (Order/Payment).' },
                adminName: { type: 'string', nullable: true, description: 'Nome do admin responsável (se aplicável).' },
                createdAt: { type: 'string', description: 'Data/hora (ISO 8601).' },
              },
            },
          },
        },
      },
    },
    ctrl.creditHistory.bind(ctrl),
  )

  fastify.get(
    '/admin/clients/:id/payments',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — clients'],
        summary: 'Pagamentos do cliente (admin)',
        description: 'Retorna os pagamentos do cliente com status, método, valor e item comprado. `refundable=true` indica pagamentos estornáveis via POST /admin/payments/:id/refund. Ordenado do mais recente. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'ID do cliente (MongoDB ObjectId).' } },
        },
        response: {
          200: {
            type: 'array',
            description: 'Pagamentos do cliente (mais recentes primeiro).',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID do pagamento.' },
                amount: { type: 'number', description: 'Valor (R$).' },
                method: { type: 'string', description: 'PIX | CREDIT_CARD | DEBIT_CARD.' },
                status: { type: 'string', description: 'PENDING | PAID | FAILED | REFUNDED.' },
                label: { type: 'string', description: 'Combo comprado ou "Compra avulsa".' },
                quantity: { type: 'integer', description: 'Pães comprados.' },
                refundable: { type: 'boolean', description: 'true se pode ser estornado.' },
                createdAt: { type: 'string', description: 'Data/hora (ISO 8601).' },
              },
            },
          },
        },
      },
    },
    ctrl.payments.bind(ctrl),
  )

  fastify.get(
    '/admin/clients/:id/payment-methods',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — clients'],
        summary: 'Métodos de pagamento do cliente (admin)',
        description: 'Retorna cartões salvos (read-only) e a configuração de auto-recarga do cliente. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'ID do cliente (MongoDB ObjectId).' } },
        },
        response: {
          200: {
            type: 'object',
            description: 'Cartões salvos e auto-recarga.',
            properties: {
              cards: {
                type: 'array',
                description: 'Cartões salvos do cliente.',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'ID do cartão.' },
                    brand: { type: 'string', description: 'Bandeira.' },
                    lastFour: { type: 'string', description: 'Últimos 4 dígitos.' },
                    expiresAt: { type: 'string', description: 'Validade.' },
                    isDefault: { type: 'boolean', description: 'Se é o cartão padrão.' },
                  },
                },
              },
              autoRecharge: {
                type: 'object',
                nullable: true,
                description: 'Configuração de recarga automática (null se não configurada).',
                properties: {
                  active: { type: 'boolean', description: 'Se está ativa.' },
                  mode: { type: 'string', nullable: true, description: 'acabar | semanal.' },
                  weekday: { type: 'string', nullable: true, description: 'Dia da semana (modo semanal).' },
                  comboName: { type: 'string', nullable: true, description: 'Combo da recarga.' },
                },
              },
            },
          },
        },
      },
    },
    ctrl.paymentMethods.bind(ctrl),
  )

  fastify.get(
    '/admin/clients/:id/orders',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — clients'],
        summary: 'Pedidos do cliente com dados de entrega (admin)',
        description: 'Retorna os pedidos do cliente (incluindo CANCELLED) com entregador, horário/slot e dados de entrega (deliveredAt, confirmedAt, status). Ordenado do mais recente. Para auditoria de entregas e cancelamentos. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'ID do cliente (MongoDB ObjectId).' } },
        },
        querystring: {
          type: 'object',
          properties: { limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Máximo de pedidos (padrão 50).' } },
        },
        response: {
          200: {
            type: 'array',
            description: 'Pedidos do cliente (mais recentes primeiro).',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID do pedido.' },
                type: { type: 'string', description: 'SINGLE | SCHEDULED.' },
                quantity: { type: 'integer', description: 'Pães do pedido.' },
                status: { type: 'string', description: 'SCHEDULED | OUT_FOR_DELIVERY | DELIVERED | CANCELLED.' },
                scheduledDate: { type: 'string', description: 'Data programada (ISO 8601).' },
                slotId: { type: 'string', nullable: true, description: 'Slot (manha | tarde).' },
                deliveryTime: { type: 'string', nullable: true, description: 'Horário de entrega.' },
                courierName: { type: 'string', nullable: true, description: 'Entregador designado.' },
                deliveredAt: { type: 'string', nullable: true, description: 'Quando foi entregue (ISO 8601).' },
                confirmedAt: { type: 'string', nullable: true, description: 'Quando a entrega foi confirmada (ISO 8601).' },
                deliveryStatus: { type: 'string', nullable: true, description: 'PENDING | CONFIRMED (registro de entrega).' },
              },
            },
          },
        },
      },
    },
    ctrl.orders.bind(ctrl),
  )

  fastify.post(
    '/admin/clients/:id/orders/:orderId/cancel',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — clients'],
        summary: 'Cancelar pedido do cliente (admin)',
        description: 'Cancela um pedido SCHEDULED. O crédito é debitado na criação do pedido; refundCredits=true devolve os créditos ao cliente (reversão atômica + CreditTransaction REFUND auditável). Pedidos OUT_FOR_DELIVERY/DELIVERED não podem ser cancelados (422). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'orderId'],
          properties: {
            id: { type: 'string', description: 'ID do cliente.' },
            orderId: { type: 'string', description: 'ID do pedido.' },
          },
        },
        body: {
          type: 'object',
          properties: {
            refundCredits: { type: 'boolean', description: 'Se true, devolve os créditos ao cliente. Padrão: false.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Pedido cancelado.',
            properties: {
              id: { type: 'string', description: 'ID do pedido.' },
              status: { type: 'string', description: 'Novo status (CANCELLED).' },
              refundedCredits: { type: 'integer', description: 'Créditos devolvidos (0 se não devolveu).' },
              creditBalance: { type: 'integer', description: 'Saldo atual do cliente após a operação.' },
            },
          },
        },
      },
    },
    ctrl.cancelOrder.bind(ctrl),
  )

  fastify.patch(
    '/admin/clients/:id/schedule',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — clients'],
        summary: 'Pausar/retomar agenda do cliente (admin)',
        description: 'Ativa ou pausa a agenda semanal (isActive). Pausar interrompe a geração de pedidos futuros (a projeção só considera agendas ativas) — NÃO cancela pedidos já criados. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'ID do cliente.' } },
        },
        body: {
          type: 'object',
          required: ['isActive'],
          properties: { isActive: { type: 'boolean', description: 'true = ativa; false = pausa.' } },
        },
        response: {
          200: {
            type: 'object',
            description: 'Agenda atualizada.',
            properties: {
              id: { type: 'string', description: 'ID da agenda.' },
              isActive: { type: 'boolean', description: 'Novo estado da agenda.' },
            },
          },
        },
      },
    },
    ctrl.setScheduleActive.bind(ctrl),
  )
}
