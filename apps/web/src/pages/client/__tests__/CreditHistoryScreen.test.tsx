// C7 — extrato com o visual do handoff, só no front (D-17): a API /credits/history não mudou.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const api = vi.hoisted(() => ({ history: [] as unknown[], bonus: 0, fetch: vi.fn() }))
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ token: 't', user: { id: 'u1', role: 'CLIENT', creditBalance: 12.5 } }),
}))
vi.mock('../../../hooks/useCreditBalanceSync', () => ({ useCreditBalanceSync: () => ({ refresh: vi.fn() }) }))

import { CreditHistoryScreen } from '../CreditHistoryScreen'
import { __resetReferralSummaryCache } from '../../../hooks/useReferralSummary'

const now = new Date()
const iso = (d: Date) => d.toISOString()

beforeEach(() => {
  vi.clearAllMocks()
  __resetReferralSummaryCache()
  api.bonus = 15
  api.history = [
    { id: 't1', type: 'REFERRAL_BONUS', quantity: 5, description: 'Maria S. recebeu o 1º pedido', createdAt: iso(now) },
    { id: 't2', type: 'DELIVERY', quantity: -4, description: null, createdAt: iso(now) },
    { id: 't3', type: 'REFERRAL_GOAL', quantity: 10, description: 'Bônus pela 5ª indicação que valeu', createdAt: iso(new Date(now.getTime() - 3 * 86_400_000)) },
    { id: 't4', type: 'PURCHASE', quantity: 30, description: 'Compra de 30 pãezins', createdAt: iso(new Date(now.getTime() - 3 * 86_400_000)) },
  ]
  api.fetch.mockImplementation((path: string) => {
    if (path === '/credits/history') return Promise.resolve({ ok: true, json: () => Promise.resolve(api.history) })
    if (path === '/referrals/summary') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          active: true, hasReferrals: true, isNew: false, rewardBreads: 5, campaign: null,
          homeCard: { visible: false }, bonusThisMonth: api.bonus, celebration: null,
        }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  })
})

const renderScreen = () => render(<MemoryRouter><CreditHistoryScreen /></MemoryRouter>)

describe('CreditHistoryScreen (C7)', () => {
  it('cabeçalho espresso com o saldo e o bônus de indicação do mês', async () => {
    renderScreen()
    expect(await screen.findByText('+15 este mês')).toBeInTheDocument()
    expect(screen.getByText('SALDO').parentElement).toHaveTextContent('12,5 pãezins')
  })

  it('sem bônus no mês, o canto do cabeçalho não aparece', async () => {
    api.bonus = 0
    renderScreen()
    await screen.findByText('Indique e ganhe')
    expect(screen.queryByText(/este mês/)).toBeNull()
  })

  it('agrupa por dia (Hoje), título por tipo, descrição na 2ª linha, selo Bônus', async () => {
    renderScreen()
    const today = (await screen.findByRole('heading', { name: 'Hoje' })).closest('section')!
    expect(within(today).getByText('Indique e ganhe')).toBeInTheDocument()
    expect(within(today).getByText('Maria S. recebeu o 1º pedido')).toBeInTheDocument()
    expect(within(today).getByText('Bônus')).toBeInTheDocument()
    expect(within(today).getByText('Entrega')).toBeInTheDocument()
    expect(within(today).getByText('−4')).toBeInTheDocument()

    expect(screen.getByText('Meta de 5 indicações')).toBeInTheDocument()
    expect(screen.getByText('Compra de pãezins')).toBeInTheDocument()
    expect(screen.getAllByText('Bônus')).toHaveLength(2)
    expect(screen.getByText('Pãezins de bônus não viram dinheiro e não expiram.')).toBeInTheDocument()
  })

  it('a API chamada é a mesma de antes', async () => {
    renderScreen()
    await screen.findByText('Indique e ganhe')
    expect(api.fetch).toHaveBeenCalledWith('/credits/history')
  })
})
