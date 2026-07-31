// credit-milli-backfill.test.ts — migração do saldo de crédito para milésimos de pãozinho.
//
// O que este backfill protege: a escrita dupla usa `$inc` no campo canônico, e um `$inc` sobre
// documento em que a chave NÃO existe não credita nada — o débito fracionado é perdido e a chave
// fica `null` (medido em 31/07/2026: cliente pagou 5,5 🥖, o legado tirou 6 e o canônico ficou
// null, então o app mostrava 54 em vez de 54,5). Por isso o backfill roda no boot, ANTES de
// servir tráfego, e por isso o guard é por pendência, não por flag.
import { describe, it, expect, vi } from 'vitest'
import { runCreditMilliBackfill, backfillCreditMilliIfNeeded } from '../credit-milli-backfill.js'

interface MockOpts {
  users?: Array<{ id: string; creditBalance: number }>
  txs?: Array<{ id: string; quantity: number }>
  orders?: Array<{ id: string; creditsApplied: number }>
  /** Σ creditBalance de TODOS os usuários (inclui os já migrados). */
  somaLegado?: number
  /** Σ creditMilli depois do backfill (o mock não recalcula sozinho). */
  somaMilli?: number
  flag?: boolean
}

function makePrisma(o: MockOpts = {}) {
  const { users = [], txs = [], orders = [], flag = false } = o
  const somaLegado = o.somaLegado ?? users.reduce((s, u) => s + u.creditBalance, 0)
  const somaMilli = o.somaMilli ?? somaLegado * 1000

  // Cada findMany devolve a lista pendente na 1ª chamada e vazio depois — simula o campo
  // deixando de ser null conforme o backfill escreve.
  const drain = <T>(rows: T[]) => {
    let served = false
    return vi.fn().mockImplementation(() => {
      if (served) return Promise.resolve([])
      served = true
      return Promise.resolve(rows)
    })
  }

  const userUpdate = vi.fn().mockResolvedValue({})
  const txUpdate = vi.fn().mockResolvedValue({})
  const orderUpdate = vi.fn().mockResolvedValue({})
  const settingUpsert = vi.fn().mockResolvedValue({})

  const prisma = {
    user: {
      findMany: drain(users),
      update: userUpdate,
      aggregate: vi.fn().mockResolvedValue({ _sum: { creditMilli: somaMilli, creditBalance: somaLegado } }),
      // `count` responde a pendência: o guard do boot é por documento pendente, não por flag.
      count: vi.fn().mockResolvedValue(users.length),
    },
    creditTransaction: { findMany: drain(txs), update: txUpdate },
    marketOrder: { findMany: drain(orders), update: orderUpdate },
    setting: {
      findUnique: vi.fn().mockResolvedValue(flag ? { key: 'creditMilliBackfilledAt', value: 'x' } : null),
      upsert: settingUpsert,
    },
  }
  return { prisma, userUpdate, txUpdate, orderUpdate, settingUpsert }
}

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

describe('runCreditMilliBackfill', () => {
  it('multiplica por 1000 os três campos legados', async () => {
    const { prisma, userUpdate, txUpdate, orderUpdate } = makePrisma({
      users: [{ id: 'u1', creditBalance: 45 }, { id: 'u2', creditBalance: 0 }],
      txs: [{ id: 't1', quantity: 30 }, { id: 't2', quantity: -2 }],
      orders: [{ id: 'o1', creditsApplied: 3 }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await runCreditMilliBackfill(prisma as any)

    expect(r).toMatchObject({ users: 2, transactions: 2, marketOrders: 1 })
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { creditMilli: 45000 } })
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'u2' }, data: { creditMilli: 0 } })
    // Débito no extrato mantém o sinal negativo.
    expect(txUpdate).toHaveBeenCalledWith({ where: { id: 't2' }, data: { quantityMilli: -2000 } })
    expect(orderUpdate).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { creditsAppliedMilli: 3000 } })
  })

  it('é idempotente: nada pendente = nenhuma escrita', async () => {
    const { prisma, userUpdate, txUpdate, orderUpdate } = makePrisma({ somaLegado: 45, somaMilli: 45000 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await runCreditMilliBackfill(prisma as any)

    expect(r).toMatchObject({ users: 0, transactions: 0, marketOrders: 0 })
    expect(userUpdate).not.toHaveBeenCalled()
    expect(txUpdate).not.toHaveBeenCalled()
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('devolve as duas somas para conferência', async () => {
    const { prisma } = makePrisma({ users: [{ id: 'u1', creditBalance: 45 }] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await runCreditMilliBackfill(prisma as any)
    expect(r.somaMilli).toBe(45000)
    expect(r.somaLegado).toBe(45000)
  })
})

describe('backfillCreditMilliIfNeeded', () => {
  it('sai na hora quando NÃO há pendência (nem olha o resto)', async () => {
    const { prisma, userUpdate, settingUpsert } = makePrisma({ users: [] })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await backfillCreditMilliIfNeeded(prisma as any, log as any)

    expect(prisma.user.findMany).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
    expect(settingUpsert).not.toHaveBeenCalled()
  })

  it('roda mesmo com a flag já gravada, se ainda há documento pendente', async () => {
    // Regressão do incidente real: o 1º backfill gravou a flag sem migrar ninguém (o filtro
    // `{ creditMilli: null }` não acha documento SEM a chave no Prisma + MongoDB). Com guard por
    // flag, esses usuários nunca mais seriam migrados.
    const { prisma, userUpdate } = makePrisma({ flag: true, users: [{ id: 'u1', creditBalance: 45 }] })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await backfillCreditMilliIfNeeded(prisma as any, log as any)

    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { creditMilli: 45000 } })
  })

  it('roda e grava a flag de execução única', async () => {
    const { prisma, userUpdate, settingUpsert } = makePrisma({ users: [{ id: 'u1', creditBalance: 45 }] })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await backfillCreditMilliIfNeeded(prisma as any, log as any)

    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { creditMilli: 45000 } })
    expect(settingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'creditMilliBackfilledAt' } }),
    )
  })

  it('avisa quando as somas divergem, sem falhar', async () => {
    const warn = vi.fn()
    const { prisma } = makePrisma({ users: [{ id: 'u1', creditBalance: 45 }], somaMilli: 44500 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await backfillCreditMilliIfNeeded(prisma as any, { ...log, warn } as any)

    expect(warn).toHaveBeenCalled()
  })

  it('não derruba o boot nem grava a flag se o backfill falhar', async () => {
    const error = vi.fn()
    const { prisma, settingUpsert } = makePrisma({ users: [{ id: 'u1', creditBalance: 45 }] })
    prisma.user.update = vi.fn().mockRejectedValue(new Error('mongo caiu'))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(backfillCreditMilliIfNeeded(prisma as any, { ...log, error } as any)).resolves.toBeUndefined()

    expect(error).toHaveBeenCalled()
    // Sem a flag, tenta de novo no próximo boot.
    expect(settingUpsert).not.toHaveBeenCalled()
  })
})

describe('filtro de pendência (lição do Prisma + MongoDB)', () => {
  it('procura por null E por chave AUSENTE (isSet: false) nos três modelos', async () => {
    // `{ campo: null }` sozinho casa só `null` explícito: documento em que a chave nunca foi
    // escrita fica de fora. Medido na base real: 9 documentos sem a chave, `{ creditMilli: null }`
    // achava 1. Sem o `isSet`, o backfill "roda" e não migra ninguém.
    const { prisma } = makePrisma({ users: [{ id: 'u1', creditBalance: 45 }] })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runCreditMilliBackfill(prisma as any)

    const esperado = (campo: string) => ({
      OR: [{ [campo]: null }, { [campo]: { isSet: false } }],
    })
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: esperado('creditMilli') }),
    )
    expect(prisma.creditTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: esperado('quantityMilli') }),
    )
    expect(prisma.marketOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: esperado('creditsAppliedMilli') }),
    )
  })
})
