// CondoForm — coordenadas manuais. As coordenadas carregadas (muitas vezes geocodificadas e
// aproximadas) não podem voltar no PATCH como "manuais": isso apagava o aviso de localização
// aproximada sem ninguém ter mexido no campo.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))
vi.mock('../../../../lib/viacep', () => ({ lookupCep: vi.fn().mockResolvedValue(null) }))

import { CondoForm } from '../CondoForm'

const condo = {
  name: 'Residencial Jardins',
  address: { street: 'Rua das Flores', number: '120', complement: null, city: 'São Paulo', state: 'SP', zip: '01310100' },
  type: 'SINGLE_ENTRANCE',
  numBlocks: null,
  lat: -23.5,
  lng: -46.6,
  approxLocation: true,
}

function mockApi() {
  mockApiFetch.mockImplementation((url: string, opts?: { method?: string }) => {
    if (!opts?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve(condo) })
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  })
}

const patchBody = () => {
  const call = mockApiFetch.mock.calls.find(([, opts]) => (opts as { method?: string } | undefined)?.method === 'PATCH')
  return JSON.parse((call![1] as { body: string }).body) as Record<string, unknown>
}

describe('CondoForm — coordenadas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi()
  })

  it('salvar sem mexer no campo não manda lat/lng (mantém o aviso de aproximada)', async () => {
    const onSaved = vi.fn()
    render(<CondoForm id="c1" onBack={vi.fn()} onSaved={onSaved} />)
    await screen.findByDisplayValue('-23.5, -46.6')

    fireEvent.click(screen.getByRole('button', { name: 'Salvar condomínio' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())

    const body = patchBody()
    expect(body).not.toHaveProperty('lat')
    expect(body).not.toHaveProperty('lng')
    expect(body.address).toMatchObject({ street: 'Rua das Flores', number: '120' })
  })

  it('coordenada digitada nesta edição vai como manual', async () => {
    const onSaved = vi.fn()
    render(<CondoForm id="c1" onBack={vi.fn()} onSaved={onSaved} />)
    const field = await screen.findByDisplayValue('-23.5, -46.6')

    fireEvent.change(field, { target: { value: '-23.55, -46.65' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar condomínio' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())

    expect(patchBody()).toMatchObject({ lat: -23.55, lng: -46.65 })
  })
})
