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
              total: { type: 'number', description: 'Receita total do período em reais.' },
              byType: {
                type: 'object',
                description: 'Receita por tipo de compra.',
                properties: {
                  combos: { type: 'number', description: 'Receita via combos no período.' },
                  avulso: { type: 'number', description: 'Receita via compra avulsa/personalizada no período.' },
                },
              },
              market: {
                type: 'object',
                description:
                  'Cestinha (Além do Pãozin) — D-2: receita NOVA e valor movimentado são números diferentes. GMV nunca é somado à receita, porque a parte paga em pãezinhos já foi faturada na compra do combo.',
                properties: {
                  revenue: { type: 'number', description: 'Dinheiro novo da Cestinha (Payment PAID purpose=MARKET).' },
                  gmv: { type: 'number', description: 'Valor movimentado (Σ totalValue confirmado). NUNCA somar à receita.' },
                  moneyPart: { type: 'number', description: 'Recorte do GMV pago em dinheiro.' },
                  creditPart: { type: 'number', description: 'Recorte do GMV pago em pãezinhos (não é receita nova).' },
                  credits: { type: 'integer', description: 'Pãezinhos usados como pagamento no período.' },
                  orders: { type: 'integer', description: 'Cestinhas confirmadas no período.' },
                  cmv: { type: 'number', description: 'Custo esperado do que foi vendido (itens + pão da Cestinha), pela matriz de fornecimento.' },
                  margin: { type: 'number', description: 'GMV − CMV.' },
                  marginPct: { type: 'number', description: 'Margem em % do GMV.' },
                  unitsWithoutCost: { type: 'integer', description: 'Unidades vendidas sem custo cadastrado — enquanto > 0 a margem é PARCIAL.' },
                },
              },
              totalConsolidated: {
                type: 'number',
                description: 'Receita de crédito + receita da Cestinha. O GMV não entra (D-2).',
              },
              purchases: {
                type: 'object',
                description: 'Dinheiro que SAIU: pedidos ao fornecedor finalizados no período (inclui reposições RESTOCK). Usa o custo pago (snapshot no item), não o custo esperado.',
                properties: {
                  total: { type: 'number', description: 'Custo total das compras (R$).' },
                  breadCost: { type: 'number', description: 'Recorte gasto com pão.' },
                  itemsCost: { type: 'number', description: 'Recorte gasto com produtos do mercadinho.' },
                  orders: { type: 'integer', description: 'Pedidos ao fornecedor contados.' },
                },
              },
              byCondominium: {
                type: 'array',
                description: 'Receita por condomínio (união das duas fontes: um condomínio que só comprou Cestinha também aparece).',
                items: {
                  type: 'object',
                  properties: {
                    condominiumId: { type: 'string', description: 'ID do condomínio.' },
                    condominiumName: { type: 'string', description: 'Nome do condomínio.' },
                    total: { type: 'number', description: 'Receita de crédito gerada por clientes deste condomínio no período.' },
                    cestinhaGmv: { type: 'number', description: 'Valor movimentado em Cestinhas neste condomínio (não é receita).' },
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
