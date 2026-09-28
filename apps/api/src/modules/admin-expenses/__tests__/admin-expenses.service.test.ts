// admin-expenses.service — registro e gestão de despesas (Fase 1 do plano-financeiro-vendas).
//
// O que estes testes protegem:
//   1. `status` é DERIVADO de `paidAt` — uma despesa PAID sem data de pagamento sumiria do fluxo
//      de caixa e apareceria no DRE, com dois relatórios discordando do mesmo lançamento.
//   2. Categoria e recorrência com histórico são DESATIVADAS, não apagadas (o DRE de mês fechado
//      perderia a linha).
//   3. Parcela de recorrência é CANCELADA, não apagada (apagar a faria reaparecer no próximo
//      acesso ao mês).
//   4. A importação nunca cria categoria implicitamente e importa o que dá.
//   5. Auditoria guarda o valor anterior só quando ele mudou.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { AdminExpensesService, ExpenseError } from '../admin-expenses.service.js'

const CAT = { id: 'cat-1', name: 'Aluguel', group: 'ADMIN', emoji: '🏠', isFixed: true }

interface Over {
  /** Compras ao fornecedor FINALIZED (B5) — entram em contas a pagar enquanto `paidAt` é nulo. */
  purchaseOrders?: Array<Record<string, unknown>>
  /** Itens das compras, com `supplierId` — é por item que o fornecimento próprio é cortado. */
  purchaseItems?: Array<Record<string, unknown>>
  /** Fornecedores marcados como fornecimento próprio. */
  selfSuppliers?: Array<{ id: string }>
  category?: Record<string, unknown> | null
  categories?: Array<Record<string, unknown>>
  expense?: Record<string, unknown> | null
  expenses?: Array<Record<string, unknown>>
  recurrence?: Record<string, unknown> | null
  expenseCount?: number
  createManyCount?: number
  /** Mês fechado (A1) — quando presente, a trava do lançamento retroativo dispara. */
  closedMonth?: Record<string, unknown> | null
}

function makeFastify(over: Over = {}) {
  const calls = {
    expenseCreate: [] as Array<Record<string, unknown>>,
    expenseUpdate: [] as Array<{ where: unknown; data: Record<string, unknown> }>,
    expenseDelete: [] as unknown[],
    categoryUpdate: [] as Array<{ where: unknown; data: Record<string, unknown> }>,
    categoryDelete: [] as unknown[],
    recurrenceUpdate: [] as Array<{ where: unknown; data: Record<string, unknown> }>,
    recurrenceDelete: [] as unknown[],
    createMany: [] as Array<Record<string, unknown>>,
  }

  const prisma = {
    // Fechamento de mês (A1): por padrão NENHUM mês está fechado, então a trava do lançamento
    // retroativo não interfere nos testes que não são sobre ela.
    financialClose: {
      findUnique: vi.fn().mockResolvedValue(over.closedMonth ?? null),
    },
    // Compras ao fornecedor (B5): por padrão nenhuma em aberto.
    purchaseOrder: {
      findMany: vi.fn().mockResolvedValue(over.purchaseOrders ?? []),
      findUnique: vi.fn().mockResolvedValue((over.purchaseOrders ?? [])[0] ?? null),
      update: vi.fn().mockImplementation((args) => Promise.resolve({ ...args.where, ...args.data })),
    },
    purchaseOrderItem: {
      findMany: vi.fn().mockResolvedValue(over.purchaseItems ?? []),
    },
    expenseCategory: {
      findUnique: vi.fn().mockResolvedValue(over.category === undefined ? CAT : over.category),
      findMany: vi.fn().mockResolvedValue(over.categories ?? [CAT]),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-cat', ...data })),
      update: vi.fn().mockImplementation((args) => {
        calls.categoryUpdate.push(args)
        return Promise.resolve({ id: args.where.id, ...args.data })
      }),
      delete: vi.fn().mockImplementation((args) => {
        calls.categoryDelete.push(args)
        return Promise.resolve({})
      }),
    },
    expense: {
      findUnique: vi.fn().mockResolvedValue(over.expense === undefined ? null : over.expense),
      findMany: vi.fn().mockResolvedValue(over.expenses ?? []),
      count: vi.fn().mockResolvedValue(over.expenseCount ?? 0),
      create: vi.fn().mockImplementation(({ data }) => {
        calls.expenseCreate.push(data)
        return Promise.resolve({ id: 'exp-1', ...data })
      }),
      createMany: vi.fn().mockImplementation(({ data }) => {
        calls.createMany.push(...data)
        return Promise.resolve({ count: over.createManyCount ?? data.length })
      }),
      update: vi.fn().mockImplementation((args) => {
        calls.expenseUpdate.push(args)
        return Promise.resolve({ id: args.where.id, ...args.data })
      }),
      delete: vi.fn().mockImplementation((args) => {
        calls.expenseDelete.push(args)
        return Promise.resolve({})
      }),
    },
    expenseRecurrence: {
      findUnique: vi.fn().mockResolvedValue(over.recurrence === undefined ? null : over.recurrence),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'rec-1', ...data })),
      update: vi.fn().mockImplementation((args) => {
        calls.recurrenceUpdate.push(args)
        return Promise.resolve({ id: args.where.id, ...args.data })
      }),
      delete: vi.fn().mockImplementation((args) => {
        calls.recurrenceDelete.push(args)
        return Promise.resolve({})
      }),
    },
    supplier: {
      findMany: vi.fn().mockImplementation((args: { where?: { isSelfSupply?: boolean } }) =>
        Promise.resolve(args?.where?.isSelfSupply ? (over.selfSuppliers ?? []) : []),
      ),
    },
    condominium: { findMany: vi.fn().mockResolvedValue([]) },
  }

  return {
    service: new AdminExpensesService({
      prisma,
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    } as unknown as FastifyInstance),
    prisma,
    calls,
  }
}

const base = {
  categoryId: 'cat-1',
  description: 'Aluguel de agosto',
  amount: 900,
  competenceDate: '2026-08-01',
}

beforeEach(() => vi.clearAllMocks())

describe('create — status derivado de paidAt', () => {
  it('sem paidAt → PENDING (entra em contas a pagar)', async () => {
    const { service, calls } = makeFastify()
    await service.create(base, 'admin-1')

    expect(calls.expenseCreate[0].status).toBe('PENDING')
    expect(calls.expenseCreate[0].paidAt).toBeNull()
  })

  it('com paidAt → PAID', async () => {
    const { service, calls } = makeFastify()
    await service.create({ ...base, paidAt: '2026-08-10' }, 'admin-1')

    expect(calls.expenseCreate[0].status).toBe('PAID')
    expect((calls.expenseCreate[0].paidAt as Date).toISOString()).toBe('2026-08-10T03:00:00.000Z')
  })

  it('interpreta as datas no calendário BRT, não UTC', async () => {
    // Competência em UTC faria uma despesa de 31/08 23h BRT cair em setembro.
    const { service, calls } = makeFastify()
    await service.create({ ...base, competenceDate: '2026-08-31' }, 'admin-1')

    expect((calls.expenseCreate[0].competenceDate as Date).toISOString()).toBe('2026-08-31T03:00:00.000Z')
  })

  it('arredonda o valor a centavos', async () => {
    const { service, calls } = makeFastify()
    await service.create({ ...base, amount: 900.005 }, 'admin-1')
    expect(calls.expenseCreate[0].amount).toBe(900.01)
  })

  it('rejeita categoria inexistente com 404, não 500', async () => {
    const { service } = makeFastify({ category: null })
    await expect(service.create(base, 'admin-1')).rejects.toMatchObject({
      name: 'ExpenseError',
      statusCode: 404,
    })
  })
})

describe('update — pagamento, cancelamento e auditoria', () => {
  const existing = {
    id: 'exp-1',
    amount: 900,
    paidAt: new Date('2026-08-10T03:00:00Z'),
    status: 'PAID',
    recurrenceId: null,
  }

  it('paidAt: null desmarca o pagamento e volta a PENDING', async () => {
    // Distinguir null de undefined é o que permite desfazer um pagamento registrado por engano
    // sem cancelar a despesa.
    const { service, calls } = makeFastify({ expense: existing })
    await service.update('exp-1', { paidAt: null }, 'admin-2')

    expect(calls.expenseUpdate[0].data.status).toBe('PENDING')
    expect(calls.expenseUpdate[0].data.paidAt).toBeNull()
  })

  it('campo ausente NÃO mexe no pagamento', async () => {
    const { service, calls } = makeFastify({ expense: existing })
    await service.update('exp-1', { description: 'Aluguel · agosto' }, 'admin-2')

    expect('paidAt' in calls.expenseUpdate[0].data).toBe(false)
    expect(calls.expenseUpdate[0].data.status).toBe('PAID')
  })

  it('status CANCELLED vence a derivação de paidAt', async () => {
    const { service, calls } = makeFastify({ expense: existing })
    await service.update('exp-1', { status: 'CANCELLED' }, 'admin-2')
    expect(calls.expenseUpdate[0].data.status).toBe('CANCELLED')
  })

  it('guarda previousAmount quando o valor muda', async () => {
    const { service, calls } = makeFastify({ expense: existing })
    await service.update('exp-1', { amount: 950 }, 'admin-2')

    expect(calls.expenseUpdate[0].data.previousAmount).toBe(900)
    expect(calls.expenseUpdate[0].data.updatedById).toBe('admin-2')
  })

  it('NÃO guarda previousAmount quando o valor não muda', async () => {
    // Registrar em toda edição encheria o campo de ruído e esconderia a alteração que importa.
    const { service, calls } = makeFastify({ expense: existing })
    await service.update('exp-1', { amount: 900, description: 'outro texto' }, 'admin-2')

    expect('previousAmount' in calls.expenseUpdate[0].data).toBe(false)
  })

  it('despesa inexistente → 404', async () => {
    const { service } = makeFastify({ expense: null })
    await expect(service.update('nope', { amount: 10 }, 'admin-1')).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('markPaid', () => {
  it('usa a data informada', async () => {
    const { service, calls } = makeFastify({ expense: { id: 'e1', status: 'PENDING' } })
    await service.markPaid('e1', '2026-08-12', 'admin-1')

    expect((calls.expenseUpdate[0].data.paidAt as Date).toISOString()).toBe('2026-08-12T03:00:00.000Z')
    expect(calls.expenseUpdate[0].data.status).toBe('PAID')
  })

  it('sem data, usa agora', async () => {
    const { service, calls } = makeFastify({ expense: { id: 'e1', status: 'PENDING' } })
    await service.markPaid('e1', undefined, 'admin-1')
    expect(calls.expenseUpdate[0].data.paidAt).toBeInstanceOf(Date)
  })

  it('recusa pagar despesa cancelada', async () => {
    const { service } = makeFastify({ expense: { id: 'e1', status: 'CANCELLED' } })
    await expect(service.markPaid('e1', undefined, 'admin-1')).rejects.toBeInstanceOf(ExpenseError)
  })
})

describe('remove — parcela de recorrência é cancelada, não apagada', () => {
  it('lançamento avulso é apagado', async () => {
    const { service, calls } = makeFastify({ expense: { id: 'e1', recurrenceId: null } })
    const r = await service.remove('e1', 'admin-1')

    expect(r).toEqual({ deleted: true, cancelled: false })
    expect(calls.expenseDelete).toHaveLength(1)
  })

  it('parcela de recorrência é CANCELADA', async () => {
    // Apagar liberaria o índice único (recurrenceId, recurrenceMonth) e a próxima abertura do mês
    // a recriaria — a despesa "excluída" reapareceria.
    const { service, calls } = makeFastify({ expense: { id: 'e1', recurrenceId: 'rec-1' } })
    const r = await service.remove('e1', 'admin-1')

    expect(r).toEqual({ deleted: false, cancelled: true })
    expect(calls.expenseDelete).toHaveLength(0)
    expect(calls.expenseUpdate[0].data.status).toBe('CANCELLED')
  })
})

describe('categorias — soft delete quando há histórico', () => {
  it('sem lançamento, apaga', async () => {
    const { service, calls } = makeFastify({ expenseCount: 0 })
    expect(await service.deleteCategory('cat-1')).toEqual({ deleted: true, deactivated: false })
    expect(calls.categoryDelete).toHaveLength(1)
  })

  it('com lançamento, apenas DESATIVA', async () => {
    // Apagar quebraria o DRE de um mês fechado, que perderia a linha.
    const { service, calls } = makeFastify({ expenseCount: 5 })
    expect(await service.deleteCategory('cat-1')).toEqual({ deleted: false, deactivated: true })

    expect(calls.categoryDelete).toHaveLength(0)
    expect(calls.categoryUpdate[0].data.isActive).toBe(false)
  })

  it('nome duplicado → 409', async () => {
    const { service } = makeFastify()
    await expect(
      service.createCategory({ name: 'Aluguel', group: 'ADMIN', isFixed: true }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('recorrências — soft delete quando já gerou parcela', () => {
  it('sem parcela gerada, apaga', async () => {
    const { service, calls } = makeFastify({ recurrence: { id: 'rec-1' }, expenseCount: 0 })
    expect(await service.removeRecurrence('rec-1')).toEqual({ deleted: true, deactivated: false })
    expect(calls.recurrenceDelete).toHaveLength(1)
  })

  it('com parcela gerada, apenas DESATIVA', async () => {
    const { service, calls } = makeFastify({ recurrence: { id: 'rec-1' }, expenseCount: 3 })
    expect(await service.removeRecurrence('rec-1')).toEqual({ deleted: false, deactivated: true })
    expect(calls.recurrenceUpdate[0].data.isActive).toBe(false)
  })

  it('converte o mês de vigência para o dia 1 BRT', async () => {
    const { service, prisma } = makeFastify()
    await service.createRecurrence({
      categoryId: 'cat-1',
      description: 'Aluguel',
      amount: 900,
      dayOfMonth: 10,
      startsAt: '2026-08',
    })

    const data = (prisma.expenseRecurrence.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data
    expect(data.startsAt.toISOString()).toBe('2026-08-01T03:00:00.000Z')
    expect(data.endsAt).toBeNull()
  })
})

describe('importRows — nunca cria categoria implicitamente', () => {
  const row = {
    categoryName: 'Aluguel',
    description: 'Aluguel de julho',
    amount: 900,
    competenceDate: '2026-07-01',
  }

  it('resolve a categoria por nome, ignorando caixa e espaços', async () => {
    const { service, calls } = makeFastify()
    const r = await service.importRows([{ ...row, categoryName: '  aluguel ' }], 'admin-1')

    expect(r.imported).toBe(1)
    expect(calls.createMany[0].categoryId).toBe('cat-1')
  })

  it('categoria desconhecida vira ERRO de linha, não categoria nova', async () => {
    // Categoria criada por digitação errada numa planilha viraria uma linha do DRE.
    const { service, calls } = makeFastify()
    const r = await service.importRows([{ ...row, categoryName: 'Aluguél' }], 'admin-1')

    expect(r.imported).toBe(0)
    expect(r.errors).toEqual([{ line: 1, message: 'Categoria "Aluguél" não cadastrada' }])
    expect(calls.createMany).toHaveLength(0)
  })

  it('importa o que dá e relata o resto', async () => {
    // Falhar tudo por uma linha obrigaria a recomeçar uma planilha de 200 lançamentos.
    const { service } = makeFastify({ createManyCount: 2 })
    const r = await service.importRows(
      [row, { ...row, categoryName: 'Inexistente' }, { ...row, description: 'Aluguel de junho' }],
      'admin-1',
    )

    expect(r.imported).toBe(2)
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0].line).toBe(2)
  })

  it('deriva o status de cada linha a partir de paidAt', async () => {
    const { service, calls } = makeFastify()
    await service.importRows([row, { ...row, paidAt: '2026-07-10' }], 'admin-1')

    expect(calls.createMany[0].status).toBe('PENDING')
    expect(calls.createMany[1].status).toBe('PAID')
  })
})

describe('list — filtro por grupo', () => {
  it('grupo sem categoria nenhuma devolve vazio, não a lista inteira', async () => {
    // Ignorar o filtro faria a tela mostrar TODAS as despesas — o oposto do que o admin pediu.
    const { service, prisma } = makeFastify({ categories: [] })
    const r = await service.list({ group: 'TAXES' }, 'admin-1')

    expect(r).toEqual([])
    expect(prisma.expense.findMany).not.toHaveBeenCalled()
  })

  it('decora a linha com categoria, grupo e se é fixa', async () => {
    const { service } = makeFastify({
      expenses: [
        { id: 'e1', categoryId: 'cat-1', amount: 900, supplierId: null, condominiumId: null },
      ],
    })
    const r = await service.list({}, 'admin-1')

    expect(r[0]).toMatchObject({
      categoryName: 'Aluguel',
      categoryGroup: 'ADMIN',
      categoryIsFixed: true,
    })
  })
})

describe('listPayable — atraso por dia BRT', () => {
  it('conta que vence hoje NÃO está atrasada', async () => {
    // Comparar por instante marcaria como atrasada uma conta que vence hoje às 23h.
    const today = new Date()
    const { service } = makeFastify({
      expenses: [
        { id: 'e1', categoryId: 'cat-1', amount: 100, dueDate: today, supplierId: null, condominiumId: null },
      ],
    })

    const r = await service.listPayable()
    expect(r[0].isOverdue).toBe(false)
  })

  it('conta de ontem está atrasada', async () => {
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000)
    const { service } = makeFastify({
      expenses: [
        { id: 'e1', categoryId: 'cat-1', amount: 100, dueDate: yesterday, supplierId: null, condominiumId: null },
      ],
    })

    expect((await service.listPayable())[0].isOverdue).toBe(true)
  })

  it('exige dueDate presente — sem vencimento não há atraso a apurar', async () => {
    const { service, prisma } = makeFastify()
    await service.listPayable()

    const where = (prisma.expense.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where
    expect(where.dueDate.not).toBeNull()
    expect(where.status).toBe('PENDING')
  })
})

// ── Trava do lançamento retroativo (A1) ──────────────────────────────────────
// Sem ela o fechamento seria decorativo: o DRE congelado continuaria certo, mas a lista de despesas
// mostraria um mês diferente daquele que foi ao contador — e aí nenhum dos dois números presta.
describe('mês fechado trava o lançamento (A1)', () => {
  const CLOSED = { id: 'fc1', month: '2026-08' }

  it('recusa CRIAR despesa com competência num mês fechado', async () => {
    const { service } = makeFastify({ closedMonth: CLOSED })
    await expect(
      service.create(
        { categoryId: 'cat-1', description: 'x', amount: 10, competenceDate: '2026-08-15' } as never,
        'admin-1',
      ),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('recusa EDITAR despesa que está num mês fechado', async () => {
    const { service } = makeFastify({
      closedMonth: CLOSED,
      expense: { id: 'e1', status: 'PENDING', amount: 10, competenceDate: new Date('2026-08-15T03:00:00Z') },
    })
    await expect(service.update('e1', { amount: 20 } as never, 'admin-1')).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('recusa EXCLUIR despesa de um mês fechado', async () => {
    const { service } = makeFastify({
      closedMonth: CLOSED,
      expense: { id: 'e1', status: 'PENDING', amount: 10, competenceDate: new Date('2026-08-15T03:00:00Z') },
    })
    await expect(service.remove('e1', 'admin-1')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('NÃO materializa recorrência ao abrir um mês fechado', async () => {
    // Visualizar não pode criar lançamento: a lista passaria a divergir do DRE congelado pelo
    // simples ato de abrir a tela.
    const { service, prisma } = makeFastify({ closedMonth: CLOSED })
    await service.list({ month: '2026-08' }, 'admin-1')
    expect(prisma.expense.createMany).not.toHaveBeenCalled()
  })

  it('deixa passar normalmente quando o mês está ABERTO', async () => {
    const { service, calls } = makeFastify({ closedMonth: null })
    await service.create(
      { categoryId: 'cat-1', description: 'x', amount: 10, competenceDate: '2026-09-15' } as never,
      'admin-1',
    )
    expect(calls.expenseCreate).toHaveLength(1)
  })
})

// ── B5 · compra ao fornecedor em contas a pagar ──────────────────────────────
// A compra NÃO vira `Expense`: criar um espelho faria o DRE e o caixa contarem o mesmo gasto duas
// vezes. Ela só aparece na lista enquanto `paidAt` está vazio, com `sourceKind` dizendo ao front
// qual endpoint chamar.
describe('contas a pagar inclui compra ao fornecedor (B5)', () => {
  const po = (o: Record<string, unknown> = {}) => ({
    id: 'po1',
    date: new Date('2026-08-20T15:00:00Z'),
    totalValue: 450,
    paidAt: null,
    slotLabel: 'Manhã',
    ...o,
  })

  it('lista a compra finalizada e não paga', async () => {
    const { service } = makeFastify({ purchaseOrders: [po()] })
    const rows = await service.listPayable(60)

    const compra = rows.find((r) => r.sourceKind === 'PURCHASE')
    expect(compra).toBeDefined()
    expect(compra!.amount).toBe(450)
    expect(compra!.categoryName).toBe('Compra ao fornecedor')
    expect(compra!.description).toContain('Manhã')
  })

  it('NÃO lista compra já paga', async () => {
    const { service } = makeFastify({
      purchaseOrders: [po({ paidAt: new Date('2026-08-25T15:00:00Z') })],
    })
    const rows = await service.listPayable(60)
    expect(rows.filter((r) => r.sourceKind === 'PURCHASE')).toEqual([])
  })

  it('nunca filtra `paidAt: null` no Mongo — resolve em código', async () => {
    // Pedido anterior ao campo não tem a chave e não seria encontrado por esse filtro.
    const { service, prisma } = makeFastify({ purchaseOrders: [po()] })
    await service.listPayable(60)
    const where = prisma.purchaseOrder.findMany.mock.calls[0][0].where
    expect(where).not.toHaveProperty('paidAt')
    expect(where.status).toBe('FINALIZED')
  })

  it('marca a compra como paga', async () => {
    const { service, prisma } = makeFastify({
      purchaseOrders: [po({ status: 'FINALIZED' })],
    })
    await service.markPurchasePaid('po1', '2026-08-25')
    expect(prisma.purchaseOrder.update).toHaveBeenCalled()
    const data = prisma.purchaseOrder.update.mock.calls[0][0].data
    expect((data.paidAt as Date).toISOString()).toBe('2026-08-25T03:00:00.000Z')
  })

  it('recusa pagar compra que não está finalizada', async () => {
    const { service } = makeFastify({ purchaseOrders: [po({ status: 'DRAFT' })] })
    await expect(service.markPurchasePaid('po1')).rejects.toMatchObject({ statusCode: 409 })
  })
})

// ── Fornecimento próprio não vira conta a pagar ──────────────────────────────
// O fornecedor marcado `isSelfSupply` é a própria casa: não há a quem pagar, e o custo real já
// entra pelas DESPESAS. Sem o corte, cada lote diário de produção própria virava uma "conta" de
// centavos que escondia a conta de verdade.
//
// O corte é por ITEM porque o rateio da matriz põe fornecedores diferentes no MESMO pedido.
describe('fornecimento próprio fora do contas a pagar', () => {
  const order = (o: Record<string, unknown> = {}) => ({
    id: 'po1',
    date: new Date('2026-08-20T15:00:00Z'),
    totalValue: 100,
    paidAt: null,
    slotLabel: 'Manhã',
    ...o,
  })
  const item = (supplierId: string, quantity: number, unitPrice: number, purchaseOrderId = 'po1') => ({
    purchaseOrderId,
    supplierId,
    quantity,
    unitPrice,
  })

  it('some com a compra 100% de fornecimento próprio', async () => {
    const { service } = makeFastify({
      purchaseOrders: [order()],
      purchaseItems: [item('casa', 10, 0.45)],
      selfSuppliers: [{ id: 'casa' }],
    })
    const rows = await service.listPayable(60)
    expect(rows.filter((r) => r.sourceKind === 'PURCHASE')).toEqual([])
  })

  it('mantém a compra de terceiro com o valor cheio', async () => {
    const { service } = makeFastify({
      purchaseOrders: [order()],
      purchaseItems: [item('terceiro', 10, 2)],
      selfSuppliers: [{ id: 'casa' }],
    })
    const compra = (await service.listPayable(60)).find((r) => r.sourceKind === 'PURCHASE')
    expect(compra?.amount).toBe(20)
  })

  it('numa compra MISTA cobra só a parte de terceiro', async () => {
    // É o caso do rateio 75/25: os dois fornecedores no mesmo pedido.
    const { service } = makeFastify({
      purchaseOrders: [order({ totalValue: 100 })],
      purchaseItems: [item('casa', 30, 1), item('terceiro', 10, 2)],
      selfSuppliers: [{ id: 'casa' }],
    })
    const compra = (await service.listPayable(60)).find((r) => r.sourceKind === 'PURCHASE')
    // 30×1 da casa fica de fora; sobram os 10×2 de terceiro. O `totalValue` cheio (100) NÃO vale.
    expect(compra?.amount).toBe(20)
  })

  it('sem fornecimento próprio cadastrado, usa o `totalValue` e nem busca os itens', async () => {
    // Caminho barato preservado: um campo por pedido em vez de varrer itens.
    const { service, prisma } = makeFastify({
      purchaseOrders: [order({ totalValue: 77 })],
      selfSuppliers: [],
    })
    const compra = (await service.listPayable(60)).find((r) => r.sourceKind === 'PURCHASE')
    expect(compra?.amount).toBe(77)
    expect(prisma.purchaseOrderItem.findMany).not.toHaveBeenCalled()
  })

  it('havendo fornecimento próprio, o `totalValue` deixa de ser usado', async () => {
    // Ele é o valor CHEIO do pedido; o que se deve é só a fatia de terceiro.
    const { service, prisma } = makeFastify({
      purchaseOrders: [order({ totalValue: 999 })],
      purchaseItems: [item('terceiro', 1, 5)],
      selfSuppliers: [{ id: 'casa' }],
    })
    const compra = (await service.listPayable(60)).find((r) => r.sourceKind === 'PURCHASE')
    expect(compra?.amount).toBe(5)
    expect(prisma.purchaseOrderItem.findMany).toHaveBeenCalled()
  })

  it('despesas normais continuam na lista', async () => {
    const { service } = makeFastify({
      expenses: [],
      purchaseOrders: [order()],
      purchaseItems: [item('casa', 10, 0.45)],
      selfSuppliers: [{ id: 'casa' }],
    })
    // Nenhuma compra sobrou, e a lista não quebra por isso.
    expect(await service.listPayable(60)).toEqual([])
  })
})
