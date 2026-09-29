// dre — a aritmética da Demonstração do Resultado (Fase 4 do plano-financeiro-vendas).
//
// `buildDre` é pura de propósito: é aqui que mora a ordem e o SINAL de cada linha, e um erro de
// sinal num DRE vira lucro. O que estes testes protegem:
//   1. A cascata (bruta → líquida → bruto → EBITDA → líquido) e os sinais.
//   2. Os dois regimes diferem SÓ em receita e despesa — o que torna a ponte uma identidade.
//   3. As ressalvas aparecem quando o número é parcial. Um DRE parcial exibido como fechamento é
//      pior que um DRE ausente.
//   4. O GMV da Cestinha nunca entra na receita (D-2).
import { describe, it, expect, vi } from 'vitest'
import { buildDre, buildBridge, referralBonusCost, type DreInputs } from '../dre.js'
import { monthWindow, presetWindow } from '../date-range.js'

const AGOSTO = monthWindow('2026-08', new Date('2026-09-20T12:00:00Z'))

const zero: DreInputs = {
  creditRevenueCash: 0,
  combosCash: 0,
  avulsoCash: 0,
  marketRevenueCash: 0,
  hookRevenueCash: 0,
  creditRevenueAccrual: 0,
  marketRevenueAccrual: 0,
  hookRevenueAccrual: 0,
  refunds: 0,
  gatewayFee: 0,
  gatewayEstimatedCount: 0,
  breadCost: 0,
  marketCmv: 0,
  unitsWithoutCost: 0,
  itemLoss: 0,
  expensesByGroup: {},
  expensesUnpaid: 0,
}

/** Um mês completo e realista, com todos os blocos preenchidos. */
const cheio: DreInputs = {
  ...zero,
  creditRevenueCash: 6000,
  combosCash: 5000,
  avulsoCash: 1000,
  marketRevenueCash: 400,
  hookRevenueCash: 100,
  creditRevenueAccrual: 4500,
  marketRevenueAccrual: 380,
  hookRevenueAccrual: 100,
  refunds: 50,
  gatewayFee: 150,
  breadCost: 2000,
  marketCmv: 200,
  itemLoss: 30,
  expensesByGroup: { PEOPLE: 1400, OPERATION: 300, ADMIN: 900, TAXES: 80 },
}

describe('buildDre — a cascata', () => {
  const dre = buildDre(cheio, 'cash', AGOSTO)

  it('receita bruta soma combos, avulso, Cestinha e gancho', () => {
    expect(dre.grossRevenue).toBe(6500) // 5000 + 1000 + 400 + 100
  })

  it('deduções somam estorno e taxa de gateway', () => {
    expect(dre.deductions).toBe(200) // 50 + 150
    expect(dre.netRevenue).toBe(6300)
  })

  it('CMV soma pão comprado e produtos da Cestinha', () => {
    expect(dre.cogs).toBe(2200)
  })

  it('lucro bruto desconta CMV e perdas da receita LÍQUIDA', () => {
    expect(dre.grossProfit).toBe(4070) // 6300 − 2200 − 30
  })

  it('EBITDA desconta as operacionais, sem impostos', () => {
    // 1400 + 300 + 900 = 2600 (TAXES fica de fora)
    expect(dre.operatingExpenses).toBe(2600)
    expect(dre.ebitda).toBe(1470)
  })

  it('lucro líquido desconta os impostos', () => {
    expect(dre.taxes).toBe(80)
    expect(dre.netProfit).toBe(1390)
  })

  it('as margens são % da receita LÍQUIDA', () => {
    expect(dre.grossMarginPct).toBe(64.6) // 4070 / 6300
    expect(dre.netMarginPct).toBe(22.1) // 1390 / 6300
  })

  it('receita zero não divide por zero nem devolve Infinity', () => {
    const vazio = buildDre(zero, 'cash', AGOSTO)
    expect(vazio.netMarginPct).toBe(0)
    expect(Number.isFinite(vazio.netMarginPct)).toBe(true)
  })

  it('prejuízo é negativo, não zero', () => {
    const ruim = buildDre({ ...cheio, expensesByGroup: { ADMIN: 9000 } }, 'cash', AGOSTO)
    expect(ruim.netProfit).toBeLessThan(0)
  })
})

describe('buildDre — regimes', () => {
  it('caixa detalha combos e avulso; competência mostra o consumo', () => {
    const cash = buildDre(cheio, 'cash', AGOSTO)
    const accrual = buildDre(cheio, 'accrual', AGOSTO)

    expect(cash.sections[0].lines.map((l) => l.key)).toContain('combos')
    expect(accrual.sections[0].lines.map((l) => l.key)).toContain('credit')
  })

  it('competência reconhece MENOS receita quando se vendeu mais crédito do que se entregou', () => {
    const cash = buildDre(cheio, 'cash', AGOSTO)
    const accrual = buildDre(cheio, 'accrual', AGOSTO)

    // É o comportamento correto do pré-pago: num mês de campanha, caixa infla e competência não.
    expect(accrual.grossRevenue).toBeLessThan(cash.grossRevenue)
  })

  it('CMV, perdas e taxa NÃO mudam entre regimes', () => {
    // É esta invariante que torna a ponte uma identidade exata em vez de aproximação.
    const cash = buildDre(cheio, 'cash', AGOSTO)
    const accrual = buildDre(cheio, 'accrual', AGOSTO)

    expect(accrual.cogs).toBe(cash.cogs)
    expect(accrual.losses).toBe(cash.losses)
    expect(accrual.deductions).toBe(cash.deductions)
  })

  it('cada resultado declara o próprio regime', () => {
    expect(buildDre(cheio, 'cash', AGOSTO).regime).toBe('cash')
    expect(buildDre(cheio, 'accrual', AGOSTO).regime).toBe('accrual')
  })
})

describe('buildBridge — a diferença é explicada, não escondida', () => {
  const cash = buildDre(cheio, 'cash', AGOSTO)
  const accrual = buildDre({ ...cheio, expensesByGroup: { ...cheio.expensesByGroup, ADMIN: 1100 } }, 'accrual', AGOSTO)
  const bridge = buildBridge(cash, accrual)

  it('a diferença é exatamente (Δ receita) − (Δ despesa)', () => {
    // A identidade que justifica a ponte existir: se ela não fechasse, a ponte seria decorativa.
    expect(bridge.difference).toBe(Math.round((bridge.revenueDelta - bridge.expenseDelta) * 100) / 100)
  })

  it('expõe os dois resultados e as duas parcelas', () => {
    expect(bridge.cashResult).toBe(cash.netProfit)
    expect(bridge.accrualResult).toBe(accrual.netProfit)
    expect(bridge.lines).toHaveLength(4)
  })

  it('a dica do passivo explica o SENTIDO do movimento', () => {
    const line = bridge.lines.find((l) => l.label.includes('passivo'))
    expect(line?.hint).toMatch(/vendeu mais crédito|entregou mais/)
  })
})

describe('buildDre — ressalvas', () => {
  it('período em curso se declara', () => {
    const emCurso = presetWindow('month', new Date('2026-09-20T12:00:00Z'))
    const dre = buildDre(cheio, 'cash', emCurso)
    expect(dre.caveats.some((c) => c.includes('EM CURSO'))).toBe(true)
  })

  it('mês fechado NÃO traz a ressalva de período em curso', () => {
    expect(buildDre(cheio, 'cash', AGOSTO).caveats.some((c) => c.includes('EM CURSO'))).toBe(false)
  })

  it('sempre declara a base do CMV do pão (decisão 2)', () => {
    // Sem isto, ninguém saberia que o desperdício está embutido no CMV.
    const dre = buildDre(cheio, 'cash', AGOSTO)
    expect(dre.caveats.some((c) => c.includes('COMPRADO'))).toBe(true)
  })

  it('avisa quando a taxa de gateway é parcialmente estimada', () => {
    const dre = buildDre({ ...cheio, gatewayEstimatedCount: 12 }, 'cash', AGOSTO)
    expect(dre.caveats.some((c) => c.includes('ESTIMADA') && c.includes('12'))).toBe(true)
  })

  it('avisa quando há unidade vendida sem custo cadastrado', () => {
    const dre = buildDre({ ...cheio, unitsWithoutCost: 7 }, 'cash', AGOSTO)
    expect(dre.caveats.some((c) => c.includes('sem custo'))).toBe(true)
  })

  it('sem despesa lançada, avisa que o resultado é lucro BRUTO', () => {
    // A leitura otimista que faria o dono achar que o negócio vai melhor do que vai.
    const semDespesa = buildDre({ ...cheio, expensesByGroup: {} }, 'cash', AGOSTO)
    expect(semDespesa.caveats.some((c) => c.includes('lucro bruto'))).toBe(true)
  })

  it('com despesa lançada, a ressalva some', () => {
    expect(buildDre(cheio, 'cash', AGOSTO).caveats.some((c) => c.includes('lucro bruto'))).toBe(false)
  })

  it('competência avisa quando inclui despesa ainda não paga', () => {
    const dre = buildDre({ ...cheio, expensesUnpaid: 900 }, 'accrual', AGOSTO)
    expect(dre.caveats.some((c) => c.includes('não pagas'))).toBe(true)
  })
})

describe('buildDre — regras do domínio', () => {
  it('COGS lançado à mão entra no CMV, não nas operacionais', () => {
    const dre = buildDre(
      { ...cheio, expensesByGroup: { ...cheio.expensesByGroup, COGS: 500 } },
      'cash',
      AGOSTO,
    )
    expect(dre.cogs).toBe(2700) // 2000 + 200 + 500
    expect(dre.operatingExpenses).toBe(2600) // inalterado
  })

  it('a linha de perdas se chama "de item" — a sobra de pão não está nela', () => {
    // Prometer "desperdício" aqui seria mentir sobre a cobertura, dado o CMV da decisão 2.
    const dre = buildDre(cheio, 'cash', AGOSTO)
    expect(dre.sections.find((s) => s.key === 'losses')?.label).toBe('Perdas de item')
  })

  it('sem perda, a seção não é desenhada', () => {
    const dre = buildDre({ ...cheio, itemLoss: 0 }, 'cash', AGOSTO)
    expect(dre.sections.find((s) => s.key === 'losses')).toBeUndefined()
  })

  it('a taxa de gateway aparece mesmo zerada — é linha estrutural do DRE', () => {
    const dre = buildDre(zero, 'cash', AGOSTO)
    expect(dre.sections.find((s) => s.key === 'deductions')?.lines.map((l) => l.key)).toContain('gateway')
  })

  it('estorno zerado não vira linha', () => {
    const dre = buildDre({ ...cheio, refunds: 0 }, 'cash', AGOSTO)
    const keys = dre.sections.find((s) => s.key === 'deductions')?.lines.map((l) => l.key)
    expect(keys).not.toContain('refunds')
  })

  it('a Cestinha entra pela receita em DINHEIRO — o GMV não tem como entrar', () => {
    // D-2: o insumo do DRE é `marketRevenueCash`; não existe campo de GMV nesta interface, então a
    // dupla contagem é impossível por construção.
    const dre = buildDre(cheio, 'cash', AGOSTO)
    const market = dre.sections[0].lines.find((l) => l.key === 'market')
    expect(market?.value).toBe(400)
    expect(Object.keys(cheio)).not.toContain('gmv')
  })

  it('grupo de despesa zerado não polui a demonstração', () => {
    const dre = buildDre({ ...cheio, expensesByGroup: { PEOPLE: 100, SALES: 0 } }, 'cash', AGOSTO)
    const keys = dre.sections.find((s) => s.key === 'opex')?.lines.map((l) => l.key)
    expect(keys).toEqual(['opex-PEOPLE'])
  })

  it('imposto zerado não desenha a seção — mas o campo continua existindo', () => {
    const dre = buildDre({ ...cheio, expensesByGroup: { PEOPLE: 100 } }, 'cash', AGOSTO)
    expect(dre.sections.find((s) => s.key === 'taxes')).toBeUndefined()
    expect(dre.taxes).toBe(0)
  })

  it('carrega a janela apurada, para o cabeçalho e a exportação', () => {
    const dre = buildDre(cheio, 'cash', AGOSTO)
    expect(dre.window.label).toBe('agosto de 2026')
    expect(dre.window.isPartial).toBe(false)
  })
})

describe('Indique e Ganhe — bonificações de indicação (§7.10)', () => {
  const comBonus: DreInputs = { ...cheio, expensesByGroup: { ...cheio.expensesByGroup, SALES: 200 }, referralBonus: 60 }

  it('competência: linha própria logo depois do comercial, e o resultado desce junto', () => {
    const sem = buildDre({ ...comBonus, referralBonus: 0 }, 'accrual', AGOSTO)
    const dre = buildDre(comBonus, 'accrual', AGOSTO)
    const opex = dre.sections.find((s) => s.key === 'opex')!
    expect(opex.lines.map((l) => l.key)).toEqual(['opex-PEOPLE', 'opex-OPERATION', 'opex-SALES', 'referral-bonus', 'opex-ADMIN'])
    const line = opex.lines.find((l) => l.key === 'referral-bonus')!
    expect(line).toMatchObject({ label: 'Bonificações de indicação', value: 60, isNegative: true })
    expect(dre.operatingExpenses).toBe(sem.operatingExpenses + 60)
    expect(dre.netProfit).toBe(Math.round((sem.netProfit - 60) * 100) / 100)
  })

  it('sem comercial lançado, entra antes das administrativas', () => {
    const dre = buildDre({ ...cheio, referralBonus: 10 }, 'accrual', AGOSTO)
    expect(dre.sections.find((s) => s.key === 'opex')!.lines.map((l) => l.key)).toEqual([
      'opex-PEOPLE',
      'opex-OPERATION',
      'referral-bonus',
      'opex-ADMIN',
    ])
  })

  it('caixa: o bônus não passou pelo banco — a linha não existe', () => {
    const dre = buildDre(comBonus, 'cash', AGOSTO)
    const sem = buildDre({ ...comBonus, referralBonus: 0 }, 'cash', AGOSTO)
    expect(dre.sections.find((s) => s.key === 'opex')!.lines.some((l) => l.key === 'referral-bonus')).toBe(false)
    expect(dre.netProfit).toBe(sem.netProfit)
  })

  it('a ponte ganha a parcela própria e continua fechando exatamente', () => {
    const cash = buildDre(comBonus, 'cash', AGOSTO)
    const accrual = buildDre(comBonus, 'accrual', AGOSTO)
    const bridge = buildBridge(cash, accrual)
    const semBonus = buildBridge(cash, buildDre({ ...comBonus, referralBonus: 0 }, 'accrual', AGOSTO))

    // O Δ despesa ("não pagas") não muda por causa do bônus — ele tem a própria linha.
    expect(bridge.expenseDelta).toBe(semBonus.expenseDelta)
    expect(bridge.lines.map((l) => l.label)).toContain('Bonificações de indicação')
    expect(bridge.difference).toBe(Math.round((bridge.revenueDelta - bridge.expenseDelta + 60) * 100) / 100)
    // Da competência ao caixa, somando as parcelas do meio.
    const middle = bridge.lines.slice(1, -1).reduce((acc, l) => acc + l.value, 0)
    expect(Math.round((bridge.accrualResult + middle) * 100) / 100).toBe(bridge.cashResult)
  })
})

describe('referralBonusCost', () => {
  it('pãezins REFERRAL_* creditados no período × preço médio', async () => {
    const aggregate = vi.fn().mockResolvedValue({ _sum: { quantityMilli: 26_000 } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma = { creditTransaction: { aggregate } } as any
    expect(await referralBonusCost(prisma, AGOSTO, 1.2)).toBe(31.2)
    expect(aggregate).toHaveBeenCalledWith({
      _sum: { quantityMilli: true },
      where: {
        type: { in: ['REFERRAL_BONUS', 'REFERRAL_WELCOME', 'REFERRAL_GOAL'] },
        createdAt: { gte: AGOSTO.startDate, lte: AGOSTO.endDate },
      },
    })
  })
})
