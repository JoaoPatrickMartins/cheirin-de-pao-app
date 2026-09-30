// customers.service.test.ts — Top clientes, LTV e novos × recorrentes (V7/V8 da Fase 6).
//
// Trava as decisões que o serviço toma e que não se veem no payload:
//   - o ranking é por receita DO PERÍODO, mas o LTV é DESDE SEMPRE — duas réguas diferentes na
//     mesma linha, e é a diferença entre elas que responde "esse campeão do mês é fiel?";
//   - o LTV é buscado só para o topo, não para a base inteira;
//   - "novo" é por CADASTRO na janela;
//   - concentração nos 5/10 maiores — o risco de depender de poucos;
//   - cliente apagado NÃO some do ranking, senão a soma do topo não bate com o total.
import { describe, it, expect, vi } from 'vitest'

import { CustomersService } from '../customers.service.js'
import { rangeWindow, monthWindow } from '../../../lib/date-range.js'

const WIN = () => rangeWindow('2026-07-01', '2026-07-31', new Date('2026-08-05T12:00:00Z'))

function makePrisma(
  opts: {
    /** Receita por cliente no período. */
    groups?: Array<{ userId: string; _sum: { amount: number }; _count: number }>
    /** Receita acumulada (LTV) por cliente. */
    ltv?: Array<{ userId: string; _sum: { amount: number } }>
    users?: Array<{ id: string; name: string; createdAt: Date; condominiumId: string | null }>
    /** Ids que se cadastraram DENTRO da janela. */
    newIds?: string[]
    condos?: Array<{ id: string; name: string }>
  } = {},
) {
  const { groups = [], ltv = [], users = [], newIds = [], condos = [] } = opts
  const groupBy = vi.fn().mockImplementation((args: { where?: Record<string, unknown> }) => {
    // A consulta do LTV é a que filtra por lista de ids SEM janela de data.
    const hasWindow = (args.where as { createdAt?: unknown })?.createdAt != null
    return Promise.resolve(hasWindow ? groups : ltv)
  })
  const userFindMany = vi.fn().mockImplementation((args: { where?: Record<string, unknown> }) => {
    const w = args.where as { createdAt?: unknown }
    // A consulta dos "novos" é a que tem janela de `createdAt`.
    if (w?.createdAt != null) return Promise.resolve(newIds.map((id) => ({ id })))
    return Promise.resolve(users)
  })
  return {
    payment: { groupBy },
    user: { findMany: userFindMany },
    condominium: { findMany: vi.fn().mockResolvedValue(condos) },
    __groupBy: groupBy,
    __userFindMany: userFindMany,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeService = (prisma: unknown) => new CustomersService({ prisma } as any)

const user = (id: string, name: string, condominiumId: string | null = null) => ({
  id,
  name,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  condominiumId,
})

describe('CustomersService.getCustomersReport', () => {
  it('devolve o relatório vazio, sem consultar nada além do agrupamento, quando não houve compra', async () => {
    const prisma = makePrisma()
    const r = await makeService(prisma).getCustomersReport(WIN())

    expect(r.buyers).toBe(0)
    expect(r.revenue).toBe(0)
    expect(r.top).toEqual([])
    expect(r.concentration).toEqual({ top5: 0, top10: 0 })
    // Sem comprador não há topo para enriquecer — não vale ir buscar usuário nenhum.
    expect(prisma.__userFindMany).not.toHaveBeenCalled()
  })

  it('ordena por receita do período e traz o LTV ao lado', async () => {
    const r = await makeService(
      makePrisma({
        groups: [
          { userId: 'u1', _sum: { amount: 100 }, _count: 2 },
          { userId: 'u2', _sum: { amount: 300 }, _count: 3 },
        ],
        // u1 compra pouco no mês mas é cliente antigo; u2 fez uma compra grande e é só isso.
        ltv: [
          { userId: 'u1', _sum: { amount: 5000 } },
          { userId: 'u2', _sum: { amount: 300 } },
        ],
        users: [user('u1', 'Ana'), user('u2', 'Bruno')],
      }),
    ).getCustomersReport(WIN())

    expect(r.top.map((c) => c.name)).toEqual(['Bruno', 'Ana'])
    expect(r.top[0]).toMatchObject({ revenue: 300, orders: 3, avgTicket: 100, ltv: 300 })
    // A leitura que o relatório existe para permitir: o 2º do mês vale 5.000 na vida.
    expect(r.top[1]).toMatchObject({ revenue: 100, ltv: 5000 })
  })

  it('busca o LTV só para o topo, não para a base inteira', async () => {
    const prisma = makePrisma({
      groups: Array.from({ length: 40 }, (_, i) => ({
        userId: `u${i}`,
        _sum: { amount: 100 - i },
        _count: 1,
      })),
      users: [],
    })
    const r = await makeService(prisma).getCustomersReport(WIN())

    expect(r.buyers).toBe(40)
    expect(r.top).toHaveLength(25)
    const ltvCall = prisma.__groupBy.mock.calls.find(
      (c: [{ where?: { userId?: unknown } }]) => c[0].where?.userId != null,
    )
    expect((ltvCall[0].where.userId as { in: string[] }).in).toHaveLength(25)
  })

  it('separa novos de base pelo CADASTRO dentro da janela', async () => {
    const r = await makeService(
      makePrisma({
        groups: [
          { userId: 'novo', _sum: { amount: 200 }, _count: 1 },
          { userId: 'antigo', _sum: { amount: 800 }, _count: 4 },
        ],
        newIds: ['novo'],
        users: [user('novo', 'Novo'), user('antigo', 'Antigo')],
      }),
    ).getCustomersReport(WIN())

    expect(r.newCustomers).toMatchObject({ clients: 1, revenue: 200, share: 0.2 })
    expect(r.returning).toMatchObject({ clients: 1, revenue: 800, share: 0.8 })
    // As duas fatias fecham em 100%: todo comprador é novo ou é base.
    expect(r.newCustomers.share + r.returning.share).toBeCloseTo(1, 4)
    expect(r.top.find((c) => c.userId === 'novo')!.isNew).toBe(true)
    expect(r.top.find((c) => c.userId === 'antigo')!.isNew).toBe(false)
  })

  it('mede a concentração nos 5 e nos 10 maiores', async () => {
    // 1 cliente de 500 + 10 de 50 = 1000. Top5 = 500+50*4 = 700.
    const r = await makeService(
      makePrisma({
        groups: [
          { userId: 'big', _sum: { amount: 500 }, _count: 1 },
          ...Array.from({ length: 10 }, (_, i) => ({
            userId: `s${i}`,
            _sum: { amount: 50 },
            _count: 1,
          })),
        ],
        users: [],
      }),
    ).getCustomersReport(WIN())

    expect(r.revenue).toBe(1000)
    expect(r.concentration.top5).toBeCloseTo(0.7, 4)
    expect(r.concentration.top10).toBeCloseTo(0.95, 4)
  })

  it('não deixa a concentração passar de 100% quando há menos clientes que o corte', async () => {
    const r = await makeService(
      makePrisma({ groups: [{ userId: 'u1', _sum: { amount: 10 }, _count: 1 }], users: [] }),
    ).getCustomersReport(WIN())
    expect(r.concentration.top5).toBe(1)
    expect(r.concentration.top10).toBe(1)
  })

  it('mantém no ranking o cliente que foi apagado', async () => {
    const r = await makeService(
      makePrisma({ groups: [{ userId: 'fantasma', _sum: { amount: 90 }, _count: 1 }], users: [] }),
    ).getCustomersReport(WIN())

    expect(r.top[0].name).toBe('Cliente removido')
    expect(r.top[0].revenue).toBe(90)
    // A soma do topo continua batendo com o total do período.
    expect(r.top.reduce((s, c) => s + c.revenue, 0)).toBe(r.revenue)
  })

  it('resolve o nome do condomínio do cliente', async () => {
    const r = await makeService(
      makePrisma({
        groups: [{ userId: 'u1', _sum: { amount: 10 }, _count: 1 }],
        users: [user('u1', 'Ana', 'c1')],
        condos: [{ id: 'c1', name: 'Residencial Alfa' }],
      }),
    ).getCustomersReport(WIN())
    expect(r.top[0].condominiumName).toBe('Residencial Alfa')
  })

  it('devolve condomínio nulo — não uma string vazia — para cliente sem condomínio', async () => {
    const r = await makeService(
      makePrisma({
        groups: [{ userId: 'u1', _sum: { amount: 10 }, _count: 1 }],
        users: [user('u1', 'Ana', null)],
      }),
    ).getCustomersReport(WIN())
    expect(r.top[0].condominiumName).toBeNull()
  })

  it('declara a definição de "novo" nas ressalvas', async () => {
    const r = await makeService(makePrisma()).getCustomersReport(WIN())
    expect(r.caveats.join(' ')).toMatch(/CADASTROU/)
  })

  it('põe "período em curso" em primeiro lugar quando a janela não fechou', async () => {
    const r = await makeService(makePrisma()).getCustomersReport(
      monthWindow('2026-08', new Date('2026-08-10T12:00:00Z')),
    )
    expect(r.caveats[0]).toMatch(/EM CURSO/)
  })
})
