// credit-movement.service.test.ts — movimentação do passivo de crédito (F7) + o achado A2.
//
// Trava:
//   - o SINAL do dado manda, não o rótulo do tipo (um ADMIN_GRANT negativo reduz o passivo);
//   - soma em MILÉSIMOS até o fim — o crédito é fracionado e converter linha a linha acumula erro;
//   - 🚩A2: `EXPIRY` existe no enum e nunca é escrito, então `inactive` mede o saldo parado e a
//     ressalva NOMEIA o problema em vez de fingir que ele não existe;
//   - "sem movimento" e não "sem compra": quem consome pão da agenda está ativo.
import { describe, it, expect, vi } from 'vitest'

import { CreditMovementService } from '../credit-movement.service.js'
import { rangeWindow } from '../../../lib/date-range.js'

const WIN = () => rangeWindow('2026-08-01', '2026-08-31', new Date('2026-09-05T12:00:00Z'))
const NOW = new Date('2026-09-05T12:00:00.000Z')

function makePrisma(
  opts: {
    groups?: Array<{ type: string; _sum: { quantityMilli: number }; _count: number }>
    usersWithBalance?: Array<{ id: string; creditMilli: number }>
    recentMovers?: string[]
    purchaseMilli?: number
    purchaseAmount?: number
  } = {},
) {
  const {
    groups = [],
    usersWithBalance = [],
    recentMovers = [],
    purchaseMilli = 0,
    purchaseAmount = 0,
  } = opts
  return {
    creditTransaction: {
      groupBy: vi.fn().mockImplementation((args: { by: string[] }) =>
        Promise.resolve(
          args.by.includes('type') ? groups : recentMovers.map((userId) => ({ userId })),
        ),
      ),
      aggregate: vi.fn().mockResolvedValue({ _sum: { quantityMilli: purchaseMilli } }),
    },
    user: { findMany: vi.fn().mockResolvedValue(usersWithBalance) },
    payment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: purchaseAmount } }) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeService = (prisma: unknown) => new CreditMovementService({ prisma } as any)

describe('CreditMovementService — movimentação (F7)', () => {
  it('separa emissão de liquidação e calcula a variação', async () => {
    const r = await makeService(
      makePrisma({
        groups: [
          { type: 'PURCHASE', _sum: { quantityMilli: 30_000 }, _count: 10 },
          { type: 'DELIVERY', _sum: { quantityMilli: -12_000 }, _count: 40 },
          { type: 'MARKET_PURCHASE', _sum: { quantityMilli: -3_000 }, _count: 6 },
        ],
      }),
    ).getReport(WIN(), NOW)

    expect(r.issued).toBe(30)
    expect(r.settled).toBe(15)
    // Vendeu mais pão do que entregou: a dívida cresceu 15 pãezinhos.
    expect(r.net).toBe(15)
  })

  it('o SINAL do dado manda, não o rótulo do tipo', async () => {
    // Uma cortesia lançada errado e corrigida vem como ADMIN_GRANT NEGATIVO. Classificar por tipo
    // a somaria como emissão e inflaria o passivo.
    const r = await makeService(
      makePrisma({ groups: [{ type: 'ADMIN_GRANT', _sum: { quantityMilli: -5_000 }, _count: 1 }] }),
    ).getReport(WIN(), NOW)

    expect(r.issued).toBe(0)
    expect(r.settled).toBe(5)
    expect(r.rows[0].kind).toBe('out')
  })

  it('soma em milésimos e converte UMA vez — o crédito é fracionado e não se perde', async () => {
    // Dois grupos de poucos milésimos. Converter cada linha para pãezinhos e só então somar
    // arredondaria as frações para zero; somando em milésimos, os 3 milésimos sobrevivem.
    const r = await makeService(
      makePrisma({
        groups: [
          { type: 'PURCHASE', _sum: { quantityMilli: 1 }, _count: 1 },
          { type: 'ADMIN_GRANT', _sum: { quantityMilli: 2 }, _count: 1 },
        ],
      }),
    ).getReport(WIN(), NOW)
    expect(r.issued).toBe(0.003)
  })

  it('preserva a fração do pãozinho na conversão', async () => {
    const r = await makeService(
      makePrisma({ groups: [{ type: 'PURCHASE', _sum: { quantityMilli: 999 }, _count: 3 }] }),
    ).getReport(WIN(), NOW)
    expect(r.issued).toBe(0.999)
  })

  it('ordena por volume e traz rótulo legível de cada tipo', async () => {
    const r = await makeService(
      makePrisma({
        groups: [
          { type: 'PURCHASE', _sum: { quantityMilli: 5_000 }, _count: 1 },
          { type: 'DELIVERY', _sum: { quantityMilli: -50_000 }, _count: 1 },
        ],
      }),
    ).getReport(WIN(), NOW)

    expect(r.rows[0].type).toBe('DELIVERY')
    expect(r.rows[0].label).toBe('Consumo em entrega')
    expect(r.rows[1].label).toBe('Compra de créditos')
  })

  it('sobrevive a um tipo desconhecido, usando o próprio nome como rótulo', async () => {
    const r = await makeService(
      makePrisma({ groups: [{ type: 'FUTURO', _sum: { quantityMilli: 1_000 }, _count: 1 }] }),
    ).getReport(WIN(), NOW)
    expect(r.rows[0].label).toBe('FUTURO')
    expect(r.rows[0].kind).toBe('in')
  })

  it('período sem movimento devolve zeros, não erro', async () => {
    const r = await makeService(makePrisma()).getReport(WIN(), NOW)
    expect(r).toMatchObject({ issued: 0, settled: 0, net: 0, rows: [] })
  })
})

describe('CreditMovementService — crédito parado (🚩A2)', () => {
  it('conta só quem tem saldo E não se mexeu no período de inatividade', async () => {
    const r = await makeService(
      makePrisma({
        usersWithBalance: [
          { id: 'parado1', creditMilli: 10_000 },
          { id: 'parado2', creditMilli: 5_000 },
          { id: 'ativo', creditMilli: 8_000 },
        ],
        // "Sem movimento", não "sem compra": quem consome pão da agenda está ativo.
        recentMovers: ['ativo'],
        purchaseMilli: 100_000,
        purchaseAmount: 250,
      }),
    ).getReport(WIN(), NOW)

    expect(r.inactive.clients).toBe(2)
    expect(r.inactive.credits).toBe(15)
    // 250 / 100 créditos = R$ 2,50 por crédito × 15 = R$ 37,50.
    expect(r.inactive.estBRL).toBe(37.5)
    expect(r.inactive.months).toBe(12)
  })

  it('NOMEIA o problema na ressalva quando há saldo parado', async () => {
    const r = await makeService(
      makePrisma({ usersWithBalance: [{ id: 'p', creditMilli: 1_000 }], purchaseMilli: 1_000, purchaseAmount: 2 }),
    ).getReport(WIN(), NOW)
    expect(r.caveats.join(' ')).toMatch(/NÃO EXPIRA/)
  })

  it('não inventa ressalva de inatividade quando não há saldo parado', async () => {
    const r = await makeService(makePrisma()).getReport(WIN(), NOW)
    expect(r.inactive.credits).toBe(0)
    expect(r.caveats.join(' ')).not.toMatch(/NÃO EXPIRA/)
  })

  it('não divide por zero quando nunca houve compra de crédito', async () => {
    const r = await makeService(
      makePrisma({ usersWithBalance: [{ id: 'p', creditMilli: 9_000 }], purchaseMilli: 0 }),
    ).getReport(WIN(), NOW)
    expect(r.inactive.estBRL).toBe(0)
    expect(Number.isNaN(r.inactive.estBRL)).toBe(false)
  })

  it('só olha cliente com saldo POSITIVO — nunca `creditMilli: null`', async () => {
    const prisma = makePrisma()
    await makeService(prisma).getReport(WIN(), NOW)
    expect(prisma.user.findMany.mock.calls[0][0].where.creditMilli).toEqual({ gt: 0 })
  })
})
