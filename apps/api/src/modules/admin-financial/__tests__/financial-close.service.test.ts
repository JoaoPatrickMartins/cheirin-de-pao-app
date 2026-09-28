// financial-close.service.test.ts — fechamento de mês com snapshot (A1 · achado do §16).
//
// O defeito que isto conserta: `loadUnitCosts()` lê o custo de fornecimento de AGORA, então o DRE
// de agosto muda sozinho quando o fornecedor sobe o preço em setembro. Os testes travam as duas
// metades da solução:
//
//   1. **Congelar o certo** — o fechamento apura com `skipFrozen` (senão congelaria o congelado),
//      guarda os DOIS regimes, e recusa mês em curso ou já fechado.
//   2. **Servir o congelado** — depois de fechado, a leitura NÃO recalcula, e o regime pedido
//      escolhe qual lado do snapshot vai em `dre`.
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { FinancialCloseService, CloseError } from '../financial-close.service.js'
import { readFrozenDre, brtMonthOf, isMonthClosed } from '../financial-close.snapshot.js'
import { DreService } from '../dre.service.js'

/** 5 de setembro de 2026 — agosto fechado, setembro em curso. */
const NOW = new Date('2026-09-05T12:00:00.000Z')

const dreResult = (netProfit: number) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ netProfit, grossRevenue: 10000, caveats: [], sections: [] }) as any

const dreResponse = () =>
  ({
    regime: 'cash',
    dre: dreResult(1000),
    alternate: dreResult(1500),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bridge: { cashResult: 1000, accrualResult: 1500, difference: 500, lines: [] } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

function makePrisma(row: Record<string, unknown> | null = null) {
  return {
    financialClose: {
      findUnique: vi.fn().mockResolvedValue(row),
      findMany: vi.fn().mockResolvedValue(row ? [row] : []),
      create: vi.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve(data)),
      update: vi.fn().mockResolvedValue(row),
      delete: vi.fn().mockResolvedValue(row),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeService = (prisma: unknown) => new FinancialCloseService({ prisma, log: { warn: vi.fn() } } as any)

/** Um documento de fechamento já gravado. */
const closedRow = (month = '2026-08') => ({
  id: 'fc1',
  month,
  closedAt: new Date('2026-09-01T10:00:00.000Z'),
  closedById: 'admin1',
  notes: null,
  reopenedAt: null,
  snapshot: {
    version: 1,
    cash: dreResult(1000),
    accrual: dreResult(1500),
    bridge: { cashResult: 1000, accrualResult: 1500, difference: 500, lines: [] },
  },
})

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('FinancialCloseService.close', () => {
  it('congela os DOIS regimes e a ponte', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreResponse())
    const prisma = makePrisma(null)
    await makeService(prisma).close('2026-08', 'admin1', 'enviado ao contador', NOW)

    const data = prisma.financialClose.create.mock.calls[0][0].data
    expect(data.month).toBe('2026-08')
    expect(data.closedById).toBe('admin1')
    expect(data.notes).toBe('enviado ao contador')
    // Os dois lados: congelar só um faria o outro voltar a ser recalculado e a divergir.
    expect(data.snapshot.cash.netProfit).toBe(1000)
    expect(data.snapshot.accrual.netProfit).toBe(1500)
    expect(data.snapshot.version).toBe(1)
  })

  it('apura com `skipFrozen` — senão congelaria o próprio congelado', async () => {
    const spy = vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreResponse())
    await makeService(makePrisma(null)).close('2026-08', 'admin1', null, NOW)
    expect(spy.mock.calls[0][2]).toEqual({ skipFrozen: true })
  })

  it('RECUSA fechar o mês em curso', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreResponse())
    // Congelar um número que ainda vai mudar é o pior dos dois mundos: ele passaria a parecer
    // definitivo.
    await expect(
      makeService(makePrisma(null)).close('2026-09', 'admin1', null, NOW),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('RECUSA fechar duas vezes, em vez de sobrescrever', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreResponse())
    await expect(
      makeService(makePrisma(closedRow())).close('2026-08', 'admin1', null, NOW),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('recusa mês fora do formato', async () => {
    await expect(makeService(makePrisma(null)).close('08/2026', 'a', null, NOW)).rejects.toBeInstanceOf(
      CloseError,
    )
  })

  it('não apura o DRE quando o fechamento é recusado', async () => {
    const spy = vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreResponse())
    await expect(
      makeService(makePrisma(closedRow())).close('2026-08', 'a', null, NOW),
    ).rejects.toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('FinancialCloseService.reopen', () => {
  it('grava o rastro ANTES de apagar e registra no log', async () => {
    const prisma = makePrisma(closedRow())
    const warn = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new FinancialCloseService({ prisma, log: { warn } } as any)

    await svc.reopen('2026-08', 'admin2', NOW)

    expect(prisma.financialClose.update).toHaveBeenCalledWith({
      where: { month: '2026-08' },
      data: { reopenedAt: NOW, reopenedById: 'admin2' },
    })
    expect(prisma.financialClose.delete).toHaveBeenCalled()
    // Reabrir em silêncio recriaria o problema com uma camada a mais de confiança falsa.
    expect(warn).toHaveBeenCalled()
    expect(String(warn.mock.calls[0][0])).toMatch(/REABERTO por admin2/)
  })

  it('recusa reabrir mês que não está fechado', async () => {
    await expect(makeService(makePrisma(null)).reopen('2026-08', 'a', NOW)).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('FinancialCloseService.getStatus', () => {
  it('reporta mês fechado', async () => {
    const s = await makeService(makePrisma(closedRow())).getStatus('2026-08', NOW)
    expect(s).toMatchObject({ month: '2026-08', isClosed: true, closedById: 'admin1', isPartial: false })
  })

  it('reporta mês aberto e em curso', async () => {
    const s = await makeService(makePrisma(null)).getStatus('2026-09', NOW)
    expect(s).toMatchObject({ isClosed: false, isPartial: true })
  })
})

describe('readFrozenDre', () => {
  it('devolve o snapshot com o regime pedido em `dre`', async () => {
    const r = await readFrozenDre(makePrisma(closedRow()), '2026-08', 'cash')
    expect(r!.dre.netProfit).toBe(1000)
    expect(r!.alternate.netProfit).toBe(1500)
    expect(r!.closedAt).toBe('2026-09-01T10:00:00.000Z')
  })

  it('inverte os lados quando o regime pedido é competência', async () => {
    const r = await readFrozenDre(makePrisma(closedRow()), '2026-08', 'accrual')
    expect(r!.regime).toBe('accrual')
    expect(r!.dre.netProfit).toBe(1500)
    expect(r!.alternate.netProfit).toBe(1000)
  })

  it('devolve null quando o mês não está fechado', async () => {
    expect(await readFrozenDre(makePrisma(null), '2026-08', 'cash')).toBeNull()
  })

  it('devolve null — e deixa recalcular — quando o formato do snapshot é desconhecido', async () => {
    // Formato antigo não é "quase certo": melhor recalcular do que servir algo que a tela lê errado.
    const row = { ...closedRow(), snapshot: { version: 99, cash: dreResult(1) } }
    expect(await readFrozenDre(makePrisma(row), '2026-08', 'cash')).toBeNull()
  })

  it('devolve null quando o snapshot está vazio', async () => {
    expect(
      await readFrozenDre(makePrisma({ ...closedRow(), snapshot: null }), '2026-08', 'cash'),
    ).toBeNull()
  })
})

describe('brtMonthOf — a trava do lançamento retroativo', () => {
  it('resolve o mês pelo calendário BRT, não UTC', () => {
    // 31/08 23h BRT = 01/09 02h UTC. Ler em UTC jogaria a despesa para setembro — a armadilha
    // que o §13 documenta.
    expect(brtMonthOf(new Date('2026-09-01T02:00:00.000Z'))).toBe('2026-08')
    expect(brtMonthOf(new Date('2026-09-01T03:00:00.000Z'))).toBe('2026-09')
  })

  it('atravessa a virada de ano', () => {
    expect(brtMonthOf(new Date('2027-01-01T02:00:00.000Z'))).toBe('2026-12')
  })

  it('isMonthClosed devolve o mês quando ele está fechado', async () => {
    const at = new Date('2026-08-15T15:00:00.000Z')
    expect(await isMonthClosed(makePrisma(closedRow()), at)).toBe('2026-08')
    expect(await isMonthClosed(makePrisma(null), at)).toBeNull()
  })
})
