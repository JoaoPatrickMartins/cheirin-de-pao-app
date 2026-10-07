// E13 · Meus ganhos (Onda 7): semana em andamento estimada, extrato (pago · a pagar · em análise),
// sem modalidade e combustível fora do cálculo.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))

import { CourierEarnings } from '../CourierEarnings'
import type { CourierEarnings as Earnings } from '../../../lib/courierApi'

const body = (over: Partial<Earnings> = {}, cur: Partial<Earnings['current']> = {}): Earnings => ({
  pay: { modalidade: 'PER_DELIVERY', valor: 1.5, pagaCombustivel: true },
  fuelDetailVisible: true, // switch "Meus ganhos" do A5 ligado
  current: {
    weekStart: '2026-09-28',
    weekEnd: '2026-10-04',
    entregas: 142,
    rotas: 8,
    units: 142,
    remuneration: 213,
    km: 49.3,
    fuel: 7.9,
    fuelBasis: { kmPorLitro: 38, preco: 6.09, combustivel: 'GASOLINA', reason: null },
    total: 220.9,
    openRuns: 0,
    ...cur,
  },
  extrato: [
    { weekStart: '2026-09-21', weekEnd: '2026-09-27', status: 'EM_ANALISE', remuneration: 300, fuel: 11, estimated: 311, final: 311, paidAt: null, dueDate: null },
    { weekStart: '2026-09-14', weekEnd: '2026-09-20', status: 'PAGO', remuneration: 312, fuel: 8, estimated: 323.4, final: 320, paidAt: '2026-09-22', dueDate: null },
    { weekStart: '2026-09-07', weekEnd: '2026-09-13', status: 'A_PAGAR', remuneration: 307.5, fuel: 11.1, estimated: 318.6, final: 318.6, paidAt: null, dueDate: '2026-10-02' },
  ],
  ...over,
})
const reply = (b: unknown) => mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(b) })

beforeEach(() => vi.clearAllMocks())

describe('E13 · Meus ganhos', () => {
  it('modalidade, semana estimada com a base e o combustível, e o extrato', async () => {
    reply(body())
    render(<CourierEarnings onClose={vi.fn()} />)
    expect(await screen.findByText(/Você recebe por entrega · R\$ 1,50/)).toBeDefined()
    expect(screen.getByText('Semana 28/09–04/10 · em andamento')).toBeDefined()
    expect(screen.getByText('~R$ 220,90')).toBeDefined()
    expect(screen.getByText('142 entregas × R$ 1,50')).toBeDefined()
    expect(screen.getByText('~49,3 km ÷ 38 km/l × R$ 6,09')).toBeDefined()
    expect(screen.getByText('≈ R$ 7,90')).toBeDefined()
    expect(screen.getByText('O valor final é o que a operação aprovar no fechamento da semana.')).toBeDefined()
    expect(screen.getByText('em análise')).toBeDefined()
    expect(screen.getByText('pago 22/09')).toBeDefined()
    expect(screen.getByText('a pagar · 02/10')).toBeDefined()
    expect(screen.getByText('estimado R$ 323,40 →')).toBeDefined()
    expect(screen.getByText('pago R$ 320,00')).toBeDefined()
    expect(screen.getByText('final R$ 318,60')).toBeDefined()
    expect(mockApiFetch).toHaveBeenCalledWith('/courier/earnings', {})
  })

  it('por rota, sem consumo cadastrado e rota não encerrada', async () => {
    reply(body({ pay: { modalidade: 'PER_ROUTE', valor: 25, pagaCombustivel: true }, extrato: [] }, { units: 8, remuneration: 200, fuel: 0, total: 200, openRuns: 1, fuelBasis: { kmPorLitro: null, preco: 6.09, combustivel: null, reason: 'SEM_CONSUMO' } }))
    render(<CourierEarnings onClose={vi.fn()} />)
    expect(await screen.findByText('8 rotas × R$ 25,00')).toBeDefined()
    expect(screen.queryByText(/km\/l ×/)).toBeNull()
    expect(screen.getByText('Sem consumo do veículo cadastrado, o combustível não entra no cálculo.')).toBeDefined()
    expect(screen.getByText(/1 rota foi iniciada e não encerrada/)).toBeDefined()
    expect(screen.queryByText('Extrato')).toBeNull()
  })

  it('sem modalidade: explica, oferece falar com a operação e mostra o combustível', async () => {
    reply(body({ pay: null, extrato: [] }, { remuneration: 0, total: 7.9, units: 0 }))
    render(<CourierEarnings onClose={vi.fn()} />)
    expect(await screen.findByText('Forma de pagamento não definida')).toBeDefined()
    expect(screen.getByRole('link', { name: /Falar com a operação/ }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\//)
    expect(screen.getByText(/Mesmo assim, o combustível estimado das suas rotas entra na proposta da semana: ~49,3 km · ≈ R\$ 7,90/)).toBeDefined()
  })

  it('conta do combustível escondida pelo admin (A5): o valor fica, sem km nem a conta', async () => {
    reply(body({ fuelDetailVisible: false }, { km: null, fuelBasis: { kmPorLitro: null, preco: null, combustivel: null, reason: null } }))
    render(<CourierEarnings onClose={vi.fn()} />)
    expect(await screen.findByText('≈ R$ 7,90')).toBeDefined()
    expect(screen.getByText('Combustível estimado')).toBeDefined()
    expect(screen.getByText('~R$ 220,90')).toBeDefined()
    expect(screen.queryByText(/km\/l ×/)).toBeNull()
  })

  it('escondida e sem modalidade: o aviso cita só o valor, sem o km', async () => {
    reply(body({ pay: null, extrato: [], fuelDetailVisible: false }, { remuneration: 0, total: 7.9, units: 0, km: null, fuelBasis: { kmPorLitro: null, preco: null, combustivel: null, reason: null } }))
    render(<CourierEarnings onClose={vi.fn()} />)
    const note = await screen.findByText(/Mesmo assim, o combustível estimado das suas rotas entra na proposta da semana/)
    expect(note.textContent).toContain('≈ R$ 7,90')
    expect(note.textContent).not.toContain('km')
  })

  it('GNV (Onda 11): a conta sai em km/m³', async () => {
    reply(body({}, { km: 60, fuel: 24.95, total: 237.95, fuelBasis: { kmPorLitro: 12, preco: 4.99, combustivel: 'GNV', reason: null } }))
    render(<CourierEarnings onClose={vi.fn()} />)
    expect(await screen.findByText('~60 km ÷ 12 km/m³ × R$ 4,99')).toBeDefined()
  })

  it('erro de rede: aviso', async () => {
    mockApiFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<CourierEarnings onClose={vi.fn()} />)
    expect(await screen.findByText(/Não deu para carregar seus ganhos agora/)).toBeDefined()
  })
})
