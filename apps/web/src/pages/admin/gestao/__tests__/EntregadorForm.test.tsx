// EntregadorForm page tests
// Requirements: edição de entregador pelo admin — PATCH /admin/couriers/:id (name, phone, email; cpf imutável)
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))

import { EntregadorForm } from '../EntregadorForm'

const entregador = {
  id: 'courier-01',
  name: 'João Silva',
  phone: '11999998888',
  email: 'joao@email.com',
  cpf: '12345678901',
}

describe('EntregadorForm — modo edição', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
  })

  it('pré-preenche os campos e mostra o título de edição', () => {
    render(<EntregadorForm entregador={entregador} onBack={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Editar entregador' })).toBeDefined()
    expect(screen.getByDisplayValue('João Silva')).toBeDefined()
    expect(screen.getByDisplayValue('joao@email.com')).toBeDefined()
    // telefone e cpf são exibidos mascarados
    expect(screen.getByDisplayValue('(11) 99999-8888')).toBeDefined()
    expect(screen.getByDisplayValue('123.456.789-01')).toBeDefined()
  })

  it('desabilita o campo de CPF (imutável)', () => {
    render(<EntregadorForm entregador={entregador} onBack={vi.fn()} onSaved={vi.fn()} />)

    const cpfInput = screen.getByDisplayValue('123.456.789-01') as HTMLInputElement
    expect(cpfInput.disabled).toBe(true)
  })

  it('salva via PATCH /admin/couriers/:id sem enviar cpf', async () => {
    const onSaved = vi.fn()
    render(<EntregadorForm entregador={entregador} onBack={vi.fn()} onSaved={onSaved} />)

    fireEvent.change(screen.getByDisplayValue('João Silva'), {
      target: { value: 'João Souza' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())

    const [url, opts] = mockApiFetch.mock.calls[0] as [string, { method: string; body: string }]
    expect(url).toBe('/admin/couriers/courier-01')
    expect(opts.method).toBe('PATCH')
    const body = JSON.parse(opts.body) as Record<string, unknown>
    expect(body.name).toBe('João Souza')
    expect(body.phone).toBe('11999998888')
    expect(body.email).toBe('joao@email.com')
    expect(body).not.toHaveProperty('cpf')
  })
})

describe('EntregadorForm — modo cadastro (regressão)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
  })

  it('mostra o título de cadastro e mantém o CPF editável', () => {
    render(<EntregadorForm onBack={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Cadastrar entregador' })).toBeDefined()
    const cpfInput = screen.getByPlaceholderText('000.000.000-00') as HTMLInputElement
    expect(cpfInput.disabled).toBe(false)
  })
})
