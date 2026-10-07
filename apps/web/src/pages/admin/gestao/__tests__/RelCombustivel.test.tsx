// A9 · Combustível & rotas (Onda 7): KPIs estimados, economia das rotas aceitas, por entregador,
// período e o atalho para Pagamentos.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))
vi.mock('../../../../lib/xlsx', () => ({ downloadXlsx: vi.fn() }))

import { RelCombustivel } from '../RelCombustivel'

const report = {
  window: { from: '2026-09-03', to: '2026-10-02', label: '03/09/2026 a 02/10/2026', isPartial: true },
  runs: 40,
  km: 712,
  litros: 18.7,
  gasto: 114,
  entregas: 607,
  paes: 2280,
  porEntrega: 0.19,
  porPao: 0.05,
  savings: { km: 42, value: 6.7, runs: 28 },
  couriers: [
    { courierId: 'k1', name: 'Antônio Ribeiro', runs: 20, km: 356, litros: 9.4, gasto: 57.1, entregas: 312, porEntrega: 0.18, semConsumo: false, semPreco: false },
    { courierId: 'k3', name: 'Dona Tereza', runs: 8, km: 108, litros: 0, gasto: 0, entregas: 81, porEntrega: 0, semConsumo: true, semPreco: false },
  ],
}
const ok = (b: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(b) })

beforeEach(() => {
  vi.clearAllMocks()
  mockApiFetch.mockImplementation((url: string) => {
    if (url.startsWith('/admin/reports/fuel')) return ok(report)
    if (url.startsWith('/admin/courier-payouts')) return ok({ weekStart: '2026-09-21', weekEnd: '2026-09-27', state: 'CLOSED', since: '2026-09-21', proposals: [], totals: { count: 0, open: 0, estimated: 0, final: 0 } })
    return ok({})
  })
})

describe('A9 · Combustível & rotas', () => {
  it('KPIs, economia, quem está sem consumo e a tabela por entregador', async () => {
    render(<RelCombustivel onBack={vi.fn()} />)
    expect(await screen.findByText('~712')).toBeDefined()
    expect(screen.getByText('~18,7')).toBeDefined()
    expect(screen.getByText('≈ R$ 114,00')).toBeDefined()
    expect(screen.getByText('R$ 0,19')).toBeDefined()
    expect(screen.getByText('−42 km')).toBeDefined()
    expect(screen.getByText(/Rotas aceitas economizaram/).textContent).toContain('~42 km no período (≈ R$ 6,70)')
    expect(screen.getByText(/Sem consumo cadastrado \(fora do gasto\): Dona T\./)).toBeDefined()
    const table = screen.getByRole('table', { name: 'Por entregador' })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByText('Antônio R.')).toBeDefined()
    expect(within(rows[1]).getByText('57,10')).toBeDefined()
    expect(within(rows[2]).getAllByText('—')).toHaveLength(2)
  })

  it('GNV (Onda 11): litros e m³ separados no KPI e na planilha', async () => {
    const xlsx = await import('../../../../lib/xlsx')
    mockApiFetch.mockImplementation((url: string) => (url.startsWith('/admin/reports/fuel') ? ok({ ...report, m3: 6.2, couriers: report.couriers.map((c, i) => ({ ...c, m3: i === 0 ? 6.2 : 0 })) }) : ok({})))
    render(<RelCombustivel onBack={vi.fn()} />)
    expect(await screen.findByText('Litros · m³')).toBeDefined()
    expect(screen.getByText('~18,7 L · ~6,2 m³')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Exportar/ }))
    await waitFor(() => expect(xlsx.downloadXlsx).toHaveBeenCalled())
    const [, [sheet]] = vi.mocked(xlsx.downloadXlsx).mock.calls[0] as unknown as [string, Array<{ head: string[]; rows: unknown[][]; footer: string[] }>]
    expect(sheet.head).toContain('m³ (GNV)')
    expect(sheet.rows[0][4]).toBe(6.2)
    expect(sheet.footer[0]).toContain('~18,7 L · ~6,2 m³')
  })

  it('período: 30 dias por padrão; "Mês" pede o mês; "Período" usa as datas', async () => {
    render(<RelCombustivel onBack={vi.fn()} />)
    await screen.findByText('~712')
    expect(mockApiFetch.mock.calls[0][0]).toMatch(/^\/admin\/reports\/fuel\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/)
    fireEvent.click(screen.getByRole('radio', { name: 'Mês' }))
    await waitFor(() => expect(mockApiFetch.mock.calls.some(([u]) => /\?month=\d{4}-\d{2}$/.test(u))).toBe(true))
    fireEvent.click(screen.getByRole('radio', { name: 'Período' }))
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-09-15' } })
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/admin/reports/fuel?from=2026-09-01&to=2026-09-15'))
  })

  it('sem rotas: vazio; "Ir para pagamentos" abre o A8', async () => {
    mockApiFetch.mockImplementationOnce(() => ok({ ...report, runs: 0, couriers: [] }))
    const { unmount } = render(<RelCombustivel onBack={vi.fn()} />)
    expect(await screen.findByText('Sem rotas no período')).toBeDefined()
    unmount()
    render(<RelCombustivel onBack={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Ir para pagamentos/ }))
    expect(await screen.findByRole('heading', { name: 'Pagamentos' })).toBeDefined()
  })
})
