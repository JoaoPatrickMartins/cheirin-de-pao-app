// C3 · "Recados do entregador" (Onda 8 do entregador, V-3): o cliente liga/desliga os recados.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Marina', role: 'CLIENT' }, logout: vi.fn() }) }))
vi.mock('../../../hooks/useAutoRecharge', () => ({ useAutoRecharge: () => ({ status: null }) }))
vi.mock('../../../hooks/usePushOptIn', () => ({ usePushOptIn: () => ({ status: 'granted', busy: false, enable: vi.fn(), disable: vi.fn() }) }))
vi.mock('../../../hooks/useReferralSummary', () => ({ useReferralSummary: () => ({ summary: null }) }))

import { SettingsScreen } from '../SettingsScreen'

const ok = (b: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(b) })

beforeEach(() => vi.clearAllMocks())

describe('SettingsScreen — recados do entregador', () => {
  it('liga por padrão e desliga com PATCH', async () => {
    mockApiFetch.mockImplementation((url: string) => (url === '/client/profile' ? ok({ courierMessagesOff: false }) : ok({ courierMessagesOff: true })))
    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>,
    )
    const sw = await screen.findByRole('switch', { name: 'Recados do entregador' })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('O entregador não vê o seu telefone. Os recados chegam só como notificação.')).toBeDefined()
    fireEvent.click(sw)
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/client/profile/courier-messages', { method: 'PATCH', body: JSON.stringify({ off: true }) }))
    expect(screen.getByRole('switch', { name: 'Recados do entregador' }).getAttribute('aria-checked')).toBe('false')
  })

  it('falha ao salvar volta o switch e avisa', async () => {
    mockApiFetch.mockImplementation((url: string) => (url === '/client/profile' ? ok({ courierMessagesOff: true }) : ok({ error: 'x' }, 500)))
    render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>,
    )
    const sw = await screen.findByRole('switch', { name: 'Recados do entregador' })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw)
    expect(await screen.findByText('Não deu para salvar agora. Tente de novo.')).toBeDefined()
    expect(screen.getByRole('switch', { name: 'Recados do entregador' }).getAttribute('aria-checked')).toBe('false')
  })
})
