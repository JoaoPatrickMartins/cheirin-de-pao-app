// DaySalesSheet — o relatório de itens vendidos do dia, geral (não por condomínio).
//
// O sheet não recalcula nada: ele espelha `GET /admin/day-sales`. Os testes cobrem o que é dele —
// o que a tela mostra para cada resposta do backend, e o estado vazio, que é o caso de um dia
// ainda sem venda (o mais comum quando o admin abre um dia futuro).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { DaySalesSheet, type DaySales } from '../DaySalesSheet'

const mockApiFetch = vi.fn()
vi.mock('../../../lib/apiFetch', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}))

const report = (over: Partial<DaySales> = {}): DaySales => ({
  date: '2026-06-28',
  generatedAt: '2026-06-28T17:32:00.000Z', // 14:32 BRT
  breads: { total: 120, single: 40, scheduled: 68, fromMarket: 12, fromItems: 0, unitPrice: 1.2, revenue: 144 },
  items: { total: 16, revenue: 179.2 },
  totalRevenue: 323.2,
  cash: { money: 88.4, creditsMilli: 96000 },
  counts: { stops: 54, clients: 52, condominiums: 4, breadOrders: 48, marketOrders: 9 },
  slots: [
    { slotId: 'manha', label: 'Manhã', breads: 80, items: 11, revenue: 220 },
    { slotId: 'tarde', label: 'Tarde', breads: 40, items: 5, revenue: 103.2 },
  ],
  lines: [
    {
      productId: 'bread',
      name: 'Pão Francês',
      isBread: true,
      qty: 120,
      revenue: 144,
      avgUnitPrice: 1.2,
      bySlot: [
        { slotId: 'manha', label: 'Manhã', qty: 80 },
        { slotId: 'tarde', label: 'Tarde', qty: 40 },
      ],
    },
    {
      productId: 'p1',
      name: 'Bolo de Fubá',
      isBread: false,
      qty: 8,
      revenue: 72,
      avgUnitPrice: 9,
      bySlot: [{ slotId: 'manha', label: 'Manhã', qty: 8 }],
    },
  ],
  ...over,
})

function respondWith(payload: DaySales) {
  mockApiFetch.mockResolvedValue({ ok: true, json: async () => payload })
}

describe('DaySalesSheet', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pede o relatório do dia recebido', async () => {
    respondWith(report())
    render(<DaySalesSheet date="2026-06-28" onClose={() => {}} />)

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/admin/day-sales?date=2026-06-28'))
  })

  it('mostra os totais e o horário da apuração — é o "até o momento"', async () => {
    respondWith(report())
    render(<DaySalesSheet date="2026-06-28" onClose={() => {}} />)

    // 120 aparece duas vezes de propósito: no KPI e na linha do pão (é o mesmo número).
    expect(await screen.findAllByText('120')).toHaveLength(2)
    expect(screen.getByText('16')).toBeInTheDocument() // itens
    expect(screen.getByText('R$ 323,20')).toBeInTheDocument()
    expect(screen.getByText(/até 14:32/)).toBeInTheDocument()
    expect(screen.getByText(/Domingo, 28 de junho/)).toBeInTheDocument()
  })

  it('lista os produtos vendidos, com o pão à frente', async () => {
    respondWith(report())
    render(<DaySalesSheet date="2026-06-28" onClose={() => {}} />)

    expect(await screen.findByText(/Pão Francês/)).toBeInTheDocument()
    expect(screen.getByText('Bolo de Fubá')).toBeInTheDocument()
    expect(screen.getByText('R$ 72,00')).toBeInTheDocument()
  })

  it('decompõe os pães por origem — pedido avulso, agenda e Cestinha', async () => {
    respondWith(report())
    render(<DaySalesSheet date="2026-06-28" onClose={() => {}} />)

    expect(await screen.findByText(/avulso 40 · agenda 68 · Cestinha 12/)).toBeInTheDocument()
  })

  it('avisa que o pão é valorizado a preço de avulso — o total não é faturamento do dia', async () => {
    respondWith(report())
    render(<DaySalesSheet date="2026-06-28" onClose={() => {}} />)

    expect(await screen.findByText(/preço do avulso/)).toBeInTheDocument()
    expect(screen.getByText(/não o que foi entregue/)).toBeInTheDocument()
  })

  it('dia sem venda mostra o estado vazio, não uma tabela de zeros', async () => {
    respondWith(
      report({
        breads: { total: 0, single: 0, scheduled: 0, fromMarket: 0, fromItems: 0, unitPrice: 1.2, revenue: 0 },
        items: { total: 0, revenue: 0 },
        totalRevenue: 0,
        lines: [],
        slots: [],
      }),
    )
    render(<DaySalesSheet date="2026-06-28" onClose={() => {}} />)

    expect(await screen.findByText('Nenhuma venda para este dia até o momento.')).toBeInTheDocument()
    expect(screen.queryByText('POR PRODUTO')).not.toBeInTheDocument()
  })

  it('falha de rede vira recado, não tela em branco', async () => {
    mockApiFetch.mockRejectedValue(new Error('offline'))
    render(<DaySalesSheet date="2026-06-28" onClose={() => {}} />)

    expect(await screen.findByText(/Não foi possível carregar o relatório/)).toBeInTheDocument()
  })

  it('baixa o PDF pela rota do dia', async () => {
    respondWith(report())
    const click = vi.fn()
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') return { href: '', download: '', click } as unknown as HTMLElement
      return Object.getPrototypeOf(document).createElement.call(document, tag)
    }) as typeof document.createElement)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()

    render(<DaySalesSheet date="2026-06-28" onClose={() => {}} />)
    const pdfButton = await screen.findByRole('button', { name: 'PDF' })

    mockApiFetch.mockResolvedValue({ ok: true, blob: async () => new Blob(['pdf']) })
    fireEvent.click(pdfButton)

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/admin/day-sales/pdf?date=2026-06-28'))
    await waitFor(() => expect(click).toHaveBeenCalled())
  })

  it('fecha no botão e no Esc', async () => {
    respondWith(report())
    const onClose = vi.fn()
    render(<DaySalesSheet date="2026-06-28" onClose={onClose} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
