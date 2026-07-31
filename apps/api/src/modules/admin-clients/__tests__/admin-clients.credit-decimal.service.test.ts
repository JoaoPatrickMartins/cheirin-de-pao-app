// Onda F — o ADMIN tem de ver o MESMO número que o cliente.
//
// O risco aqui não é a matemática, é o caminho: cada superfície do admin (lista, extrato,
// concessão, remoção) lê o crédito por uma query própria, e qualquer uma que caia no espelho
// legado (`creditBalance` / `quantity`, arredondados por movimento) mostra um número diferente do
// que o cliente vê — foi exatamente o sintoma reportado no teste manual ("cliente gastou 1,4 e o
// admin diz 2"). Estes testes fixam o decimal atravessando cada superfície.
import { vi, describe, it, expect } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { AdminClientsService } from '../admin-clients.service.js'

interface Row {
  id: string
  /** Saldo canônico em milésimos — o único que a aplicação lê. */
  creditMilli: number | null
}

function makeFastify(opts: {
  clients?: Row[]
  txs?: Array<{ id: string; type: string; quantity?: number; quantityMilli: number | null }>
  updated?: { creditMilli: number }
}) {
  const { clients = [], txs = [], updated } = opts
  const prisma = {
    user: {
      findMany: vi.fn().mockImplementation(({ select }: { select?: Record<string, unknown> }) =>
        // A 2ª chamada de `findMany` no extrato busca nomes de admin — devolve vazio.
        Promise.resolve(select && !('creditMilli' in select) ? [] : clients.map((c) => ({
          name: 'Cliente', condominiumId: null, apartment: null, block: null,
          isBlocked: false, createdAt: new Date('2026-01-01'), ...c,
        }))),
      ),
      findUnique: vi.fn().mockResolvedValue({ role: 'CLIENT', ...clients[0], id: 'u1' }),
      count: vi.fn().mockResolvedValue(clients.length),
      // As mutações vão dentro de `$transaction([...])`, então o retorno vem do mock da transação.
      update: vi.fn().mockResolvedValue({}),
    },
    creditTransaction: {
      findMany: vi.fn().mockResolvedValue(
        txs.map((t) => ({ ...t, userId: 'u1', adminId: null, description: null, reason: null, referenceId: null, createdAt: new Date('2026-07-31') })),
      ),
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockResolvedValue([{}, { id: 'u1', name: 'Cliente', ...updated }]),
    notification: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  }
  return { prisma, fastify: { prisma, log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } } as unknown as FastifyInstance }
}

describe('lista de clientes — saldo em pãezinhos decimais', () => {
  it('expõe 43,5 quando o canônico é 43500 (e não o legado 43)', async () => {
    const { fastify } = makeFastify({ clients: [{ id: 'u1', creditMilli: 43500 }] })
    const r = await new AdminClientsService(fastify).list()
    expect(r.items[0].creditBalance).toBe(43.5)
  })

  it('não vaza `creditMilli` no payload — a API fala em pãezinhos', async () => {
    const { fastify } = makeFastify({ clients: [{ id: 'u1', creditMilli: 43500 }] })
    const r = await new AdminClientsService(fastify).list()
    expect(r.items[0]).not.toHaveProperty('creditMilli')
  })

  it('saldo canônico ausente vira 0 — nunca inventa crédito a partir do legado', async () => {
    const { fastify } = makeFastify({ clients: [{ id: 'u1', creditMilli: null }] })
    const r = await new AdminClientsService(fastify).list()
    expect(r.items[0].creditBalance).toBe(0)
  })

  it('filtro "sem crédito" pergunta por MENOS DE UM PÃO, não por saldo zero', async () => {
    // 0,6 🥖 é saldo, mas não entrega pão nenhum: para a operação, o cliente está sem crédito.
    const { fastify, prisma } = makeFastify({ clients: [] })
    await new AdminClientsService(fastify).list({ status: 'no-credits' })
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ creditMilli: { lt: 1000 } }) }),
    )
  })

  it('ordenação por saldo usa o canônico', async () => {
    const { fastify, prisma } = makeFastify({ clients: [] })
    await new AdminClientsService(fastify).list({ sort: 'credits' })
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { creditMilli: 'desc' } }),
    )
  })
})

describe('extrato do cliente no admin — movimentos decimais', () => {
  it('uma Cestinha de 1,5 🥖 aparece como −1,5, não como −2', async () => {
    const { fastify } = makeFastify({
      clients: [{ id: 'u1', creditMilli: 43500 }],
      txs: [{ id: 't1', type: 'MARKET_PURCHASE', quantityMilli: -1500 }],
    })
    const r = await new AdminClientsService(fastify).getCreditHistory('u1')
    expect(r[0].quantity).toBe(-1.5)
  })

  it('linha sem o canônico vira 0 (não reaparece como inteiro do legado)', async () => {
    const { fastify } = makeFastify({
      clients: [{ id: 'u1', creditMilli: 43500 }],
      txs: [{ id: 't1', type: 'PURCHASE', quantity: 30, quantityMilli: null }],
    })
    const r = await new AdminClientsService(fastify).getCreditHistory('u1')
    expect(r[0].quantity).toBe(0)
  })

  it('o extrato fecha com o saldo (soma dos movimentos)', async () => {
    const { fastify } = makeFastify({
      clients: [{ id: 'u1', creditMilli: 43500 }],
      txs: [
        { id: 't1', type: 'PURCHASE', quantityMilli: 45000 },
        { id: 't2', type: 'MARKET_PURCHASE', quantityMilli: -1500 },
      ],
    })
    const service = new AdminClientsService(fastify)
    const extrato = await service.getCreditHistory('u1')
    const soma = extrato.reduce((acc, t) => acc + t.quantity, 0)
    const lista = await service.list()
    // 45 − 1,5 = 43,5 — o mesmo número da lista.
    expect(soma).toBe(43.5)
    expect(soma).toBe(lista.items[0].creditBalance)
  })
})

describe('concessão e remoção manual de crédito', () => {
  it('grantCredits devolve o novo saldo em decimal', async () => {
    const { fastify } = makeFastify({
      clients: [{ id: 'u1', creditMilli: 43500 }],
      updated: { creditMilli: 48500 },
    })
    const r = await new AdminClientsService(fastify).grantCredits('u1', {
      quantity: 5, reason: 'Acerto', adminId: 'admin-1',
    })
    expect(r.creditBalance).toBe(48.5)
  })

  it('removeCredits valida contra o saldo CANÔNICO', async () => {
    // Saldo real 1,5 🥖. Remover 2 tem de ser recusado — o legado (2) liberaria.
    const { fastify } = makeFastify({
      clients: [{ id: 'u1', creditMilli: 1500 }],
      updated: { creditMilli: 0 },
    })
    await expect(
      new AdminClientsService(fastify).removeCredits('u1', { quantity: 2, reason: 'x', adminId: 'a1' }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('removeCredits aceita o que cabe no saldo canônico', async () => {
    const { fastify } = makeFastify({
      clients: [{ id: 'u1', creditMilli: 1500 }],
      updated: { creditMilli: 500 },
    })
    const r = await new AdminClientsService(fastify).removeCredits('u1', {
      quantity: 1, reason: 'x', adminId: 'a1',
    })
    expect(r.creditBalance).toBe(0.5)
  })
})
