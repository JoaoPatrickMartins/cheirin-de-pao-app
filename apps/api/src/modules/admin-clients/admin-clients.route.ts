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
        description: 'Retorna todos os clientes cadastrados. Filtrável por condomínio. Inclui status de bloqueio e saldo de créditos. Clientes bloqueados não podem fazer pedidos ou login. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            condominiumId: { type: 'string', description: 'Filtrar clientes por condomínio (MongoDB ObjectId). Omitir para listar todos.' },
          },
        },
        response: {
          200: {
            type: 'array',
            description: 'Lista de clientes.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID do cliente (MongoDB ObjectId).' },
                name: { type: 'string', description: 'Nome completo do cliente.' },
                cpf: { type: 'string', description: 'CPF do cliente.' },
                phone: { type: 'string', description: 'Telefone.' },
                email: { type: 'string', description: 'E-mail.' },
                credits: { type: 'integer', description: 'Saldo atual de créditos (pãezinhos disponíveis).' },
                isBlocked: { type: 'boolean', description: 'true se o cliente está bloqueado.' },
                condominiumName: { type: 'string', description: 'Nome do condomínio do cliente.' },
                apartment: { type: 'string', description: 'Apartamento do cliente.' },
                block: { type: 'string', description: 'Bloco do cliente (se aplicável).' },
              },
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
              cpf: { type: 'string', description: 'CPF.' },
              phone: { type: 'string', description: 'Telefone.' },
              email: { type: 'string', description: 'E-mail.' },
              credits: { type: 'integer', description: 'Saldo atual de créditos.' },
              isBlocked: { type: 'boolean', description: 'Status de bloqueio.' },
              schedule: {
                type: 'object',
                description: 'Agenda semanal ativa do cliente (null se não configurada).',
                properties: {
                  weeklyQty: { type: 'object', description: 'Pãezinhos por dia da semana.' },
                  deliveryTime: { type: 'string', description: 'Horário de entrega configurado.' },
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
            },
          },
        },
      },
    },
    ctrl.getDetail.bind(ctrl),
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
}
