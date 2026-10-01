// SettingsScreen page tests — Wave 0 stubs
// Requirements: CONF-02, CONF-03, CONF-05, CONF-07
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Marina', email: 'marina@email.com', role: 'CLIENT' }, logout: vi.fn() }),
}))
vi.mock('../../../hooks/useAutoRecharge', () => ({ useAutoRecharge: () => ({ status: null }) }))
vi.mock('../../../hooks/usePushOptIn', () => ({
  usePushOptIn: () => ({ status: 'granted', busy: false, enable: vi.fn(), disable: vi.fn() }),
}))
vi.mock('../../../hooks/useReferralSummary', () => ({ useReferralSummary: () => ({ summary: null }) }))

import { SettingsScreen } from '../SettingsScreen'

afterEach(() => vi.restoreAllMocks())

describe('SettingsScreen', () => {
  it.todo('renderiza campo Nome completo editável') // CONF-02
  it.todo('renderiza campo CPF como readonly') // CONF-03
  it.todo('renderiza seção Condomínio com CondoSearch') // CONF-05
  it.todo('chama logout() ao clicar em Sair') // CONF-07

  // Página Sobre: a /sobre/ é HTML estático, fora do router — navegação de página inteira.
  it('Ajuda › "Saber mais sobre o Cheirin" abre a página pública /sobre/', () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign })
    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByText('Saber mais sobre o Cheirin'))
    expect(assign).toHaveBeenCalledWith('/sobre/')
    expect(screen.getByText('Como funcionam os pãezins, a agenda e o gancho')).toBeInTheDocument()
  })
})
