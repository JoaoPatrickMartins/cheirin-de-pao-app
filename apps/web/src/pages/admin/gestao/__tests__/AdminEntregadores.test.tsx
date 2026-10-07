// AdminEntregadores — o toggle de ativar/desativar reverte quando o servidor recusa.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))

import { AdminEntregadores } from '../AdminEntregadores'

const ok = (b: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(b) })
const courier = { id: 'c1', name: 'Antônio Ribeiro', cpf: '12345678901', phone: '11999998888', isBlocked: false }

function mockApi(toggleOk: boolean) {
  mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
    if (opts?.method === 'PATCH') return Promise.resolve({ ok: toggleOk, json: () => Promise.resolve({}) })
    return Promise.resolve({ ok: true, json: () => Promise.resolve([courier]) })
  })
}

describe('AdminEntregadores — toggle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('volta ao estado anterior quando o servidor responde erro', async () => {
    mockApi(false)
    render(<AdminEntregadores onBack={vi.fn()} />)
    const toggle = await screen.findByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(toggle)

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/admin/couriers/c1/toggle', { method: 'PATCH' }))
    await waitFor(() => expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true'))
  })

  it('mantém o novo estado quando o servidor confirma', async () => {
    mockApi(true)
    render(<AdminEntregadores onBack={vi.fn()} />)
    const toggle = await screen.findByRole('switch')

    fireEvent.click(toggle)

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/admin/couriers/c1/toggle', { method: 'PATCH' }))
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false')
  })
})

describe('AdminEntregadores — lista ampliada (A3)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resumo do veículo e da modalidade; selos "de folga hoje" e "sugestão de rota nova"', async () => {
    mockApiFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { ...courier, vehicle: { tipo: 'MOTO' }, pay: { modalidade: 'PER_DELIVERY', valor: 1.5, pagaCombustivel: true }, routeSuggestion: true, offToday: null },
            { ...courier, id: 'c2', name: 'Rui Martins', vehicle: { tipo: 'BIKE' }, pay: null, offToday: 'FOLGA', routeSuggestion: false },
            { ...courier, id: 'c3', name: 'Dona Tereza', isBlocked: true },
          ]),
      }),
    )
    render(<AdminEntregadores onBack={vi.fn()} />)
    expect(await screen.findByText('Moto · por entrega')).toBeDefined()
    expect(screen.getByText('Bicicleta · sem modalidade')).toBeDefined()
    expect(screen.getByText('Desativado')).toBeDefined()
    expect(screen.getByText('sugestão de rota nova')).toBeDefined()
    expect(screen.getByText('de folga hoje')).toBeDefined()
  })
})

describe('AdminEntregadores — termo do entregador (plano-termos-legais §6)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('selo "termo pendente" para quem não aceitou a versão vigente', async () => {
    mockApiFetch.mockImplementation(() =>
      ok([
        { ...courier, terms: { acceptedVersion: '1.0', acceptedAt: '2026-10-05T09:00:00.000Z' } },
        { ...courier, id: 'c2', name: 'Rui Martins', terms: { acceptedVersion: null, acceptedAt: null } },
      ]),
    )
    render(<AdminEntregadores onBack={vi.fn()} />)
    expect(await screen.findByText('Rui Martins')).toBeDefined()
    expect(screen.getAllByText('termo pendente')).toHaveLength(1)
  })
})

describe('AdminEntregadores — pagamentos (A8)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('atalho com as propostas a aprovar abre Pagamentos', async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === '/admin/courier-payouts/summary') return Promise.resolve({ ok: true, json: () => Promise.resolve({ open: 3 }) })
      if (url.startsWith('/admin/courier-payouts'))
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ weekStart: '2026-09-28', weekEnd: '2026-10-04', state: 'CLOSED', since: '2026-09-21', proposals: [], totals: { count: 0, open: 0, estimated: 0, final: 0 } }) })
      return Promise.resolve({ ok: true, json: () => Promise.resolve([courier]) })
    })
    render(<AdminEntregadores onBack={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Pagamentos.*3 propostas a aprovar/ }))
    expect(await screen.findByRole('heading', { name: 'Pagamentos' })).toBeDefined()
    expect(await screen.findByText('Semana 28/09–04/10')).toBeDefined()
  })
})
