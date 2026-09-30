import { FastifyPluginAsync } from 'fastify'
import { AdminDaySalesController } from './admin-day-sales.controller.js'

/**
 * adminDaySalesRoute — relatório de itens vendidos de um dia de entrega.
 *
 *   GET /admin/day-sales        — JSON (alimenta o sheet na aba Pedidos)
 *   GET /admin/day-sales/pdf    — PDF para arquivar/imprimir
 *   GET /admin/day-sales/excel  — XLSX para trabalhar em cima dos números
 *
 * Auth: preHandler fastify.authenticate; role check ADMIN no controller.
 * Sem `response` schema de propósito — o fast-json-stringify descarta campos de objetos
 * aninhados quando o schema sai de sincronia, e este payload é todo aninhado (mesma razão
 * documentada em `admin-reports.route.ts`).
 */
export const adminDaySalesRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminDaySalesController(fastify)

  const dateQuerystring = {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'Dia de entrega (YYYY-MM-DD, BRT). Sem ele, hoje.',
      },
    },
  }

  fastify.get(
    '/admin/day-sales',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — day-sales'],
        summary: 'Itens vendidos de um dia de entrega (admin)',
        description:
          'Tudo que foi vendido PARA um dia de entrega, agregado no geral (não por condomínio): pães (pedido de pão + pão da Cestinha, decompostos por origem), produtos da Cestinha com quantidade e receita, quebra por turno e contadores de paradas/clientes/condomínios. ' +
          'Conta só o que foi pago: previstos da agenda e Cestinha PENDING_PAYMENT ficam de fora. Vendido ≠ entregue — NOT_DELIVERED continua contado. ' +
          'Os pães são valorizados ao preço do avulso (Setting avulsoUnit); os produtos, pelo snapshot de preço do pedido. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: dateQuerystring,
      },
    },
    ctrl.getReport.bind(ctrl),
  )

  fastify.get(
    '/admin/day-sales/pdf',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — day-sales'],
        summary: 'PDF do relatório de itens vendidos do dia (admin)',
        description: 'Mesmo conteúdo de GET /admin/day-sales em PDF. Documento interno. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: dateQuerystring,
      },
    },
    ctrl.getPdf.bind(ctrl),
  )

  fastify.get(
    '/admin/day-sales/excel',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — day-sales'],
        summary: 'XLSX do relatório de itens vendidos do dia (admin)',
        description:
          'Mesmo conteúdo de GET /admin/day-sales em planilha, com abas "Itens vendidos" e "Por turno". Valores como número com formato de moeda. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: dateQuerystring,
      },
    },
    ctrl.getExcel.bind(ctrl),
  )
}
