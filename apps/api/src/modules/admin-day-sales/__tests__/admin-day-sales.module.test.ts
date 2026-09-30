// admin-day-sales.module.test.ts — borda HTTP do relatório de itens vendidos do dia.
//
// A agregação tem teste próprio (`lib/__tests__/day-sales.test.ts`). Aqui só o que é da borda:
// quem pode chamar, o que acontece com uma data inválida, e se os documentos saem de verdade —
// PDF e Excel quebram em runtime (fonte, buffer), não em compilação.

import { describe, it, expect, vi } from 'vitest'
import { AdminDaySalesController } from '../admin-day-sales.controller.js'
import { AdminDaySalesService } from '../admin-day-sales.service.js'

function makeFastifyMock(
  opts: { orders?: Record<string, unknown>[]; marketOrders?: Record<string, unknown>[] } = {},
) {
  const { orders = [], marketOrders = [] } = opts
  const prisma = {
    order: { findMany: vi.fn().mockResolvedValue(orders) },
    marketOrder: { findMany: vi.fn().mockResolvedValue(marketOrders) },
    setting: {
      findUnique: vi.fn(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key === 'avulsoUnit' ? { key: 'avulsoUnit', value: '1.20' } : null),
      ),
    },
    product: { findUnique: vi.fn().mockResolvedValue(null) },
  }
  return {
    prisma,
    log: { error: vi.fn() },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function makeReply() {
  const reply = {
    statusCode: 0,
    payload: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      reply.statusCode = code
      return reply
    },
    header(key: string, value: string) {
      reply.headers[key] = value
      return reply
    },
    send(payload: unknown) {
      reply.payload = payload
      return reply
    },
  }
  return reply
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asRequest = (role: string | undefined, query: Record<string, unknown> = {}): any => ({
  user: role ? { role } : undefined,
  query,
})

const SALE_DAY = {
  orders: [{ userId: 'u1', quantity: 10, type: 'SINGLE', slotId: 'manha', condominiumId: 'c1' }],
  marketOrders: [
    {
      userId: 'u2',
      condominiumId: 'c1',
      slotId: 'manha',
      breadQty: 2,
      moneyAmount: 18,
      creditsAppliedMilli: 0,
      items: [{ productId: 'p1', name: 'Bolo de Fubá', qty: 2, unitPrice: 9 }],
    },
  ],
}

describe('AdminDaySalesController', () => {
  it('nega acesso a quem não é ADMIN, nas três rotas', async () => {
    const ctrl = new AdminDaySalesController(makeFastifyMock())

    for (const handler of ['getReport', 'getPdf', 'getExcel'] as const) {
      const reply = makeReply()
      await ctrl[handler](asRequest('CLIENT'), reply as never)
      expect(reply.statusCode).toBe(403)
      expect(reply.payload).toEqual({ error: 'Acesso negado: apenas administradores' })
    }
  })

  it('nega acesso a requisição sem usuário', async () => {
    const ctrl = new AdminDaySalesController(makeFastifyMock())
    const reply = makeReply()

    await ctrl.getReport(asRequest(undefined), reply as never)

    expect(reply.statusCode).toBe(403)
  })

  it('devolve o relatório do dia pedido', async () => {
    const ctrl = new AdminDaySalesController(makeFastifyMock(SALE_DAY))
    const reply = makeReply()

    await ctrl.getReport(asRequest('ADMIN', { date: '2026-07-29' }), reply as never)

    expect(reply.statusCode).toBe(200)
    expect(reply.payload).toMatchObject({
      date: '2026-07-29',
      breads: { total: 12 },
      items: { total: 2 },
      totalRevenue: 32.4, // 12 × 1,20 + 18
    })
  })

  it('data malformada é erro do cliente (400), não 500 nem dia errado', async () => {
    const ctrl = new AdminDaySalesController(makeFastifyMock())
    const reply = makeReply()

    await ctrl.getReport(asRequest('ADMIN', { date: '29/07/2026' }), reply as never)

    expect(reply.statusCode).toBe(400)
    expect(reply.payload).toEqual({ error: 'date deve estar no formato YYYY-MM-DD' })
  })

  it('sem date, apura hoje (BRT) em vez de falhar', async () => {
    const ctrl = new AdminDaySalesController(makeFastifyMock())
    const reply = makeReply()

    await ctrl.getReport(asRequest('ADMIN'), reply as never)

    expect(reply.statusCode).toBe(200)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
    expect((reply.payload as { date: string }).date).toBe(today)
  })

  it('PDF sai como anexo com Content-Type e nome de arquivo do dia', async () => {
    const ctrl = new AdminDaySalesController(makeFastifyMock(SALE_DAY))
    const reply = makeReply()

    await ctrl.getPdf(asRequest('ADMIN', { date: '2026-07-29' }), reply as never)

    expect(reply.headers['Content-Type']).toBe('application/pdf')
    expect(reply.headers['Content-Disposition']).toBe('attachment; filename="vendas-2026-07-29.pdf"')
    expect(Buffer.isBuffer(reply.payload)).toBe(true)
    expect((reply.payload as Buffer).length).toBeGreaterThan(100)
  })

  it('Excel sai como anexo .xlsx com buffer válido', async () => {
    const ctrl = new AdminDaySalesController(makeFastifyMock(SALE_DAY))
    const reply = makeReply()

    await ctrl.getExcel(asRequest('ADMIN', { date: '2026-07-29' }), reply as never)

    expect(reply.headers['Content-Type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(reply.headers['Content-Disposition']).toBe('attachment; filename="vendas-2026-07-29.xlsx"')
    expect((reply.payload as Buffer).length).toBeGreaterThan(100)
  })

  it('dia sem venda nenhuma ainda gera os documentos (relatório vazio, não erro)', async () => {
    const ctrl = new AdminDaySalesController(makeFastifyMock())
    const pdfReply = makeReply()
    const xlsxReply = makeReply()

    await ctrl.getPdf(asRequest('ADMIN', { date: '2026-07-29' }), pdfReply as never)
    await ctrl.getExcel(asRequest('ADMIN', { date: '2026-07-29' }), xlsxReply as never)

    expect((pdfReply.payload as Buffer).length).toBeGreaterThan(100)
    expect((xlsxReply.payload as Buffer).length).toBeGreaterThan(100)
  })
})

describe('AdminDaySalesService', () => {
  it('propaga 400 com statusCode para o controller distinguir do erro interno', async () => {
    const service = new AdminDaySalesService(makeFastifyMock())

    await expect(service.getReport('2026-13-99x')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('aceita data vazia como "hoje" (querystring ausente vira string vazia no Fastify)', async () => {
    const service = new AdminDaySalesService(makeFastifyMock())

    await expect(service.getReport('')).resolves.toMatchObject({ breads: { total: 0 } })
  })
})
