// expense-recurrence — materialização preguiçosa das parcelas de despesa fixa (decisão 11).
//
// O que estes testes protegem:
//   1. Idempotência: abrir o mês duas vezes não gera aluguel duplicado (a trava é o índice único,
//      e a colisão P2002 conta como sucesso).
//   2. Vigência por MÊS, e `endsAt` resolvido em CÓDIGO — `where: { endsAt: null }` não encontra
//      documento sem a chave no Mongo.
//   3. A parcela nasce PENDING, com competência no dia 1 e vencimento no dia configurado.
import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { materializeRecurrences } from '../expense-recurrence.js'

interface Rec {
  id: string
  categoryId: string
  description: string
  amount: number
  dayOfMonth: number
  supplierId?: string | null
  payee?: string | null
  condominiumId?: string | null
  endsAt?: Date | null
}

/** Erro de colisão de índice único, como o Prisma o entrega. */
function uniqueViolation() {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
}

function makePrisma(
  recurrences: Rec[],
  opts: { failWith?: (data: Record<string, unknown>) => unknown } = {},
) {
  const created: Array<Record<string, unknown>> = []
  const findManyArgs: unknown[] = []

  const prisma = {
    expenseRecurrence: {
      findMany: vi.fn().mockImplementation((args: unknown) => {
        findManyArgs.push(args)
        return Promise.resolve(recurrences)
      }),
    },
    expense: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const err = opts.failWith?.(data)
        if (err) return Promise.reject(err)
        created.push(data)
        return Promise.resolve({ id: `exp-${created.length}`, ...data })
      }),
    },
  } as unknown as PrismaClient

  return { prisma, created, findManyArgs }
}

const aluguel: Rec = {
  id: 'rec-1',
  categoryId: 'cat-aluguel',
  description: 'Aluguel do depósito',
  amount: 900,
  dayOfMonth: 10,
}

describe('materializeRecurrences — criação', () => {
  it('cria a parcela com competência no dia 1 e vencimento no dia configurado', async () => {
    const { prisma, created } = makePrisma([aluguel])
    const r = await materializeRecurrences(prisma, '2026-08', 'admin-1')

    expect(r).toEqual({ created: 1, skipped: 0 })
    expect(created).toHaveLength(1)
    // 00:00 BRT = 03:00 UTC
    expect((created[0].competenceDate as Date).toISOString()).toBe('2026-08-01T03:00:00.000Z')
    expect((created[0].dueDate as Date).toISOString()).toBe('2026-08-10T03:00:00.000Z')
  })

  it('a parcela nasce PENDING — é o que alimenta contas a pagar', async () => {
    const { prisma, created } = makePrisma([aluguel])
    await materializeRecurrences(prisma, '2026-08', 'admin-1')
    expect(created[0].status).toBe('PENDING')
  })

  it('carrega recurrenceId e recurrenceMonth (a chave da trava de idempotência)', async () => {
    const { prisma, created } = makePrisma([aluguel])
    await materializeRecurrences(prisma, '2026-08', 'admin-1')

    expect(created[0].recurrenceId).toBe('rec-1')
    expect(created[0].recurrenceMonth).toBe('2026-08')
  })

  it('registra o admin que abriu o mês como autor (auditoria)', async () => {
    const { prisma, created } = makePrisma([aluguel])
    await materializeRecurrences(prisma, '2026-08', 'admin-42')
    expect(created[0].createdById).toBe('admin-42')
  })

  it('propaga fornecedor, recebedor e centro de custo', async () => {
    const { prisma, created } = makePrisma([
      { ...aluguel, supplierId: 'sup-1', payee: null, condominiumId: 'condo-1' },
    ])
    await materializeRecurrences(prisma, '2026-08', 'admin-1')

    expect(created[0].supplierId).toBe('sup-1')
    expect(created[0].condominiumId).toBe('condo-1')
  })

  it('sem recorrência ativa, não consulta nem cria nada', async () => {
    const { prisma, created } = makePrisma([])
    const r = await materializeRecurrences(prisma, '2026-08', 'admin-1')

    expect(r).toEqual({ created: 0, skipped: 0 })
    expect(created).toHaveLength(0)
  })
})

describe('materializeRecurrences — idempotência (a trava é do banco)', () => {
  it('colisão P2002 conta como skipped, não como erro', async () => {
    // É o caminho ESPERADO na segunda abertura do mês: a parcela já existe, então a operação já
    // está satisfeita.
    const { prisma, created } = makePrisma([aluguel], { failWith: () => uniqueViolation() })
    const r = await materializeRecurrences(prisma, '2026-08', 'admin-1')

    expect(r).toEqual({ created: 0, skipped: 1 })
    expect(created).toHaveLength(0)
  })

  it('erro que NÃO é P2002 sobe — falha real não pode virar "skipped"', async () => {
    const { prisma } = makePrisma([aluguel], { failWith: () => new Error('conexão perdida') })
    await expect(materializeRecurrences(prisma, '2026-08', 'admin-1')).rejects.toThrow('conexão perdida')
  })

  it('uma recorrência colidindo não impede as outras', async () => {
    const energia: Rec = { ...aluguel, id: 'rec-2', description: 'Energia', amount: 180, dayOfMonth: 20 }
    const { prisma, created } = makePrisma([aluguel, energia], {
      failWith: (data) => (data.recurrenceId === 'rec-1' ? uniqueViolation() : undefined),
    })

    const r = await materializeRecurrences(prisma, '2026-08', 'admin-1')
    expect(r).toEqual({ created: 1, skipped: 1 })
    expect(created[0].recurrenceId).toBe('rec-2')
  })
})

describe('materializeRecurrences — vigência', () => {
  it('endsAt no passado exclui a recorrência', async () => {
    const encerrada: Rec = { ...aluguel, endsAt: new Date('2026-06-30T03:00:00Z') }
    const { prisma, created } = makePrisma([encerrada])

    expect(await materializeRecurrences(prisma, '2026-08', 'admin-1')).toEqual({ created: 0, skipped: 0 })
    expect(created).toHaveLength(0)
  })

  it('endsAt dentro do mês ainda vale (vigência é por mês, não por dia)', async () => {
    const { prisma, created } = makePrisma([{ ...aluguel, endsAt: new Date('2026-08-15T03:00:00Z') }])
    await materializeRecurrences(prisma, '2026-08', 'admin-1')
    expect(created).toHaveLength(1)
  })

  it('endsAt ausente = sem fim, e o filtro é em CÓDIGO (armadilha do Mongo)', async () => {
    // `where: { endsAt: null }` não encontra documento criado antes do campo existir — a mesma
    // armadilha registrada em `Condominium.*Override`. Por isso a vigência é resolvida com `?? null`.
    const semChave = { ...aluguel } as Rec
    delete (semChave as unknown as Record<string, unknown>).endsAt

    const { prisma, created, findManyArgs } = makePrisma([semChave])
    await materializeRecurrences(prisma, '2026-08', 'admin-1')

    expect(created).toHaveLength(1)
    const where = (findManyArgs[0] as { where?: Record<string, unknown> }).where ?? {}
    expect('endsAt' in where).toBe(false)
  })

  it('só consulta recorrências que começaram antes do fim do mês', async () => {
    const { prisma, findManyArgs } = makePrisma([aluguel])
    await materializeRecurrences(prisma, '2026-08', 'admin-1')

    const where = (findManyArgs[0] as { where: { startsAt: { lt: Date }; isActive: boolean } }).where
    expect(where.isActive).toBe(true)
    expect(where.startsAt.lt.toISOString()).toBe('2026-09-01T03:00:00.000Z')
  })
})

describe('materializeRecurrences — validação', () => {
  it('rejeita mês em formato inválido', async () => {
    const { prisma } = makePrisma([aluguel])
    await expect(materializeRecurrences(prisma, '08-2026', 'admin-1')).rejects.toThrow(/YYYY-MM/)
    await expect(materializeRecurrences(prisma, '2026-13', 'admin-1')).rejects.toThrow(/YYYY-MM/)
  })

  it('atravessa a virada de ano sem aritmética errada', async () => {
    const { prisma, created } = makePrisma([{ ...aluguel, dayOfMonth: 5 }])
    await materializeRecurrences(prisma, '2026-12', 'admin-1')

    expect((created[0].competenceDate as Date).toISOString()).toBe('2026-12-01T03:00:00.000Z')
    expect((created[0].dueDate as Date).toISOString()).toBe('2026-12-05T03:00:00.000Z')
  })
})
