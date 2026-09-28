import { FastifyPluginAsync } from 'fastify'
import { AdminFinancialController } from './admin-financial.controller.js'
import { periodQuerystring } from '../../lib/period-query.js'

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
            ...periodQuerystring.properties,
            condominiumId: {
              type: 'string',
              description: 'Filtrar por condomínio específico (MongoDB ObjectId). Omitir para consolidado geral.',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Relatório financeiro do período.',
            properties: {
              period: {
                type: 'string',
                enum: ['day', 'week', 'month'],
                description: 'O preset usado, quando a janela veio de `period`. Ausente em `month`/`from`-`to` — um intervalo arbitrário não É um preset.',
              },
              window: {
                type: 'object',
                description: 'A janela efetivamente apurada. `isPartial` = período EM CURSO (termina agora), e a tela precisa dizer isso em vez de exibir o número como fechamento.',
                properties: {
                  from: { type: 'string', description: 'Início da janela (ISO, UTC).' },
                  to: { type: 'string', description: 'Fim da janela (ISO, UTC).' },
                  label: { type: 'string', description: 'Rótulo pt-BR (ex.: "agosto de 2026", "hoje").' },
                  isPartial: { type: 'boolean', description: 'true quando o período ainda está em curso.' },
                },
              },
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
                  credits: { type: 'number', description: 'Pãezinhos usados como pagamento no período (decimal — o crédito é fracionado).' },
                  orders: { type: 'integer', description: 'Cestinhas confirmadas no período.' },
                  cmv: { type: 'number', description: 'Custo esperado do que foi vendido (itens + pão da Cestinha), pela matriz de fornecimento.' },
                  margin: { type: 'number', description: 'GMV − CMV.' },
                  marginPct: { type: 'number', description: 'Margem em % do GMV.' },
                  unitsWithoutCost: { type: 'integer', description: 'Unidades vendidas sem custo cadastrado — enquanto > 0 a margem é PARCIAL.' },
                },
              },
              hook: {
                type: 'object',
                description:
                  'Gancho de porta PAGO. Entrou na receita na onda Financeiro/DRE (decisão 7): antes o purpose HOOK era excluído de tudo e nunca voltava, então era receita com Pix confirmado invisível no admin. Por isso `totalConsolidated` ficou maior que na versão anterior.',
                properties: {
                  revenue: { type: 'number', description: 'Receita de ganchos pagos no período (R$).' },
                  orders: { type: 'integer', description: 'Ganchos pagos no período.' },
                },
              },
              totalConsolidated: {
                type: 'number',
                description:
                  'Receita de crédito + Cestinha (dinheiro novo) + gancho pago. O GMV não entra (D-2).',
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

  fastify.get(
    '/admin/financial/gateway',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — financial'],
        summary: 'Conciliação de gateway (admin)',
        description:
          'Bruto × taxa × líquido dos pagamentos aprovados no período, com quebra por método e por finalidade. ' +
          'A taxa é a REAL quando o provedor informou (`realCount`) e ESTIMADA pela alíquota configurada no restante (`estimatedCount`) — enquanto houver estimados, a linha é parcialmente estimativa e a tela precisa dizer isso. ' +
          'Estornos vêm em linha própria e FORA do total: o gateway normalmente não devolve a taxa de um pagamento estornado. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getGateway.bind(ctrl),
  )

  fastify.get(
    '/admin/financial/dre',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — financial'],
        summary: 'DRE — Demonstração do Resultado (admin)',
        description:
          'Receita bruta → deduções → receita líquida → CMV → lucro bruto → despesas operacionais → EBITDA → impostos → lucro líquido, com % da receita líquida em cada nível. ' +
          '`regime=cash` (padrão) reconhece a receita no pagamento; `accrual`, no consumo/entrega. A resposta traz sempre o OUTRO regime em `alternate` e a ponte entre eles em `bridge`. ' +
          'Cada resultado carrega `caveats` que a tela DEVE exibir: período em curso, taxa estimada, unidades sem custo, e o fato de o CMV do pão ser o custo COMPRADO (o desperdício fica embutido nele — ver Relatórios › Desperdício). ' +
          'Padrão de janela é o MÊS: um DRE de "mês até agora" não fecha com extrato. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            ...periodQuerystring.properties,
            regime: {
              type: 'string',
              enum: ['cash', 'accrual'],
              description: 'Regime contábil. Padrão: cash (decisão 1 do plano-financeiro-vendas).',
            },
          },
        },
      },
    },
    ctrl.getDre.bind(ctrl),
  )

  fastify.get(
    '/admin/financial/cashflow',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — financial'],
        summary: 'Fluxo de caixa realizado (admin)',
        description:
          'Quando o dinheiro entrou e saiu — pergunta diferente da do DRE, que responde se o período deu lucro. Num modelo pré-pago os dois divergem: combo vendido é caixa hoje e pão a entregar depois. ' +
          'Entradas pelo LÍQUIDO (bruto − taxa de gateway), que é o que o extrato mostra; saídas são despesas com `paidAt` na janela mais compras ao fornecedor finalizadas, mais estornos. ' +
          'A série é diária e CONTÍNUA (inclui dias sem movimento, senão a linha do acumulado salta), e o acumulado parte de ZERO: é a variação do período, não o saldo bancário — o sistema não conhece o extrato. ' +
          'Tudo REALIZADO; o que está por vir vive em contas a pagar. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getCashflow.bind(ctrl),
  )

  fastify.get(
    '/admin/financial/margin',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — financial'],
        summary: 'Margem por produto e por condomínio + ponto de equilíbrio (admin)',
        description:
          'Onde a margem realmente está (F8), o ponto de equilíbrio sobre a despesa FIXA (F9) e o rateio de despesa indireta por condomínio (B3). ' +
          'A margem é de CONTRIBUIÇÃO (receita − custo da mercadoria): não há rateio de despesa operacional por produto, porque o critério de rateio trocaria o "vencedor". ' +
          'Produto sem custo cadastrado sai com `null` e entra em `unitsWithoutCost` — nunca como margem de 100%. ' +
          'O custo por condomínio é RATEIO por pães entregues, e despesa que já tem centro de custo fica fora dele. Default: MÊS. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getMargin.bind(ctrl),
  )

  fastify.get(
    '/admin/financial/trend',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — financial'],
        summary: 'Tendência financeira consolidada (admin)',
        description:
          'Receita, CMV, lucro bruto, despesa operacional, resultado, margens e caixa mês a mês (D4). **Diferente do DRE de propósito:** o DRE é o detalhe de UM mês, este responde "está melhorando ou piorando". ' +
          'Cada mês compõe o MESMO cálculo da tela de DRE (regime de caixa) e do fluxo de caixa, então a tendência nunca discorda delas. ' +
          'Passivo de crédito e contas a pagar vêm em `position`, à parte e SEM série: são saldos de hoje, e o sistema não guarda snapshot mensal — repetir o número do dia em seis barras sugeriria estabilidade não medida. ' +
          'O mês corrente é marcado `isPartial` e fica fora das comparações. Cacheado por ~5 min. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            months: {
              type: 'integer',
              minimum: 1,
              maximum: 12,
              description: 'Meses na série, terminando no mês corrente. Padrão 6; cada mês custa um DRE completo.',
            },
          },
        },
      },
    },
    ctrl.getTrend.bind(ctrl),
  )

  // ---------------------------------------------------------------- fechamento de mês (A1)
  fastify.get(
    '/admin/financial/close',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — financial'],
        summary: 'Fechamento de mês: estado ou lista (admin)',
        description:
          'Sem `month`, lista os meses já fechados. Com `month`, devolve o ESTADO daquele mês (`isClosed`, `isPartial`) — é o que a tela do DRE consulta para saber se pode oferecer o botão de fechar. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: { month: { type: 'string', description: 'YYYY-MM (BRT).' } },
        },
      },
    },
    ctrl.listCloses.bind(ctrl),
  )

  fastify.post(
    '/admin/financial/close',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — financial'],
        summary: 'Fechar o mês, congelando o DRE (admin)',
        description:
          'Apura o DRE uma última vez e CONGELA o resultado (A1). Depois disso a tela lê o snapshot e nunca recalcula — é o que torna o número auditável: `loadUnitCosts()` lê o custo de fornecimento de AGORA, então sem o fechamento o DRE de agosto muda sozinho quando o fornecedor sobe o preço em setembro. ' +
          'Mês em curso é RECUSADO (409): congelaria um número que ainda vai mudar. Mês já fechado também (409) — refazer exige reabrir antes. ' +
          'Fechar também TRAVA lançamento retroativo de despesa naquele mês e impede a materialização de recorrências nele. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['month'],
          properties: {
            month: { type: 'string', description: 'Mês a fechar (YYYY-MM, BRT). Precisa já ter terminado.' },
            notes: { type: 'string', nullable: true, description: 'Observação do fechamento (ex.: "enviado ao contador em 05/09").' },
          },
        },
      },
    },
    ctrl.createClose.bind(ctrl),
  )

  fastify.delete(
    '/admin/financial/close/:month',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — financial'],
        summary: 'Reabrir um mês fechado (admin)',
        description:
          'Apaga o congelamento: o DRE volta a ser recalculado e o mês volta a aceitar lançamento. A reabertura NÃO é silenciosa — quem reabriu e quando o mês fora fechado vão para o log. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['month'],
          properties: { month: { type: 'string', description: 'YYYY-MM (BRT).' } },
        },
      },
    },
    ctrl.deleteClose.bind(ctrl),
  )

  fastify.get(
    '/admin/financial/accountant-package',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — financial'],
        summary: 'Pacote do contador — ZIP mensal (admin)',
        description:
          'ZIP com o DRE em PDF nos DOIS regimes, o razão de despesas em XLSX (por competência) e os comprovantes anexados (D3). ' +
          'Comprovante que não pôde ser baixado NÃO some em silêncio: entra no `MANIFESTO.txt` com o motivo e a URL de origem, porque um ZIP incompleto sem lista deixa o contador sem saber o que pedir de volta. ' +
          'Mês não fechado é gerado como PRÉVIA, com o aviso no PDF e no manifesto. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            month: { type: 'string', description: 'Mês do pacote (YYYY-MM, BRT). Padrão: mês corrente.' },
          },
        },
      },
    },
    ctrl.getAccountantPackage.bind(ctrl),
  )

  fastify.get(
    '/admin/financial/simulate',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — financial'],
        summary: 'Simulador de cenário (admin)',
        description:
          'Responde "e se o pão subir 5%?" sem persistir nada. Roda a MESMA aritmética do ponto de equilíbrio sobre os insumos do período e devolve o cenário-base e o simulado lado a lado — ' +
          'sem alteração, os dois são idênticos, que é o contrato que impede o simulador de divergir do relatório. Variações em %, limitadas a −100..+500. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            ...periodQuerystring.properties,
            revenue: { type: 'number', description: 'Variação % da receita (ex.: 10 = +10%).' },
            cogs: { type: 'number', description: 'Variação % do custo da mercadoria.' },
            fixed: { type: 'number', description: 'Variação % da despesa fixa.' },
          },
        },
      },
    },
    ctrl.getSimulation.bind(ctrl),
  )

  fastify.get(
    '/admin/financial/budget',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — financial'],
        summary: 'Metas do mês: realizado × previsto (admin)',
        description:
          'Compara o realizado com a meta do mês (F11). Todo item traz `expectedToDate` — a meta PRO RATA pelos dias decorridos —, porque comparar 10 dias de realizado com a meta cheia dá sempre "30% da meta" e não informa nada. ' +
          '`isGood` já resolve o sinal (receita acima da meta é bom, despesa acima é ruim), para nenhuma tela inventar a própria regra de cor. Padrão: mês corrente (BRT). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            month: { type: 'string', description: 'Mês da meta (YYYY-MM, BRT). Padrão: mês corrente.' },
          },
        },
      },
    },
    ctrl.getBudget.bind(ctrl),
  )

  fastify.post(
    '/admin/financial/budget',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — financial'],
        summary: 'Definir meta do mês (admin)',
        description:
          'Cria ou REDEFINE a meta de (mês, tipo, categoria) — definir meta é ação repetida, e um POST que falhasse com "já existe" obrigaria o admin a caçar o id antes de editar. ' +
          '`categoryId` nulo é a meta do tipo inteiro: a receita do mês, ou o teto total de despesa. Meta por categoria só existe para despesa. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['month', 'kind', 'amount'],
          properties: {
            month: { type: 'string', description: 'YYYY-MM (BRT).' },
            kind: { type: 'string', enum: ['REVENUE', 'EXPENSE'] },
            categoryId: {
              type: 'string',
              nullable: true,
              description: 'Categoria de despesa. Nulo = meta do tipo inteiro.',
            },
            amount: { type: 'number', description: 'Valor da meta (R$). Não pode ser negativo.' },
            notes: { type: 'string', nullable: true },
          },
        },
      },
    },
    ctrl.putBudget.bind(ctrl),
  )

  fastify.delete(
    '/admin/financial/budget/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — financial'],
        summary: 'Remover meta (admin)',
        description: 'Apaga a meta. O realizado não é afetado — só o comparativo deixa de existir. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'Id da meta.' } },
        },
      },
    },
    ctrl.deleteBudget.bind(ctrl),
  )
}
