// A1 — Card do Indique e Ganhe no hub de Gestão: primeiro da lista, com o selo "N em análise".
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))
vi.mock('../../../../hooks/useAuth', () => ({ useAuth: () => ({ logout: vi.fn() }) }))
vi.mock('../../../../components/admin/AdminHead', () => ({ AdminHead: () => null }))

import { AdminGestao } from '../AdminGestao'

function respond(pendingReview: number) {
  api.fetch.mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(url === '/admin/referrals/summary' ? { pendingReview } : { pending: 0 }),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdminGestao — card do Indique e Ganhe (A1)', () => {
  it('é o primeiro card do hub e mostra "3 em análise"', async () => {
    respond(3)
    render(
      <MemoryRouter>
        <AdminGestao />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('3 em análise')).toBeDefined())
    const first = screen.getAllByRole('button')[0]
    expect(first.textContent).toContain('Indique e Ganhe')
    expect(first.textContent).toContain('Recompensas, regras e indicações')
  })

  it('sem nada em análise, sem selo', async () => {
    respond(0)
    render(
      <MemoryRouter>
        <AdminGestao />
      </MemoryRouter>,
    )
    await waitFor(() => expect(api.fetch).toHaveBeenCalledWith('/admin/referrals/summary'))
    expect(screen.queryByText(/em análise/)).toBeNull()
  })
})
