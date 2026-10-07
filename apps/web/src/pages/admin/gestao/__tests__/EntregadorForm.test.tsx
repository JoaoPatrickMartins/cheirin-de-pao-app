// EntregadorForm — cadastro do entregador (A3 do plano do entregador): dados + crachá, veículo,
// regras, pagamento, disponibilidade + folgas e rota. CPF imutável na edição.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))
vi.mock('react-easy-crop', () => ({ default: () => null }))

import { EntregadorForm } from '../EntregadorForm'

const entregador = {
  id: 'courier-01',
  name: 'João Silva',
  phone: '11999998888',
  email: 'joao@email.com',
  cpf: '12345678901',
  isBlocked: false,
  createdAt: '2026-03-10T12:00:00.000Z',
  photoUrl: null,
  vehicle: { tipo: 'MOTO' as const, modelo: 'CG 160', placa: 'ABC1D23', combustivel: 'GASOLINA', kmPorLitro: 38 },
  rules: { fotoEntrega: true, fotoNaoEntrega: true, podeReordenar: false, podeRecados: false },
  pay: { modalidade: 'PER_DELIVERY' as const, valor: 1.5, pagaCombustivel: true },
  availability: { dias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'], turnos: ['manha'] },
  badgeNumber: 427,
  badgeValidUntil: '2026-12-31',
  routeSuggestion: true,
}
const slots = { slots: [{ slotId: 'manha', label: 'Manhã', emoji: '☀️', time: '06:30', cutoffTime: '22:00' }, { slotId: 'tarde', label: 'Tarde', emoji: '🌙', time: '15:30', cutoffTime: '10:00' }] }
const ok = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })

beforeEach(() => {
  vi.clearAllMocks()
  mockApiFetch.mockImplementation((url: string) => {
    if (url === '/admin/settings/slots') return ok(slots)
    if (url.endsWith('/time-offs')) return ok([{ id: 't1', startDate: '2026-10-12', endDate: '2026-10-13', reason: 'Folga' }])
    return ok({})
  })
})

describe('EntregadorForm — edição', () => {
  it('pré-preenche: nome no título, "desde", CPF bloqueado, crachá nº 0427 e a folga', async () => {
    render(<EntregadorForm entregador={entregador} onBack={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'João Silva' })).toBeDefined()
    expect(screen.getByText(/Entregador desde/)).toBeDefined()
    expect(screen.getByDisplayValue('(11) 99999-8888')).toBeDefined()
    expect((screen.getByDisplayValue('123.456.789-01') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText('0427')).toBeDefined()
    expect(screen.getByDisplayValue('2026-12-31')).toBeDefined()
    expect(await screen.findByText('12/10 a 13/10')).toBeDefined()
    expect(screen.getByText('sugestão nova')).toBeDefined()
  })

  it('salva via PATCH sem CPF, com veículo, regras, pagamento e escala', async () => {
    const onSaved = vi.fn()
    render(<EntregadorForm entregador={entregador} onBack={vi.fn()} onSaved={onSaved} />)
    const turnos = await screen.findByRole('group', { name: 'Turnos' })
    fireEvent.change(screen.getByDisplayValue('João Silva'), { target: { value: 'João Souza' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Pode reordenar a rota' }))
    fireEvent.click(screen.getByRole('button', { name: 'Domingo' }))
    fireEvent.click(within(turnos).getByRole('button', { name: /Tarde/ }))
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/ }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const [url, opts] = mockApiFetch.mock.calls.find(([, o]) => o?.method === 'PATCH')!
    expect(url).toBe('/admin/couriers/courier-01')
    const body = JSON.parse(opts.body)
    expect(body).not.toHaveProperty('cpf')
    expect(body).toMatchObject({
      name: 'João Souza',
      phone: '11999998888',
      badgeValidUntil: '2026-12-31',
      vehicle: { tipo: 'MOTO', modelo: 'CG 160', placa: 'ABC1D23', combustivel: 'GASOLINA', kmPorLitro: 38 },
      rules: { podeReordenar: true },
      pay: { modalidade: 'PER_DELIVERY', valor: 1.5, pagaCombustivel: true },
      availability: { dias: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'], turnos: ['manha', 'tarde'] },
    })
  })

  it('GNV (Onda 11): só aparece no carro, o consumo vira km/m³ e salva; voltar para moto volta para Gasolina', async () => {
    const onSaved = vi.fn()
    render(<EntregadorForm entregador={entregador} onBack={vi.fn()} onSaved={onSaved} />)
    await screen.findByRole('group', { name: 'Turnos' })
    const veh = screen.getByRole('radiogroup', { name: 'Veículo' })
    expect(within(screen.getByRole('radiogroup', { name: 'Combustível' })).queryByRole('radio', { name: 'GNV' })).toBeNull()
    fireEvent.click(within(veh).getByRole('radio', { name: /Carro/ }))
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Combustível' })).getByRole('radio', { name: 'GNV' }))
    expect(screen.getByText('Consumo (km/m³)')).toBeDefined()
    fireEvent.change(screen.getByDisplayValue('38'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/ }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const [, opts] = mockApiFetch.mock.calls.find(([, o]) => o?.method === 'PATCH')!
    expect(JSON.parse(opts.body).vehicle).toMatchObject({ tipo: 'CARRO', combustivel: 'GNV', kmPorLitro: 12 })
    fireEvent.click(within(veh).getByRole('radio', { name: /Moto/ }))
    expect(screen.getByText('Consumo (km/l)')).toBeDefined()
    expect(within(screen.getByRole('radiogroup', { name: 'Combustível' })).getByRole('radio', { name: 'Gasolina' }).getAttribute('aria-checked')).toBe('true')
  })

  it('termo do entregador (plano-termos-legais §6): aceito com a data ou pendente, com o link do termo', async () => {
    const { unmount } = render(<EntregadorForm entregador={{ ...entregador, terms: { acceptedVersion: '1.0', acceptedAt: '2026-10-05T09:00:00.000Z' } }} onBack={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByTestId('courier-terms').textContent).toContain('termo v1.0 aceito em 05/10/2026')
    expect(screen.getByRole('link', { name: 'ver o termo' }).getAttribute('href')).toBe('/termos-entregador')
    unmount()
    render(<EntregadorForm entregador={{ ...entregador, terms: { acceptedVersion: null, acceptedAt: null } }} onBack={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByTestId('courier-terms').textContent).toContain('termo pendente')
  })

  it('bicicleta esconde combustível e consumo; tocar de novo limpa o veículo', async () => {
    render(<EntregadorForm entregador={entregador} onBack={vi.fn()} onSaved={vi.fn()} />)
    const veh = screen.getByRole('radiogroup', { name: 'Veículo' })
    fireEvent.click(within(veh).getByRole('radio', { name: /Bike/ }))
    expect(screen.queryByText('Consumo (km/l)')).toBeNull()
    expect(screen.getByText(/Bicicleta não usa combustível/)).toBeDefined()
    fireEvent.click(within(veh).getByRole('radio', { name: /Bike/ }))
    expect(screen.getByText('Sem veículo cadastrado: a rota não calcula combustível.')).toBeDefined()
  })

  it('folga: adiciona (com aviso de rota já aprovada) e remove', async () => {
    mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
      if (url === '/admin/settings/slots') return ok(slots)
      if (url.endsWith('/time-offs') && opts?.method === 'POST')
        return ok({ timeOff: { id: 't2', startDate: '2026-10-05', endDate: '2026-10-05', reason: 'Consulta' }, overlaps: [{ date: '2026-10-05', slotLabel: '☀️ Manhã', stops: 12 }] }, 201)
      if (url.endsWith('/time-offs')) return ok([])
      if (opts?.method === 'DELETE') return ok(null, 204)
      return ok({})
    })
    render(<EntregadorForm entregador={entregador} onBack={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Adicionar folga/ }))
    const inputs = screen.getAllByDisplayValue('').filter((el) => (el as HTMLInputElement).type === 'date')
    fireEvent.change(inputs[0], { target: { value: '2026-10-05' } })
    fireEvent.change(screen.getByPlaceholderText('Folga, consulta, feriado…'), { target: { value: 'Consulta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar folga' }))
    expect(await screen.findByText(/A folga de 05\/10 cai numa rota já aprovada \(☀️ Manhã · 12 paradas\)/)).toBeDefined()
    const post = mockApiFetch.mock.calls.find(([u, o]) => u.endsWith('/time-offs') && o?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toEqual({ startDate: '2026-10-05', endDate: '2026-10-05', reason: 'Consulta' })
    fireEvent.click(screen.getByRole('button', { name: 'Remover folga de 05/10/2026' }))
    await waitFor(() => expect(screen.queryByText('05/10')).toBeNull())
    expect(mockApiFetch).toHaveBeenCalledWith('/admin/couriers/courier-01/time-offs/t2', { method: 'DELETE' })
  })

  it('rota do turno abre pela seção 6', async () => {
    const onOpenRoute = vi.fn()
    render(<EntregadorForm entregador={entregador} onBack={vi.fn()} onSaved={vi.fn()} onOpenRoute={onOpenRoute} />)
    fireEvent.click(await screen.findByRole('button', { name: /Tarde · rota/ }))
    expect(onOpenRoute).toHaveBeenCalledWith('tarde')
  })
})

describe('EntregadorForm — cadastro', () => {
  it('título "Novo entregador", CPF editável, validade 31/12 e seg a sáb já marcados', async () => {
    render(<EntregadorForm onBack={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Novo entregador' })).toBeDefined()
    expect((screen.getByPlaceholderText('000.000.000-00') as HTMLInputElement).disabled).toBe(false)
    expect(screen.getByDisplayValue(`${new Date().getFullYear()}-12-31`)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Segunda' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Domingo' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByText('Modalidade não definida. A proposta semanal sai só com o combustível.')).toBeDefined()
    expect(screen.getByText('Salve o cadastro para marcar folgas.')).toBeDefined()
  })

  it('modalidade sem valor não salva', async () => {
    render(<EntregadorForm onBack={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Nome e sobrenome'), { target: { value: 'Maria' } })
    fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), { target: { value: '52998224725' } })
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Modalidade' })).getByRole('radio', { name: 'Por rota' }))
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar entregador/ }))
    expect(await screen.findByText('Informe o valor da modalidade de pagamento.')).toBeDefined()
    expect(mockApiFetch.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false)
  })
})
