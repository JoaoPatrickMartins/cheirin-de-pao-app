/**
 * dre — a Demonstração do Resultado do Exercício (Fase 4 do plano-financeiro-vendas).
 *
 * É a tela que o módulo inteiro existe para produzir. Antes dela o admin tinha
 * "receita − custo da mercadoria", que é **lucro bruto**, não resultado: aluguel, entregador,
 * combustível, taxa de gateway e imposto não existiam em lugar nenhum do sistema.
 *
 * ── Os dois regimes (decisão 1 do plano) ────────────────────────────────────────────────────
 *
 * **CAIXA é o padrão.** É o número que o dono reconcilia com o extrato do banco e é o que ele já
 * via antes — trocar o padrão para competência mudaria todos os números conhecidos sem aviso.
 *
 * **COMPETÊNCIA** responde "o mês deu lucro?" e é o que o contador pede. Num modelo PRÉ-PAGO os
 * dois divergem muito: o combo vendido hoje é caixa hoje e receita ao longo de semanas, conforme o
 * pão é entregue. Num mês de campanha, caixa infla e competência não.
 *
 * O que muda entre eles, e **só isso**:
 *   - **Receita** — caixa reconhece no `Payment`; competência, no CONSUMO (pão entregue, Cestinha
 *     entregue, gancho entregue).
 *   - **Despesa** — caixa usa `Expense.paidAt`; competência, `Expense.competenceDate`.
 *
 * Como nada mais muda, a diferença entre os dois resultados é EXATAMENTE a soma dessas duas
 * diferenças — e é isso que {@link buildBridge} demonstra, em vez de deixar a divergência virar
 * desconfiança no relatório.
 *
 * ── Simplificações declaradas ────────────────────────────────────────────────────────────────
 *
 * 1. **CMV do pão = custo COMPRADO no período** (decisão 2, divergente da recomendação original).
 *    `PurchaseOrderItem.unitPrice` é dinheiro pago de fato, e o pão é `stockType: DAILY` comprado
 *    pela demanda confirmada do turno — compra e entrega caem no mesmo dia. **Contrapartida:** o
 *    desperdício de pão NÃO vira linha do DRE; fica embutido no CMV. O relatório carrega nota de
 *    rodapé apontando para Relatórios › Desperdício.
 * 2. **CMV e taxa de gateway não mudam entre regimes.** Amarrar cada compra à entrega que ela
 *    serviu exigiria controle de lote, que o sistema não tem (`product-cost.ts` já documenta).
 * 3. **Estoque fica fora do resultado** (decisão 10): é posição, não fluxo.
 * 4. **Imposto é registrado, nunca calculado** (decisão 9).
 */
import type { PrismaClient } from '@prisma/client'
import { fromMilli } from '@cheirin-de-pao/shared'
import type { DateWindow } from './date-range.js'

const round2 = (n: number) => Math.round(n * 100) / 100

export type DreRegime = 'cash' | 'accrual'

/** Uma linha da demonstração. */
export interface DreLine {
  key: string
  label: string
  value: number
  /** `%` da receita líquida. Ausente nas próprias linhas de receita bruta. */
  pctOfNet?: number
  /** Linha de subtotal (negrito na tela). */
  isTotal?: boolean
  /** Sinal com que a linha entra no resultado: despesas são negativas. */
  isNegative?: boolean
  /** Explicação curta da origem — o relatório declara de onde cada número veio. */
  hint?: string
}

export interface DreSection {
  key: string
  label: string
  lines: DreLine[]
  total: number
}

export interface DreResult {
  regime: DreRegime
  window: { from: string; to: string; label: string; isPartial: boolean }

  grossRevenue: number
  deductions: number
  netRevenue: number
  cogs: number
  losses: number
  grossProfit: number
  operatingExpenses: number
  ebitda: number
  taxes: number
  netProfit: number

  grossMarginPct: number
  operatingMarginPct: number
  netMarginPct: number

  sections: DreSection[]

  /**
   * Ressalvas que a tela DEVE exibir junto do número. Um DRE com base parcial exibido como se
   * fosse fechamento é pior que um DRE ausente.
   */
  caveats: string[]
}

/** Insumos já apurados pelos serviços existentes — o DRE compõe, não reagrega. */
export interface DreInputs {
  /** Receita de crédito (combos + avulso), regime de CAIXA. */
  creditRevenueCash: number
  combosCash: number
  avulsoCash: number
  /** Parte em dinheiro da Cestinha, regime de CAIXA. */
  marketRevenueCash: number
  /** Gancho de porta pago, regime de CAIXA. */
  hookRevenueCash: number

  /** Receita reconhecida por CONSUMO/ENTREGA (competência). */
  creditRevenueAccrual: number
  marketRevenueAccrual: number
  hookRevenueAccrual: number

  /** Estornos do período. */
  refunds: number
  /** Taxa de gateway (real quando o provedor informou, estimada no resto). */
  gatewayFee: number
  /** Quantos pagamentos tiveram a taxa apenas ESTIMADA. */
  gatewayEstimatedCount: number

  /** Custo do pão comprado no período (decisão 2). */
  breadCost: number
  /** Custo dos produtos vendidos na Cestinha. */
  marketCmv: number
  /** Unidades vendidas sem custo cadastrado — torna a margem parcial. */
  unitsWithoutCost: number
  /** Perda de item (Cestinha não entregue, resolvida como perda). */
  itemLoss: number

  /** Despesas do período por grupo do DRE, no regime pedido. */
  expensesByGroup: Record<string, number>
  /** Despesas do período ainda NÃO pagas (só faz sentido em competência). */
  expensesUnpaid: number
}

const GROUP_LABEL: Record<string, string> = {
  PEOPLE: 'Pessoal e entrega',
  OPERATION: 'Operação',
  SALES: 'Comercial e marketing',
  ADMIN: 'Administrativas',
  OTHER: 'Outras',
}

/** Grupos que entram em despesas OPERACIONAIS (COGS vai para o CMV; TAXES, para impostos). */
const OPERATING_GROUPS = ['PEOPLE', 'OPERATION', 'SALES', 'ADMIN', 'OTHER'] as const

/**
 * Monta a demonstração a partir dos insumos.
 *
 * Função PURA de propósito: toda a aritmética do resultado fica testável sem banco, e é ela que
 * define a ordem e o sinal de cada linha — o lugar onde um erro de sinal viraria lucro.
 */
export function buildDre(
  inputs: DreInputs,
  regime: DreRegime,
  window: DateWindow,
): DreResult {
  const isCash = regime === 'cash'

  const credit = isCash ? inputs.creditRevenueCash : inputs.creditRevenueAccrual
  const market = isCash ? inputs.marketRevenueCash : inputs.marketRevenueAccrual
  const hook = isCash ? inputs.hookRevenueCash : inputs.hookRevenueAccrual

  // ── Receita bruta ──────────────────────────────────────────────────────
  const revenueLines: DreLine[] = isCash
    ? [
        { key: 'combos', label: 'Combos', value: round2(inputs.combosCash), hint: 'compra de créditos' },
        { key: 'avulso', label: 'Compra personalizada', value: round2(inputs.avulsoCash), hint: 'compra de créditos' },
      ]
    : [
        {
          key: 'credit',
          label: 'Pãezinhos entregues',
          value: round2(credit),
          hint: 'créditos consumidos × preço médio histórico',
        },
      ]

  if (market > 0) {
    revenueLines.push({
      key: 'market',
      label: '🧺 Cestinha (dinheiro)',
      value: round2(market),
      // D-2: o GMV jamais entra. A parte paga em pãezinhos já foi faturada na compra do combo, e
      // somá-la contaria a mesma nota duas vezes.
      hint: isCash ? 'parte em dinheiro — o GMV não entra' : 'Cestinhas entregues',
    })
  }
  if (hook > 0) {
    revenueLines.push({
      key: 'hook',
      label: 'Gancho de porta',
      value: round2(hook),
      hint: isCash ? 'ganchos pagos' : 'ganchos entregues',
    })
  }

  const grossRevenue = round2(revenueLines.reduce((s, l) => s + l.value, 0))

  // ── Deduções ───────────────────────────────────────────────────────────
  const deductionLines: DreLine[] = []
  if (inputs.refunds > 0) {
    deductionLines.push({
      key: 'refunds',
      label: 'Estornos',
      value: round2(inputs.refunds),
      isNegative: true,
      hint: 'pagamentos devolvidos',
    })
  }
  deductionLines.push({
    key: 'gateway',
    label: 'Taxa de gateway',
    value: round2(inputs.gatewayFee),
    isNegative: true,
    hint:
      inputs.gatewayEstimatedCount > 0
        ? `${inputs.gatewayEstimatedCount} pagamento(s) com taxa estimada`
        : 'taxa informada pelo provedor',
  })

  const deductions = round2(deductionLines.reduce((s, l) => s + l.value, 0))
  const netRevenue = round2(grossRevenue - deductions)

  // % da receita LÍQUIDA — a base clássica do DRE. Com receita zero não há percentual: 0 seria
  // enganoso e Infinity, pior.
  const pct = (v: number) => (netRevenue > 0 ? Math.round((v / netRevenue) * 1000) / 10 : 0)

  // ── CMV ────────────────────────────────────────────────────────────────
  // COGS lançado à mão entra AQUI, não nas operacionais: é custo de mercadoria por definição.
  const manualCogs = round2(inputs.expensesByGroup.COGS ?? 0)
  const cogsLines: DreLine[] = [
    {
      key: 'bread',
      label: 'Pão comprado',
      value: round2(inputs.breadCost),
      isNegative: true,
      // Decisão 2 declarada na própria linha — é o que impede alguém de ler isto como "pão entregue".
      hint: 'custo pago ao fornecedor no período',
    },
  ]
  if (inputs.marketCmv > 0) {
    cogsLines.push({
      key: 'market-cmv',
      label: 'Produtos da Cestinha',
      value: round2(inputs.marketCmv),
      isNegative: true,
      hint: 'custo esperado pela matriz de fornecimento',
    })
  }
  if (manualCogs > 0) {
    cogsLines.push({
      key: 'cogs-manual',
      label: 'Custo de mercadoria (lançado)',
      value: manualCogs,
      isNegative: true,
      hint: 'despesas do grupo Custo da mercadoria',
    })
  }
  const cogs = round2(cogsLines.reduce((s, l) => s + l.value, 0))

  // ── Perdas ─────────────────────────────────────────────────────────────
  // Rótulo "de ITEM", e não "e desperdício": pela decisão 2, a sobra de pão fica dentro do CMV, e
  // prometer desperdício aqui seria mentir sobre a cobertura da linha.
  const losses = round2(inputs.itemLoss)
  const lossLines: DreLine[] =
    losses > 0
      ? [
          {
            key: 'item-loss',
            label: 'Cestinha não entregue',
            value: losses,
            isNegative: true,
            hint: 'mercadoria resolvida como perda',
          },
        ]
      : []

  const grossProfit = round2(netRevenue - cogs - losses)

  // ── Despesas operacionais ──────────────────────────────────────────────
  const opexLines: DreLine[] = OPERATING_GROUPS.map((g) => ({
    key: `opex-${g}`,
    label: GROUP_LABEL[g] ?? g,
    value: round2(inputs.expensesByGroup[g] ?? 0),
    isNegative: true,
  })).filter((l) => l.value > 0)

  const operatingExpenses = round2(opexLines.reduce((s, l) => s + l.value, 0))
  const ebitda = round2(grossProfit - operatingExpenses)

  // ── Impostos ───────────────────────────────────────────────────────────
  const taxes = round2(inputs.expensesByGroup.TAXES ?? 0)
  const netProfit = round2(ebitda - taxes)

  // ── Ressalvas ──────────────────────────────────────────────────────────
  const caveats: string[] = []
  if (window.isPartial) {
    caveats.push('Período EM CURSO — o resultado ainda não está fechado.')
  }
  caveats.push(
    'O CMV do pão é o custo COMPRADO no período; o desperdício fica embutido nele. Veja Relatórios › Desperdício.',
  )
  if (inputs.gatewayEstimatedCount > 0) {
    caveats.push(
      `Taxa de gateway parcialmente ESTIMADA (${inputs.gatewayEstimatedCount} pagamento(s)) — ajuste as alíquotas nas Configurações.`,
    )
  }
  if (inputs.unitsWithoutCost > 0) {
    caveats.push(
      `${inputs.unitsWithoutCost} unidade(s) vendida(s) sem custo cadastrado — o CMV da Cestinha é PARCIAL.`,
    )
  }
  if (!isCash && inputs.expensesUnpaid > 0) {
    caveats.push(
      `Inclui ${formatBrl(inputs.expensesUnpaid)} de despesas do período ainda não pagas.`,
    )
  }
  if (operatingExpenses === 0 && taxes === 0) {
    // Sem despesa lançada, "lucro líquido" é lucro BRUTO com outro nome — e essa é a leitura
    // otimista que faria o dono achar que o negócio vai melhor do que vai.
    caveats.push(
      'Nenhuma despesa operacional lançada no período — o resultado abaixo é lucro bruto, não lucro real.',
    )
  }

  const sections: DreSection[] = [
    { key: 'revenue', label: 'Receita bruta', lines: revenueLines, total: grossRevenue },
    { key: 'deductions', label: 'Deduções', lines: deductionLines, total: deductions },
    { key: 'cogs', label: 'Custo da mercadoria vendida', lines: cogsLines, total: cogs },
    ...(lossLines.length > 0
      ? [{ key: 'losses', label: 'Perdas de item', lines: lossLines, total: losses }]
      : []),
    { key: 'opex', label: 'Despesas operacionais', lines: opexLines, total: operatingExpenses },
    ...(taxes > 0
      ? [
          {
            key: 'taxes',
            label: 'Impostos e taxas',
            lines: [
              {
                key: 'taxes',
                label: 'Impostos',
                value: taxes,
                isNegative: true,
                hint: 'lançados manualmente — o sistema não calcula tributo',
              },
            ],
            total: taxes,
          },
        ]
      : []),
  ]

  return {
    regime,
    window: {
      from: window.startDate.toISOString(),
      to: window.endDate.toISOString(),
      label: window.label,
      isPartial: window.isPartial,
    },
    grossRevenue,
    deductions,
    netRevenue,
    cogs,
    losses,
    grossProfit,
    operatingExpenses,
    ebitda,
    taxes,
    netProfit,
    grossMarginPct: pct(grossProfit),
    operatingMarginPct: pct(ebitda),
    netMarginPct: pct(netProfit),
    sections,
    caveats,
  }
}

export interface DreBridge {
  cashResult: number
  accrualResult: number
  /** Receita de caixa menos receita de competência — o movimento do passivo de crédito. */
  revenueDelta: number
  /** Despesa paga menos despesa de competência. */
  expenseDelta: number
  /** `cashResult − accrualResult`. Igual a `revenueDelta − expenseDelta` por construção. */
  difference: number
  lines: Array<{ label: string; value: number; hint: string }>
}

/**
 * A ponte entre os dois regimes.
 *
 * Existe para a pergunta inevitável — *"por que os dois números são diferentes?"* — não virar
 * desconfiança no relatório. Como CMV, perdas e taxa de gateway são idênticos nos dois regimes,
 * a diferença é EXATAMENTE `(receita caixa − receita competência) − (despesa paga − despesa de
 * competência)`, e a ponte mostra as duas parcelas.
 */
export function buildBridge(cash: DreResult, accrual: DreResult): DreBridge {
  const revenueDelta = round2(cash.grossRevenue - accrual.grossRevenue)
  const expenseDelta = round2(
    cash.operatingExpenses + cash.taxes + cogsManualOf(cash) -
      (accrual.operatingExpenses + accrual.taxes + cogsManualOf(accrual)),
  )

  return {
    cashResult: cash.netProfit,
    accrualResult: accrual.netProfit,
    revenueDelta,
    expenseDelta,
    difference: round2(cash.netProfit - accrual.netProfit),
    lines: [
      {
        label: 'Resultado por competência',
        value: accrual.netProfit,
        hint: 'receita reconhecida na entrega',
      },
      {
        label: 'Variação do passivo de crédito',
        value: revenueDelta,
        hint:
          revenueDelta >= 0
            ? 'vendeu mais crédito do que entregou — entrou caixa, virou dívida em pão'
            : 'entregou mais do que vendeu — consumiu passivo de períodos anteriores',
      },
      {
        label: 'Despesas do período ainda não pagas',
        value: round2(-expenseDelta),
        hint: 'competência sem saída de caixa',
      },
      { label: 'Resultado por caixa', value: cash.netProfit, hint: 'o que passou pelo banco' },
    ],
  }
}

/** Parcela de CMV que veio de despesa lançada à mão (grupo COGS). */
function cogsManualOf(dre: DreResult): number {
  const line = dre.sections
    .find((s) => s.key === 'cogs')
    ?.lines.find((l) => l.key === 'cogs-manual')
  return line?.value ?? 0
}

function formatBrl(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Receita reconhecida por CONSUMO no período (competência) — créditos gastos × preço médio.
 *
 * `DELIVERY` (pão entregue) e `MARKET_PURCHASE` (pãezinhos gastos na Cestinha) são as duas formas
 * de consumir crédito; ambas são entrega de valor e portanto receita. `quantityMilli` é negativo
 * nos débitos, então a soma é invertida no fim.
 *
 * O preço por crédito é o médio HISTÓRICO (o mesmo de `getCreditLiability`), e não o do período:
 * o crédito consumido hoje foi comprado em algum momento do passado, a preços variados, e o
 * sistema não rastreia lote de crédito. É aproximação — declarada como tal na linha.
 */
export async function accrualCreditRevenue(
  prisma: PrismaClient,
  window: DateWindow,
  pricePerCredit: number,
): Promise<number> {
  const agg = await prisma.creditTransaction.aggregate({
    _sum: { quantityMilli: true },
    where: {
      type: { in: ['DELIVERY', 'MARKET_PURCHASE'] },
      createdAt: { gte: window.startDate, lte: window.endDate },
    },
  })
  const consumed = Math.abs(fromMilli(agg._sum.quantityMilli ?? 0))
  return round2(consumed * pricePerCredit)
}
