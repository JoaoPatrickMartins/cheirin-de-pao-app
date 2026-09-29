// A8 — Preferências de notificação do admin: os 3 avisos do Indique e Ganhe, com selo "novo";
// "Indicação recompensada" chega desligada (D-14 — o servidor devolve `false` para ela).
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))
vi.mock('../../../../components/PushNotificationToggle', () => ({ PushNotificationToggle: () => null }))

import { AdminNotificacoes } from '../AdminNotificacoes'

const prefs = { ADMIN_ORDER_PLACED: true, ADMIN_REFERRAL_REVIEW: true, ADMIN_REFERRAL_REWARDED: false, ADMIN_CONDO_INTEREST: true }

beforeEach(() => {
  vi.clearAllMocks()
  api.fetch.mockImplementation((_url: string, init?: { method?: string; body?: string }) => {
    const next = init?.method === 'PUT' ? { ...prefs, ...JSON.parse(init.body!) } : prefs
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ prefs: next }) })
  })
})

describe('AdminNotificacoes (A8)', () => {
  it('os 3 avisos novos aparecem com "novo"; recompensada desligada, os outros dois ligados', async () => {
    render(<AdminNotificacoes onBack={vi.fn()} />)
    const review = await screen.findByRole('switch', { name: /Indicação para analisar/ })
    const rewarded = screen.getByRole('switch', { name: /Indicação recompensada/ })
    const condo = screen.getByRole('switch', { name: /Pedido de novo condomínio/ })
    expect(review.getAttribute('aria-checked')).toBe('true')
    expect(rewarded.getAttribute('aria-checked')).toBe('false')
    expect(condo.getAttribute('aria-checked')).toBe('true')
    expect(screen.getAllByText('novo')).toHaveLength(3)
    expect(screen.getByText('Quando alguém entra na lista de espera')).toBeDefined()
  })

  it('ligar "recompensada" grava true', async () => {
    render(<AdminNotificacoes onBack={vi.fn()} />)
    fireEvent.click(await screen.findByRole('switch', { name: /Indicação recompensada/ }))
    await waitFor(() =>
      expect(api.fetch).toHaveBeenCalledWith(
        '/admin/notification-prefs',
        expect.objectContaining({ method: 'PUT', body: JSON.stringify({ ADMIN_REFERRAL_REWARDED: true }) }),
      ),
    )
  })
})
