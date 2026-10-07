// C1 do plano do entregador — "Saiu para entrega" só depois de o entregador INICIAR a rota (D-7),
// o card do entregador (foto + primeiro nome) e o cabeçalho com condomínio/bloco/apto (V-16).
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))
const mockUseOrderTracking = vi.hoisted(() => vi.fn())
vi.mock('../../../hooks/useOrderTracking', () => ({ useOrderTracking: mockUseOrderTracking }))
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ updateCreditBalance: vi.fn(), user: { condominiumName: 'Residencial Jardins', block: '1', apartment: '101' } }),
}))
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

import { TrackingScreen, clientStatus } from '../TrackingScreen'

const order = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  status: 'OUT_FOR_DELIVERY',
  quantity: 4,
  scheduledDate: new Date().toISOString(),
  proof: { available: false, expired: false },
  onTheWayAt: null,
  courier: null,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockApiFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
})

const renderIt = () =>
  render(
    <MemoryRouter>
      <TrackingScreen />
    </MemoryRouter>,
  )

describe('clientStatus', () => {
  it('em rota pelo admin sem a rota iniciada continua "agendado"; API antiga (sem o campo) usa o status', () => {
    expect(clientStatus({ status: 'OUT_FOR_DELIVERY', onTheWayAt: null })).toBe('SCHEDULED')
    expect(clientStatus({ status: 'OUT_FOR_DELIVERY', onTheWayAt: '2026-10-02T08:40:00Z' })).toBe('OUT_FOR_DELIVERY')
    expect(clientStatus({ status: 'OUT_FOR_DELIVERY' } as never)).toBe('OUT_FOR_DELIVERY')
  })
})

describe('TrackingScreen — a caminho (C1)', () => {
  it('antes de a rota começar: nada de entregador, "Saiu" apagado com a explicação', () => {
    mockUseOrderTracking.mockReturnValue({ order: order(), isToday: true })
    renderIt()
    expect(screen.getByText('Acende quando o entregador sair com o seu pão')).toBeDefined()
    expect(screen.getByText('Quando o entregador sair com o seu pão, você vê aqui quem vai entregar.')).toBeDefined()
    expect(screen.queryByText('Seu entregador')).toBeNull()
  })

  it('rota iniciada: quem traz, desde quando e o selo "a caminho"', () => {
    mockUseOrderTracking.mockReturnValue({
      order: order({ onTheWayAt: '2026-10-02T08:40:00.000Z', courier: { firstName: 'Antônio', photoUrl: null } }),
      isToday: true,
    })
    renderIt()
    expect(screen.getByText('Antônio está a caminho do seu condomínio')).toBeDefined()
    expect(screen.getByText('a caminho desde 05:40')).toBeDefined()
    expect(screen.getByText('Seu entregador')).toBeDefined()
    expect(screen.getByText('a caminho')).toBeDefined()
    expect(screen.queryByText(/você vê aqui quem vai entregar/)).toBeNull()
  })

  it('entregue: o card do entregador fica, sem "a caminho"', () => {
    mockUseOrderTracking.mockReturnValue({
      order: order({ status: 'DELIVERED', onTheWayAt: '2026-10-02T08:40:00.000Z', courier: { firstName: 'Antônio', photoUrl: 'https://cdn/couriers/a.jpg' } }),
      isToday: true,
    })
    renderIt()
    expect(screen.getByAltText('Foto de Antônio')).toBeDefined()
    expect(screen.queryByText('a caminho')).toBeNull()
  })

  it('cabeçalho: condomínio · bloco · apto (V-16)', () => {
    mockUseOrderTracking.mockReturnValue({ order: order({ status: 'SCHEDULED' }), isToday: true })
    renderIt()
    expect(screen.getByText(/Residencial Jardins · Bloco 1 · Apto 101/)).toBeDefined()
  })
})
