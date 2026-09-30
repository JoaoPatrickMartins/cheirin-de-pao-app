import { FastifyPluginAsync } from 'fastify'
import { AdminExpensesController } from './admin-expenses.controller.js'
import { periodQuerystring } from '../../lib/period-query.js'

/**
 * adminExpensesRoute — despesas, categorias e recorrências (Fase 1 do plano-financeiro-vendas).
 *
 *   GET    /admin/expense-categories        — categorias (16 semeadas no boot)
 *   POST   /admin/expense-categories
 *   PATCH  /admin/expense-categories/:id
 *   DELETE /admin/expense-categories/:id    — desativa quando já tem lançamento
 *
 *   GET    /admin/expenses?month=YYYY-MM    — lista (materializa as recorrências do mês)
 *   POST   /admin/expenses
 *   PATCH  /admin/expenses/:id
 *   POST   /admin/expenses/:id/pay          — atalho do contas a pagar
 *   DELETE /admin/expenses/:id              — cancela quando é parcela de recorrência
 *   GET    /admin/expenses/payable          — contas a pagar (despesas + compras não pagas)
 *   POST   /admin/expenses/purchases/:id/pay — paga uma compra ao fornecedor (B5)
 *   POST   /admin/expenses/import           — importação em massa (histórico)
 *
 *   GET    /admin/expense-recurrences
 *   POST   /admin/expense-recurrences
 *   PATCH  /admin/expense-recurrences/:id
 *   DELETE /admin/expense-recurrences/:id   — desativa quando já gerou parcela
 *
 * Auth: preHandler `fastify.authenticate`; role check ADMIN no controller.
 *
 * Sem `response` schema: o payload das listas é aninhado (categoria e fornecedor decorados na
 * linha) e o `fast-json-stringify` descarta campo de objeto aninhado em silêncio quando o schema
 * sai de sincronia — mesma razão documentada em `admin-reports.route.ts`.
 */
export const adminExpensesRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminExpensesController(fastify)
  const auth = { preHandler: [fastify.authenticate] }
  const TAG = 'admin — expenses'

  const idParams = {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', description: 'ObjectId do registro.' } },
  }

  // ── Categorias ──────────────────────────────────────────────────────────

  fastify.get(
    '/admin/expense-categories',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Listar categorias de despesa (admin)',
        description:
          'Categorias cadastráveis (decisão 4 do plano). Cada uma pertence a um ExpenseGroup, e é o GRUPO que define a linha do DRE — por isso o admin cria categoria sem deploy. `isFixed` marca despesa que existe mesmo com venda zero, e é o que torna o ponto de equilíbrio calculável. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            includeInactive: { type: 'boolean', description: 'Inclui categorias desativadas.' },
          },
        },
      },
    },
    ctrl.listCategories.bind(ctrl),
  )

  fastify.post(
    '/admin/expense-categories',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Criar categoria de despesa (admin)',
        description: 'Nome único. `group` define em que linha do DRE a categoria entra. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
      },
    },
    ctrl.createCategory.bind(ctrl),
  )

  fastify.patch(
    '/admin/expense-categories/:id',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Atualizar categoria de despesa (admin)',
        security: [{ bearerAuth: [] }],
        params: idParams,
      },
    },
    ctrl.updateCategory.bind(ctrl),
  )

  fastify.delete(
    '/admin/expense-categories/:id',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Remover categoria de despesa (admin)',
        description:
          'Apaga só quando NÃO há lançamento; com histórico, apenas DESATIVA (`deactivated: true`). Apagar quebraria o DRE de um mês fechado, que perderia a linha. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: idParams,
      },
    },
    ctrl.deleteCategory.bind(ctrl),
  )

  // ── Contas a pagar (antes de /:id para não colidir na rota) ─────────────

  fastify.get(
    '/admin/expenses/payable',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Contas a pagar (admin)',
        description:
          'Despesas PENDING com vencimento até o horizonte, das mais atrasadas para as mais distantes. `isOverdue` compara por DIA BRT — conta que vence hoje às 23h não está atrasada às 10h. Despesa sem `dueDate` fica fora (não há como dizer se atrasou) e segue visível na lista do mês. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            daysAhead: { type: 'integer', description: 'Horizonte em dias (padrão 30).' },
          },
        },
      },
    },
    ctrl.listPayable.bind(ctrl),
  )

  fastify.post(
    '/admin/expenses/import',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Importar despesas em massa (admin)',
        description:
          'Importa até 500 linhas, resolvendo a categoria por NOME (quem monta a planilha não conhece ObjectId). NUNCA cria categoria implicitamente — a linha volta em `errors`. Importa o que dá e relata o resto: falhar tudo por uma linha obrigaria a recomeçar a planilha inteira. Existe para dar histórico ao DRE, que sem meses anteriores não tem comparativo. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
      },
    },
    ctrl.importRows.bind(ctrl),
  )

  fastify.post(
    '/admin/expenses/receipt',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Enviar comprovante de despesa (admin)',
        description:
          'Sobe a foto/imagem do comprovante e devolve a URL para gravar em `receiptUrl`. Separado do lançamento de propósito: upload que falha (rede ruim na rua, bucket não configurado) NÃO pode impedir o registro da despesa — o front lança sem anexo. Devolve 503 quando o S3 não está configurado. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
      },
    },
    ctrl.uploadReceipt.bind(ctrl),
  )

  // ── Lançamentos ─────────────────────────────────────────────────────────

  fastify.get(
    '/admin/expenses',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Listar despesas (admin)',
        description:
          'Lançamentos do mês de competência, com categoria/fornecedor/condomínio decorados na linha. ' +
          'Informar `month` MATERIALIZA as parcelas das recorrências ativas daquele mês antes de listar (decisão 11: preguiçoso, não cron — um cron que falhasse em silêncio deixaria o mês sem despesa fixa e o DRE com lucro inflado). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            month: { type: 'string', description: 'Mês de competência (YYYY-MM, BRT).' },
            categoryId: { type: 'string', description: 'Filtrar por categoria.' },
            group: {
              type: 'string',
              enum: ['COGS', 'PEOPLE', 'OPERATION', 'SALES', 'ADMIN', 'TAXES', 'OTHER'],
              description: 'Filtrar por grupo do DRE.',
            },
            status: { type: 'string', enum: ['PENDING', 'PAID', 'CANCELLED'] },
            condominiumId: { type: 'string', description: 'Centro de custo (decisão 5).' },
            supplierId: { type: 'string' },
          },
        },
      },
    },
    ctrl.list.bind(ctrl),
  )

  fastify.post(
    '/admin/expenses',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Lançar despesa (admin)',
        description:
          '`competenceDate` é o mês a que a despesa PERTENCE; `paidAt`, quando o dinheiro saiu — os dois regimes do DRE precisam de uma data cada. O `status` é DERIVADO de `paidAt` e não é aceito do cliente: uma despesa PAID sem data de pagamento sumiria do fluxo de caixa e apareceria no DRE. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
      },
    },
    ctrl.create.bind(ctrl),
  )

  fastify.patch(
    '/admin/expenses/:id',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Atualizar despesa (admin)',
        description:
          '`paidAt: null` desmarca o pagamento e devolve a despesa para contas a pagar. Mudança de valor guarda `previousAmount` e `updatedById` (auditoria A4). `status` aceita só CANCELLED — PENDING/PAID vêm de `paidAt`. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: idParams,
      },
    },
    ctrl.update.bind(ctrl),
  )

  fastify.post(
    '/admin/expenses/:id/pay',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Marcar despesa como paga (admin)',
        description: 'Atalho do contas a pagar. Sem `paidAt`, usa agora. Despesa cancelada é rejeitada. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: idParams,
      },
    },
    ctrl.markPaid.bind(ctrl),
  )

  fastify.post(
    '/admin/expenses/purchases/:id/pay',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Marcar compra ao fornecedor como paga (admin)',
        description:
          'Registra o pagamento de um `PurchaseOrder` FINALIZED (B5). A compra sai de contas a pagar e a SAÍDA DE CAIXA passa a contar no dia do pagamento, não no da finalização. ' +
          'Compra anterior a este campo continua contando pela data de finalização (`paidAt ?? date`), então nenhum número histórico muda. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: idParams,
      },
    },
    ctrl.markPurchasePaid.bind(ctrl),
  )

  fastify.delete(
    '/admin/expenses/:id',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Remover despesa (admin)',
        description:
          'Parcela de recorrência é CANCELADA (`cancelled: true`), não apagada: apagar liberaria o índice único e a próxima abertura do mês a recriaria — a despesa "excluída" reapareceria. Lançamento avulso é apagado. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: idParams,
      },
    },
    ctrl.remove.bind(ctrl),
  )

  // ── Recorrências ────────────────────────────────────────────────────────

  fastify.get(
    '/admin/expense-recurrences',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Listar recorrências de despesa (admin)',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: { includeInactive: { type: 'boolean' } },
        },
      },
    },
    ctrl.listRecurrences.bind(ctrl),
  )

  fastify.post(
    '/admin/expense-recurrences',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Criar recorrência de despesa (admin)',
        description:
          '`dayOfMonth` aceita 1..28 apenas: 29/30/31 não existem em todos os meses, e clampar em silêncio faria o aluguel "dia 31" vencer dia 28 em fevereiro sem ninguém pedir. As parcelas nascem PENDING e com valor EDITÁVEL — conta de luz varia. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
      },
    },
    ctrl.createRecurrence.bind(ctrl),
  )

  fastify.patch(
    '/admin/expense-recurrences/:id',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Atualizar recorrência de despesa (admin)',
        security: [{ bearerAuth: [] }],
        params: idParams,
      },
    },
    ctrl.updateRecurrence.bind(ctrl),
  )

  fastify.delete(
    '/admin/expense-recurrences/:id',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Remover recorrência de despesa (admin)',
        description:
          'Apaga só quando ainda não gerou parcela; com histórico, apenas DESATIVA. As parcelas guardam `recurrenceId`, e apagar deixaria referência órfã. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: idParams,
      },
    },
    ctrl.removeRecurrence.bind(ctrl),
  )

  fastify.get(
    '/admin/reports/expenses',
    {
      ...auth,
      schema: {
        tags: [TAG],
        summary: 'Relatório de despesas (admin)',
        description:
          'Para onde o dinheiro foi no período, por grupo do DRE, por categoria e por recebedor, com variação vs a janela anterior EQUIVALENTE. ' +
          'Separa FIXO × VARIÁVEL — o recorte não é cosmético: é o insumo do ponto de equilíbrio, que sem ele não sai. ' +
          '`avgPrevious` traz o gasto médio dos 3 meses anteriores por categoria, base do alerta de anomalia. ' +
          '`hookAcquisition` é o custo de aquisição via gancho grátis (ganchos FREE/BONUS entregues × `ganchoCusto`), `null` enquanto o custo não for informado — CAC inventado é pior que CAC ausente. ' +
          'Apura por COMPETÊNCIA: conta de agosto paga em setembro é custo de agosto. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getReport.bind(ctrl),
  )
}
