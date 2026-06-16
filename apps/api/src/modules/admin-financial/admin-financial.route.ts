import { FastifyPluginAsync } from 'fastify'
import { AdminFinancialController } from './admin-financial.controller.js'

/**
 * adminFinancialRoute — registra rotas de receita financeira pelo Admin.
 *
 * T-07-05-04: preHandler: [fastify.authenticate] garante JWT válido.
 * O role check (ADMIN only) fica no controller (per D-11).
 *
 * Rota registrada:
 *   GET /admin/financial — receita por período com breakdown por tipo e condomínio
 */
export const adminFinancialRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminFinancialController(fastify)

  fastify.get(
    '/admin/financial',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — financial'],
        summary: 'Relatório financeiro (admin)',
        description: 'Retorna relatório de receita consolidado por período com breakdown por tipo de pagamento (Pix/cartão) e por condomínio. Considera apenas pagamentos com status "approved". Útil para análise de performance por condomínio e canal de pagamento. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['day', 'week', 'month'], description: 'Período de análise: "day" (hoje), "week" (últimos 7 dias), "month" (últimos 30 dias). Padrão: "month".' },
            condominiumId: { type: 'string', description: 'Filtrar por condomínio específico (MongoDB ObjectId). Omitir para consolidado geral.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Relatório financeiro do período.',
            properties: {
              period: { type: 'string', description: 'Período consultado: "day", "week" ou "month".' },
              revenue: { type: 'number', description: 'Receita total do período em reais.' },
              breakdown: {
                type: 'object',
                description: 'Breakdown detalhado da receita.',
                properties: {
                  byType: {
                    type: 'object',
                    description: 'Receita por método de pagamento.',
                    properties: {
                      pix: { type: 'number', description: 'Receita via Pix no período.' },
                      card: { type: 'number', description: 'Receita via cartão no período.' },
                    },
                  },
                  byCondominium: {
                    type: 'array',
                    description: 'Receita por condomínio.',
                    items: {
                      type: 'object',
                      properties: {
                        condominiumId: { type: 'string', description: 'ID do condomínio.' },
                        condominiumName: { type: 'string', description: 'Nome do condomínio.' },
                        revenue: { type: 'number', description: 'Receita gerada por clientes deste condomínio no período.' },
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
    ctrl.getRevenue.bind(ctrl),
  )
}
