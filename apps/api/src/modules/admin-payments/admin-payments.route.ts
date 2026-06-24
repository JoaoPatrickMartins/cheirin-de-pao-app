import { FastifyPluginAsync } from 'fastify'
import { AdminPaymentsController } from './admin-payments.controller.js'

/**
 * adminPaymentsRoute — registra rotas de gestão de pagamentos pelo Admin.
 *
 * T-07-05-01: preHandler: [fastify.authenticate] garante JWT válido.
 * O role check (ADMIN only) fica no controller (per D-11).
 *
 * Rotas registradas:
 *   GET  /admin/payments          — lista de pagamentos com status (PAY-03)
 *   GET  /admin/payments/:id      — detalhe de um pagamento + User
 *   POST /admin/payments/:id/refund — estorno via MP + debito de créditos (PAY-04)
 */
export const adminPaymentsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminPaymentsController(fastify)

  fastify.get(
    '/admin/payments',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — payments'],
        summary: 'Listar pagamentos (admin)',
        description: 'Retorna todos os pagamentos do sistema com status, método e valor. Inclui pagamentos de todos os clientes. Ordenado do mais recente. Útil para monitoramento financeiro e suporte. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            description: 'Lista de pagamentos.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID do pagamento (MongoDB ObjectId).' },
                userId: { type: 'string', description: 'ID do cliente que efetuou o pagamento.' },
                userName: { type: 'string', description: 'Nome do cliente que efetuou o pagamento.' },
                amount: { type: 'number', description: 'Valor do pagamento em reais.' },
                method: { type: 'string', description: 'Método: "PIX" ou "CREDIT_CARD".' },
                status: { type: 'string', description: 'Status: "PENDING", "PAID", "FAILED", "REFUNDED".' },
                comboId: { type: 'string', nullable: true, description: 'ID do combo comprado (null em compra avulsa).' },
                customQuantity: { type: 'integer', nullable: true, description: 'Quantidade avulsa (null em compra de combo).' },
                createdAt: { type: 'string', description: 'Data/hora do pagamento (ISO 8601).' },
              },
            },
          },
        },
      },
    },
    ctrl.list.bind(ctrl),
  )

  fastify.get(
    '/admin/payments/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — payments'],
        summary: 'Detalhar pagamento (admin)',
        description: 'Retorna dados completos de um pagamento específico incluindo dados do cliente, combo comprado e histórico de status. Útil para suporte e auditoria de estornos. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do pagamento (MongoDB ObjectId).' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Dados completos do pagamento.',
            properties: {
              id: { type: 'string', description: 'ID do pagamento.' },
              userId: { type: 'string', description: 'ID do cliente que pagou.' },
              userName: { type: 'string', description: 'Nome do cliente que pagou.' },
              amount: { type: 'number', description: 'Valor em reais.' },
              method: { type: 'string', description: 'Método de pagamento ("PIX" ou "CREDIT_CARD").' },
              status: { type: 'string', description: 'Status atual ("PENDING", "PAID", "FAILED", "REFUNDED").' },
              mercadoPagoId: { type: 'string', nullable: true, description: 'ID no Mercado Pago (legado).' },
              stripePaymentIntentId: { type: 'string', nullable: true, description: 'ID do PaymentIntent no Stripe.' },
              comboId: { type: 'string', nullable: true, description: 'ID do combo comprado (null em avulso).' },
              customQuantity: { type: 'integer', nullable: true, description: 'Quantidade avulsa (null em combo).' },
              createdAt: { type: 'string', description: 'Data/hora de criação.' },
            },
          },
        },
      },
    },
    ctrl.getById.bind(ctrl),
  )

  fastify.post(
    '/admin/payments/:id/refund',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — payments'],
        summary: 'Estornar pagamento (admin)',
        description: 'Realiza o estorno de um pagamento via Stripe e debita os créditos correspondentes do cliente. Apenas pagamentos com status "approved" podem ser estornados. Após o estorno: status muda para "refunded", créditos são debitados do cliente (se suficientes) e o MP processa o reembolso. Operação irreversível. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do pagamento a estornar (MongoDB ObjectId).' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Estorno realizado com sucesso.',
            properties: {
              ok: { type: 'boolean', description: 'Indica sucesso da operação.' },
              refunded: { type: 'boolean', description: 'Confirma que o estorno foi processado.' },
              paymentId: { type: 'string', description: 'ID do pagamento estornado.' },
              creditsDebited: { type: 'integer', description: 'Créditos removidos do cliente.' },
            },
          },
        },
      },
    },
    ctrl.refund.bind(ctrl),
  )
}
