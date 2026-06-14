// HomeScreen page tests -- Wave 0 stubs (RED state)
// Requirements: UI-04, CRED-11 (exibe creditBalance do usuario autenticado)
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Joao', role: 'CLIENT', creditBalance: 42 },
    isAuthenticated: true,
  }),
}))

// import HomeScreen from '../HomeScreen'

describe('HomeScreen [UI-04, CRED-11]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('exibicao do saldo de creditos', () => {
    it('TODO: HomeScreen exibe o creditBalance do usuario autenticado (42)', () => { expect(true).toBe(false) })
    it('TODO: HomeScreen exibe o nome do usuario autenticado', () => { expect(true).toBe(false) })
    it('TODO: HomeScreen exibe mensagem/icone quando creditBalance e zero', () => { expect(true).toBe(false) })
  })
})
