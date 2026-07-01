// HomeScreen page tests
// Requirements: UI-04, CRED-11 (exibe creditBalance do usuario autenticado)
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { HomeScreen } from '../HomeScreen'

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Joao Silva', role: 'CLIENT', creditBalance: 42 },
    isAuthenticated: true,
    token: 'tok',
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    updateCreditBalance: vi.fn(),
  }),
}))

// Pedido de hoje em estado intermediário (SEPARATED) — regressão do bug em que o
// banner mostrava "ENTREGUE" para qualquer status fora dos 3 conhecidos.
vi.mock('../../../hooks/useOrderTracking', () => ({
  useOrderTracking: () => ({
    order: { id: 'o1', status: 'SEPARATED', quantity: 5, scheduledDate: new Date().toISOString(), deliveryTime: '06:30' },
    isToday: true,
    isLoading: false,
  }),
}))

describe('HomeScreen [UI-04, CRED-11]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('exibicao do saldo de creditos', () => {
    it('HomeScreen exibe o creditBalance do usuario autenticado (42)', () => {
      render(
        <MemoryRouter>
          <HomeScreen />
        </MemoryRouter>
      )
      expect(screen.getByText('42')).toBeDefined()
    })

    it('HomeScreen exibe o nome do usuario autenticado', () => {
      render(
        <MemoryRouter>
          <HomeScreen />
        </MemoryRouter>
      )
      expect(screen.getByText(/Joao/i)).toBeDefined()
    })

    it('HomeScreen exibe o card de saldo com label "VOCÊ TEM" e sufixo "pães"', () => {
      render(
        <MemoryRouter>
          <HomeScreen />
        </MemoryRouter>
      )
      expect(screen.getByText('VOCÊ TEM')).toBeDefined()
      expect(screen.getByText('pães')).toBeDefined()
    })
  })

  describe('status do banner de entrega', () => {
    it('estado intermediário (SEPARATED) NÃO mostra "Entregue" — mostra "Agendado"', () => {
      render(
        <MemoryRouter>
          <HomeScreen />
        </MemoryRouter>
      )
      expect(screen.queryByText('Entregue')).toBeNull()
      expect(screen.queryByText('ENTREGUE')).toBeNull()
      expect(screen.getByText('Agendado')).toBeDefined()
    })
  })
})
