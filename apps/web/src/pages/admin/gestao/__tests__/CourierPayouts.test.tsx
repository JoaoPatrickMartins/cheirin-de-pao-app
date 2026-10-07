// A8 · Pagamentos dos entregadores (Onda 7): propostas da semana, editar, aprovar (vira despesa),
// descartar, histórico com "ver despesa" e a semana em andamento só estimada.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))

import { CourierPayouts, type PayoutView } from '../CourierPayouts'

const base: PayoutView = {
  id: 'p1',
  courierId: 'k1',
  name: 'Antônio Ribeiro',
  photoUrl: null,
  weekStart: '2026-09-28',
  weekEnd: '2026-10-04',
  status: 'PENDING',
  payMode: 'PER_DELIVERY',
  payAmount: 1.5,
  units: 142,
  remunerationEst: 213,
  kmEst: 49.3,
  fuelEst: 7.8,
  fuelBasis: { kmPorLitro: 38, preco: 6.09, combustivel: 'GASOLINA', reason: null },
  remunerationFinal: null,
  fuelFinal: null,
  estimated: 220.8,
  final: 220.8,
  adjustReason: null,
  discardReason: null,
  approvedAt: null,
  paid: null,
  paymentMethod: null,
  expenses: [],
  openRuns: 0,
}
const joana: PayoutView = { ...base, id: 'p2', courierId: 'k2', name: 'Joana Pires', status: 'EDITED', payMode: 'WEEKLY_FIXED', payAmount: 400, units: 1, remunerationEst: 400, fuelEst: 8.2, estimated: 408.2, remunerationFinal: 405, fuelFinal: 0, final: 405, adjustReason: 'Arredondado' }
const rui: PayoutView = { ...base, id: 'p3', courierId: 'k3', name: 'Rui Martins', payMode: null, payAmount: null, units: 0, remunerationEst: 0, kmEst: 12, fuelEst: 1.9, estimated: 1.9, final: 1.9, openRuns: 1 }
const tereza: PayoutView = { ...base, id: 'p4', courierId: 'k4', name: 'Dona Tereza', payMode: 'PER_ROUTE', payAmount: 25, units: 10, remunerationEst: 250, fuelEst: 0, estimated: 250, final: 250, fuelBasis: { kmPorLitro: null, preco: null, combustivel: null, reason: 'SEM_CONSUMO' } }

const week = (over: Record<string, unknown> = {}) => ({
  weekStart: '2026-09-28',
  weekEnd: '2026-10-04',
  state: 'CLOSED',
  since: '2026-09-21',
  proposals: [base, joana, rui, tereza],
  totals: { count: 4, open: 4, estimated: 880.9, final: 877.7 },
  ...over,
})
const approved: PayoutView = {
  ...base,
  status: 'APPROVED',
  paid: { state: 'PAGO', paidAt: '2026-10-05', dueDate: null },
  paymentMethod: 'Pix',
  expenses: [
    { id: 'e1', category: 'Entregador', amount: 213, status: 'PAID', paidAt: '2026-10-05', dueDate: null },
    { id: 'e2', category: 'Combustível', amount: 7.8, status: 'PAID', paidAt: '2026-10-05', dueDate: null },
  ],
}
const ok = (b: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(b) })

let routes: Record<string, () => Promise<unknown>>
beforeEach(() => {
  vi.clearAllMocks()
  routes = {}
  mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
    const key = `${opts?.method ?? 'GET'} ${url}`
    if (routes[key]) return routes[key]()
    if (url.startsWith('/admin/courier-payouts/history')) return ok([approved, { ...rui, status: 'DISCARDED', discardReason: 'Rotas cobertas por outro' }])
    if (url.startsWith('/admin/courier-payouts')) return ok(week())
    return ok({})
  })
})

describe('A8 · propostas', () => {
  it('semana, total e os cartões: modalidade, combustível, editada, sem modalidade, sem consumo', async () => {
    render(<CourierPayouts onBack={vi.fn()} />)
    expect(await screen.findByText('Semana 28/09–04/10')).toBeDefined()
    expect(screen.getByText('4 propostas · total estimado R$ 880,90')).toBeDefined()
    expect(screen.getByRole('tab', { name: 'Propostas · 4' })).toBeDefined()
    const a = screen.getByRole('group', { name: 'Proposta de Antônio Ribeiro' })
    expect(within(a).getByText('🛵 Remuneração · 142 × R$ 1,50')).toBeDefined()
    expect(within(a).getByText('49,3 km ÷ 38 km/l × R$ 6,09')).toBeDefined()
    expect(within(a).getByText('TOTAL ESTIMADO')).toBeDefined()
    const j = screen.getByRole('group', { name: 'Proposta de Joana Pires' })
    expect(within(j).getByText('editada')).toBeDefined()
    expect(within(j).getByText('ESTIMADO → FINAL')).toBeDefined()
    expect(within(j).getByText('Ajuste: Arredondado')).toBeDefined()
    const r = screen.getByRole('group', { name: 'Proposta de Rui Martins' })
    expect(within(r).getByText('Modalidade não definida — proposta só com o combustível.')).toBeDefined()
    expect(within(r).getByText(/1 rota não foi encerrada/)).toBeDefined()
    expect(within(screen.getByRole('group', { name: 'Proposta de Dona Tereza' })).getByText('Sem consumo cadastrado — sem combustível.')).toBeDefined()
    expect(mockApiFetch).toHaveBeenCalledWith('/admin/courier-payouts', undefined)
  })

  it('semana anterior pede ?week=; a próxima fica travada na semana em andamento', async () => {
    routes['GET /admin/courier-payouts?week=2026-09-21'] = () => ok(week({ weekStart: '2026-09-21', weekEnd: '2026-09-27', proposals: [], totals: { count: 0, open: 0, estimated: 0, final: 0 } }))
    routes['GET /admin/courier-payouts?week=2026-10-05'] = () => ok(week({ weekStart: '2026-10-05', weekEnd: '2026-10-11', state: 'CURRENT', proposals: [{ ...base, id: null, status: 'ESTIMATE' }] }))
    render(<CourierPayouts onBack={vi.fn()} />)
    await screen.findByText('Semana 28/09–04/10')
    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }))
    expect(await screen.findByText('Nada a pagar nesta semana')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Próxima semana' }))
    await screen.findByText('Semana 28/09–04/10')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima semana' }))
    expect(await screen.findByText(/Semana em andamento: só estimativa/)).toBeDefined()
    expect(screen.getByText('em andamento')).toBeDefined()
    expect(screen.queryByRole('button', { name: /Aprovar/ })).toBeNull()
    expect((screen.getByRole('button', { name: 'Próxima semana' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('aprovar "pago agora": mostra as despesas e lança com data e forma', async () => {
    routes['POST /admin/courier-payouts/p1/approve'] = () => ok(approved)
    render(<CourierPayouts onBack={vi.fn()} />)
    const a = await screen.findByRole('group', { name: 'Proposta de Antônio Ribeiro' })
    fireEvent.click(within(a).getByRole('button', { name: /Aprovar/ }))
    const sheet = screen.getByRole('dialog', { name: 'Aprovar pagamento' })
    expect(within(sheet).getByText('VIRA DESPESA NO FINANCEIRO')).toBeDefined()
    expect(within(sheet).getByText('R$ 213,00')).toBeDefined()
    expect(within(sheet).getByText('R$ 7,80')).toBeDefined()
    expect(within(sheet).getByText(/Favorecido: Antônio Ribeiro · status pago · competência 10\/2026/)).toBeDefined()
    fireEvent.change(within(sheet).getByLabelText('Data'), { target: { value: '2026-10-05' } })
    fireEvent.click(within(sheet).getByRole('button', { name: /Aprovar e lançar/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Aprovar pagamento' })).toBeNull())
    const call = mockApiFetch.mock.calls.find(([u, o]) => u === '/admin/courier-payouts/p1/approve' && o?.method === 'POST')!
    expect(JSON.parse(call[1].body)).toEqual({ paid: true, paidAt: '2026-10-05', paymentMethod: 'Pix' })
    expect(await screen.findByText('Aprovado · lançado no Financeiro')).toBeDefined()
  })

  it('aprovar "a pagar" manda o vencimento; mês fechado mostra o erro e não fecha', async () => {
    routes['POST /admin/courier-payouts/p1/approve'] = () => ok({ error: 'O mês 2026-10 está FECHADO e não aceita novos lançamentos.' }, 409)
    render(<CourierPayouts onBack={vi.fn()} />)
    const a = await screen.findByRole('group', { name: 'Proposta de Antônio Ribeiro' })
    fireEvent.click(within(a).getByRole('button', { name: /Aprovar/ }))
    const sheet = screen.getByRole('dialog', { name: 'Aprovar pagamento' })
    fireEvent.click(within(sheet).getByRole('radio', { name: /A pagar/ }))
    fireEvent.change(within(sheet).getByLabelText('Vencimento'), { target: { value: '2026-10-10' } })
    fireEvent.click(within(sheet).getByRole('button', { name: /Aprovar e lançar/ }))
    expect(await within(sheet).findByText(/está FECHADO/)).toBeDefined()
    const call = mockApiFetch.mock.calls.find(([u]) => u === '/admin/courier-payouts/p1/approve')!
    expect(JSON.parse(call[1].body)).toEqual({ paid: false, dueDate: '2026-10-10' })
  })

  it('editar manda os valores finais e o motivo', async () => {
    routes['PATCH /admin/courier-payouts/p1'] = () => ok({ ...base, status: 'EDITED', remunerationFinal: 213, fuelFinal: 10, final: 223, adjustReason: 'Desvio por obra' })
    render(<CourierPayouts onBack={vi.fn()} />)
    const a = await screen.findByRole('group', { name: 'Proposta de Antônio Ribeiro' })
    fireEvent.click(within(a).getByRole('button', { name: /Editar/ }))
    const sheet = screen.getByRole('dialog', { name: 'Editar proposta' })
    expect(within(sheet).getByDisplayValue('213,00')).toBeDefined()
    fireEvent.change(within(sheet).getByLabelText('Combustível final'), { target: { value: '10,00' } })
    fireEvent.change(within(sheet).getByLabelText('Motivo do ajuste (opcional)'), { target: { value: 'Desvio por obra' } })
    expect(within(sheet).getByText('R$ 223,00')).toBeDefined()
    fireEvent.click(within(sheet).getByRole('button', { name: /Salvar edição/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar proposta' })).toBeNull())
    const call = mockApiFetch.mock.calls.find(([u, o]) => u === '/admin/courier-payouts/p1' && o?.method === 'PATCH')!
    expect(JSON.parse(call[1].body)).toEqual({ remunerationFinal: 213, fuelFinal: 10, adjustReason: 'Desvio por obra' })
  })

  it('descartar exige o motivo', async () => {
    routes['POST /admin/courier-payouts/p3/discard'] = () => ok({ ...rui, status: 'DISCARDED', discardReason: 'Rotas cobertas por outro' })
    render(<CourierPayouts onBack={vi.fn()} />)
    const r = await screen.findByRole('group', { name: 'Proposta de Rui Martins' })
    fireEvent.click(within(r).getByRole('button', { name: 'Descartar' }))
    const sheet = screen.getByRole('dialog', { name: 'Descartar proposta' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Descartar' }))
    expect(within(sheet).getByText('Diga o motivo do descarte.')).toBeDefined()
    fireEvent.change(within(sheet).getByLabelText('Motivo do descarte'), { target: { value: 'Rotas cobertas por outro' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Descartar' }))
    await waitFor(() => expect(mockApiFetch.mock.calls.some(([u]) => u === '/admin/courier-payouts/p3/discard')).toBe(true))
  })
})

describe('A8 · histórico', () => {
  it('pago × descartada e "ver despesa" com as despesas lançadas', async () => {
    render(<CourierPayouts onBack={vi.fn()} />)
    await screen.findByText('Semana 28/09–04/10')
    fireEvent.click(screen.getByRole('tab', { name: 'Histórico' }))
    expect(await screen.findByText('Pago 05/10 · Pix')).toBeDefined()
    expect(screen.getByText('Descartada: Rotas cobertas por outro')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /ver despesa/ }))
    const sheet = screen.getByRole('dialog', { name: 'Despesas lançadas' })
    expect(within(sheet).getByText('R$ 213,00')).toBeDefined()
    expect(within(sheet).getAllByText('Paga em 05/10')).toHaveLength(2)
  })
})
