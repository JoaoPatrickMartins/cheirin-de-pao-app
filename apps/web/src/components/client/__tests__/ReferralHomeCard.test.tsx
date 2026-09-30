// C3 — card do Indique e Ganhe na Home.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const api = vi.hoisted(() => ({ summary: null as unknown, fetch: vi.fn() }))
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', role: 'CLIENT' } }) }))

import { ReferralHomeCard } from '../ReferralHomeCard'
import { __resetReferralSummaryCache } from '../../../hooks/useReferralSummary'

function summary(over: Record<string, unknown> = {}) {
  return {
    active: true, hasReferrals: false, isNew: true, rewardBreads: 5, campaign: null,
    homeCard: { visible: true }, bonusThisMonth: 0, celebration: null, ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetReferralSummaryCache()
  api.summary = summary()
  api.fetch.mockImplementation((path: string) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(path === '/referrals/summary' ? api.summary : { ok: true }) }),
  )
})

const renderCard = () => render(<MemoryRouter><ReferralHomeCard /></MemoryRouter>)

describe('ReferralHomeCard (C3)', () => {
  it('visível: título com X e "Indicar agora"', async () => {
    renderCard()
    expect(await screen.findByText('Indique um vizinho, ganhe 5 pãezins')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /indicar agora/i })).toBeInTheDocument()
  })

  it('servidor diz que não aparece (sem entrega / fechado / programa off) → nada', async () => {
    api.summary = summary({ homeCard: { visible: false } })
    const { container } = renderCard()
    await vi.waitFor(() => expect(api.fetch).toHaveBeenCalledWith('/referrals/summary'))
    expect(container).toBeEmptyDOMElement()
  })

  it('campanha: eyebrow "Semana em dobro · até 11/10" e o X multiplicado', async () => {
    api.summary = summary({ rewardBreads: 10, campaign: { label: 'Semana em dobro', until: '2026-10-11' } })
    renderCard()
    expect(await screen.findByText('Semana em dobro · até 11/10')).toBeInTheDocument()
    expect(screen.getByText('Indique um vizinho, ganhe 10 pãezins')).toBeInTheDocument()
  })

  it('X (44 px, "Fechar por 30 dias") grava no servidor e some na hora', async () => {
    renderCard()
    fireEvent.click(await screen.findByRole('button', { name: 'Fechar por 30 dias' }))
    expect(api.fetch).toHaveBeenCalledWith('/referrals/home-card/dismiss', { method: 'POST' })
    expect(screen.queryByText(/Indique um vizinho/)).toBeNull()
  })
})
