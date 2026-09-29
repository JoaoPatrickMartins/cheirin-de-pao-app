// A6 — Relatório "Indicações": KPIs, custo estimado, funil com % de passagem, custo × receita,
// top 5 e estados; vazio no período; atalho `trend` do hub (A2) abre e volta.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))

import { RelIndicacoes } from '../RelIndicacoes'
import { AdminIndicacao } from '../AdminIndicacao'

const report = {
  window: { from: '2026-09-01T03:00:00.000Z', to: '2026-10-01T02:59:59.999Z', label: 'setembro de 2026', isPartial: true },
  signups: 38,
  rewarded: 17,
  conversion: 17 / 38,
  breads: { referrer: 85, friends: 51, total: 136 },
  unitPrice: 1,
  cost: { referrer: 85, friends: 51, total: 136 },
  revenue: 1920,
  revenuePerReal: 14.12,
  funnel: { visits: 240, signups: 38, verified: 31, rewarded: 17 },
  top: [
    { id: 'u1', name: 'João Silva', rewarded: 7, earnedBreads: 45 },
    { id: 'u2', name: 'Fernanda Lima', rewarded: 5, earnedBreads: 35 },
  ],
  byState: { cadastro: 4, aguardando: 9, analise: 3, ganhou: 17, recusada: 2, expirou: 3 },
  caveats: ['Funil, conversão e estados contam as indicações CADASTRADAS no período.'],
}

function respond(body: unknown) {
  api.fetch.mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(url.startsWith('/admin/reports/referrals') ? body : url === '/admin/referrals/summary' ? { pendingReview: 0 } : {}),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RelIndicacoes (A6)', () => {
  it('KPIs, custo com a divisão, funil com passagem, "cada R$ 1", top 5 e estados', async () => {
    respond(report)
    render(<RelIndicacoes onBack={vi.fn()} />)
    await screen.findByText('Cadastros por indicação')
    expect(api.fetch.mock.calls[0][0]).toMatch(/^\/admin\/reports\/referrals\?/)
    // Conversão 17/38 — o mesmo 45% aparece também na legenda de estados (recompensadas).
    expect(within(screen.getByText('Conversão').parentElement!).getByText('45%')).toBeDefined()
    expect(within(screen.getByText('Pãezins concedidos').parentElement!).getByText('136')).toBeDefined()
    expect(screen.getByText('85 para quem indicou · 51 para amigos')).toBeDefined()
    expect(screen.getByText(/· 16%/)).toBeDefined() // 38/240
    expect(screen.getByText(/Cada R\$ 1 em bônus trouxe/)).toBeDefined()
    expect(screen.getByText('João Silva')).toBeDefined()
    expect(screen.getByText('+45')).toBeDefined()
    expect(screen.getByText('Recompensada')).toBeDefined()
    expect(screen.getByText('Em análise')).toBeDefined()
  })

  it('sem nada no período → estado vazio', async () => {
    respond({
      ...report,
      signups: 0,
      rewarded: 0,
      conversion: null,
      breads: { referrer: 0, friends: 0, total: 0 },
      cost: { referrer: 0, friends: 0, total: 0 },
      revenue: 0,
      revenuePerReal: null,
      funnel: { visits: 0, signups: 0, verified: 0, rewarded: 0 },
      top: [],
      byState: { cadastro: 0, aguardando: 0, analise: 0, ganhou: 0, recusada: 0, expirou: 0 },
    })
    render(<RelIndicacoes onBack={vi.fn()} />)
    expect(await screen.findByText('Sem indicações no período')).toBeDefined()
    expect(screen.getByText('Tente um período maior ou crie uma campanha para movimentar.')).toBeDefined()
  })

  it('o atalho do hub (A2) abre o relatório e o voltar devolve ao hub', async () => {
    respond(report)
    render(<AdminIndicacao onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Relatório de indicações' }))
    await screen.findByText('Cadastros por indicação')
    fireEvent.click(screen.getAllByRole('button', { name: 'Voltar' })[0])
    expect(within(screen.getByRole('tablist')).getByRole('tab', { name: 'Configuração' })).toBeDefined()
  })
})
