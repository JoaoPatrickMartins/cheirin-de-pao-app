// bread-demand.test.ts — fonte única da demanda de pão (Onda A da integração da Cestinha).
//
// Fixa as duas decisões que definem a assinatura desta lib:
//   D-1 — pão ≠ item: `MarketOrder.breadQty` soma nos contadores de pão; `items[]` fica na
//         métrica paralela. Nunca somar os dois num contador só.
//   D-5 — a parada é a unidade: pão + Cestinha do mesmo cliente/turno = UMA linha (uma visita),
//         com os pães somados.
import { describe, it, expect, vi } from 'vitest'
import { buildBreadDemand } from '../bread-demand.js'

const DAY = new Date('2026-07-29T15:00:00.000Z') // meio-dia BRT de 29/07/2026

/** Mock mínimo do Prisma com as três fontes que a lib consulta. */
function makePrisma(opts: {
  orders?: Record<string, unknown>[]
  marketOrders?: Record<string, unknown>[]
  schedules?: Record<string, unknown>[]
} = {}) {
  const { orders = [], marketOrders = [], schedules = [] } = opts
  return {
    order: { findMany: vi.fn().mockResolvedValue(orders) },
    marketOrder: { findMany: vi.fn().mockResolvedValue(marketOrders) },
    // projectScheduleDetailForDate consulta schedule.findMany e order.findMany (materializados).
    schedule: { findMany: vi.fn().mockResolvedValue(schedules) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('buildBreadDemand', () => {
  it('sem Cestinha, o resultado é o comportamento histórico (só pedidos de pão)', async () => {
    const prisma = makePrisma({
      orders: [
        { userId: 'u1', quantity: 4, type: 'SINGLE', condominiumId: 'c1' },
        { userId: 'u2', quantity: 6, type: 'SCHEDULED', condominiumId: 'c1' },
      ],
    })
    const stops = await buildBreadDemand(prisma, 'manha', DAY)

    expect(stops).toHaveLength(2)
    expect(stops.reduce((s, x) => s + x.breadConfirmed, 0)).toBe(10)
    expect(stops.every((s) => s.marketItemCount === 0)).toBe(true)
    expect(stops.every((s) => s.origin === 'bread')).toBe(true)
  })

  it('D-1: breadQty da Cestinha entra em breadConfirmed (é pão) e os itens ficam em paralelo', async () => {
    const prisma = makePrisma({
      marketOrders: [
        {
          id: 'mo1',
          userId: 'u1',
          condominiumId: 'c1',
          breadQty: 4,
          items: [{ name: 'Bolo de Fubá', qty: 2 }],
        },
      ],
    })
    const [stop] = await buildBreadDemand(prisma, 'manha', DAY)

    // O pão da Cestinha é pão — antes desta lib ele era cobrado e nunca pedido ao fornecedor.
    expect(stop.breadConfirmed).toBe(4)
    expect(stop.breadFromMarket).toBe(4)
    // ...e os produtos NÃO viram pão.
    expect(stop.marketItemCount).toBe(2)
    expect(stop.marketItems).toEqual([{ name: 'Bolo de Fubá', qty: 2 }])
    expect(stop.origin).toBe('market')
    expect(stop.hasConfirmed).toBe(true)
  })

  it('D-5: pão + Cestinha do mesmo cliente/turno = UMA parada, com os pães somados', async () => {
    const prisma = makePrisma({
      orders: [{ userId: 'u1', quantity: 4, type: 'SINGLE', condominiumId: 'c1' }],
      marketOrders: [
        { id: 'mo1', userId: 'u1', condominiumId: 'c1', breadQty: 3, items: [{ name: 'Geleia', qty: 1 }] },
      ],
    })
    const stops = await buildBreadDemand(prisma, 'manha', DAY)

    expect(stops).toHaveLength(1) // uma visita, não duas
    expect(stops[0].breadConfirmed).toBe(7) // 4 + 3
    expect(stops[0].breadSingle).toBe(4)
    expect(stops[0].breadFromMarket).toBe(3)
    expect(stops[0].marketItemCount).toBe(1)
    expect(stops[0].origin).toBe('both')
  })

  it('agrega VÁRIAS Cestinhas do mesmo cliente no mesmo turno numa parada só', async () => {
    // Caso real: o cliente fecha 4 Cestinhas para o mesmo dia/turno.
    const prisma = makePrisma({
      marketOrders: [
        { id: 'mo1', userId: 'u1', condominiumId: 'c1', breadQty: 4, items: [{ name: 'Bolo', qty: 2 }] },
        { id: 'mo2', userId: 'u1', condominiumId: 'c1', breadQty: 4, items: [{ name: 'Bolo', qty: 1 }] },
      ],
    })
    const stops = await buildBreadDemand(prisma, 'manha', DAY)

    expect(stops).toHaveLength(1)
    expect(stops[0].breadConfirmed).toBe(8)
    expect(stops[0].marketItemCount).toBe(3)
    expect(stops[0].marketOrderIds).toEqual(['mo1', 'mo2'])
  })

  it('Cestinha só de produtos (0 pães) ainda é uma parada confirmada', async () => {
    const prisma = makePrisma({
      marketOrders: [
        { id: 'mo1', userId: 'u1', condominiumId: 'c1', breadQty: 0, items: [{ name: 'Café', qty: 1 }] },
      ],
    })
    const [stop] = await buildBreadDemand(prisma, 'manha', DAY)

    expect(stop.breadConfirmed).toBe(0)
    // Sem isto o turno não apareceria em lugar nenhum e a entrega nunca aconteceria.
    expect(stop.hasConfirmed).toBe(true)
    expect(stop.marketItemCount).toBe(1)
  })

  it('filtra por turno: Cestinha de outro turno não entra', async () => {
    const prisma = makePrisma({
      marketOrders: [{ id: 'mo1', userId: 'u1', condominiumId: 'c1', breadQty: 4, items: [] }],
    })
    await buildBreadDemand(prisma, 'tarde', DAY)

    expect(prisma.marketOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ slotId: 'tarde' }) }),
    )
  })

  it('não conta Cestinha em PENDING_PAYMENT nem CANCELLED (pode morrer no sweep)', async () => {
    const prisma = makePrisma()
    await buildBreadDemand(prisma, 'manha', DAY)

    const where = prisma.marketOrder.findMany.mock.calls[0][0].where
    expect(where.status.in).not.toContain('PENDING_PAYMENT')
    expect(where.status.in).not.toContain('CANCELLED')
    expect(where.status.in).toContain('SCHEDULED')
  })

  it('restringe ao condomínio quando informado (tela de detalhe)', async () => {
    const prisma = makePrisma()
    await buildBreadDemand(prisma, 'manha', DAY, { condominiumId: 'c9' })

    expect(prisma.marketOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ condominiumId: 'c9' }) }),
    )
  })

  it('mantém previsto e confirmado separados — só o confirmado vira compra', async () => {
    const prisma = makePrisma({
      // Agenda prevê 5 pães na quarta para u1; nada materializado ainda.
      schedules: [{ userId: 'u1', condominiumId: 'c1', days: { manha: { qua: 5 } } }],
      marketOrders: [{ id: 'mo1', userId: 'u1', condominiumId: 'c1', breadQty: 2, items: [] }],
    })
    const [stop] = await buildBreadDemand(prisma, 'manha', DAY)

    // Uma parada (mesmo cliente/turno), mas os baldes não se misturam: pedir ao fornecedor
    // o previsto seria comprar pão que talvez nunca seja vendido.
    expect(stop.breadConfirmed).toBe(2)
    expect(stop.breadProjected).toBe(5)
    expect(stop.origin).toBe('both')
  })
})
