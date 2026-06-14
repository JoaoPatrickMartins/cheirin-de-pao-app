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

    it('HomeScreen exibe sufixo "paes" no card de saldo', () => {
      render(
        <MemoryRouter>
          <HomeScreen />
        </MemoryRouter>
      )
      expect(screen.getByText('pães')).toBeDefined()
    })
  })
})
