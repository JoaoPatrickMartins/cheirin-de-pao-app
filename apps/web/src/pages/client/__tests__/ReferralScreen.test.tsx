// C1 — Indique e ganhe: os 8 estados do handoff saem dos dados de GET /referrals/me.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { ReferralMe } from '../../../lib/referral'

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))

import { ReferralScreen } from '../ReferralScreen'

const base: ReferralMe = {
  state: 'active',
  code: 'JOAO7K2F',
  messageTemplate: 'Cadastra com o meu código {codigo} e ganha {bonus} pãezins no primeiro pedido: {link}',
  referrerFirstName: 'João',
  rewardBreads: 5,
  baseRewardBreads: 5,
  welcomeBreads: 3,
  campaign: null,
  rules: { prazoDias: 60, compraMinima: 0 },
  stats: { earnedBreads: 15, valeram: 2, emAndamento: 1 },
  goals: {
    count: 2,
    milestones: [{ quantidade: 5, bonus: 10, reached: false, paid: false }],
    justHit: null,
    next: { quantidade: 5, bonus: 10 },
  },
  referrals: [
    { id: 'r1', name: 'Maria S.', state: 'ganhou', date: '2026-09-12T12:00:00.000Z', rewardBreads: 5, campaign: false },
    { id: 'r2', name: 'Pedro A.', state: 'ganhou', date: '2026-09-03T12:00:00.000Z', rewardBreads: 10, campaign: true },
    { id: 'r3', name: 'Ana L.', state: 'aguardando', date: '2026-09-20T12:00:00.000Z', rewardBreads: null, campaign: false },
  ],
}

function respond(data: ReferralMe | null, ok = true) {
  api.fetch.mockImplementation(() =>
    Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(data) }),
  )
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <ReferralScreen />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReferralScreen (C1)', () => {
  it('loading → skeleton, sem conteúdo', () => {
    api.fetch.mockImplementation(() => new Promise(() => {}))
    const { container } = renderScreen()
    expect(container.querySelectorAll('.cdp-shimmer').length).toBeGreaterThan(3)
    expect(screen.queryByText(/Indique um vizinho/)).toBeNull()
  })

  it('error → "Não conseguimos carregar" + Tentar de novo refaz a chamada', async () => {
    respond(null, false)
    renderScreen()
    expect(await screen.findByText('Não conseguimos carregar')).toBeInTheDocument()
    respond(base)
    fireEvent.click(screen.getByRole('button', { name: /tentar de novo/i }))
    expect(await screen.findByText(/Indique um vizinho e ganhe/)).toBeInTheDocument()
    expect(api.fetch).toHaveBeenCalledTimes(2)
  })

  it('full → código, compartilhar, resumo, metas, lista com estados e "Só você vê"', async () => {
    respond(base)
    renderScreen()
    expect(await screen.findByRole('img', { name: 'Código J O A O 7 K 2 F' })).toBeInTheDocument()
    expect(screen.getByText(/Seu amigo ganha/)).toBeInTheDocument()
    expect(screen.getByText('Só você vê')).toBeInTheDocument()
    expect(screen.getByText('Ganhou +5')).toBeInTheDocument()
    expect(screen.getByText('Aguardando 1º pedido')).toBeInTheDocument()
    expect(screen.getByText('em dobro')).toBeInTheDocument()
    expect(screen.getByText('pãezins ganhos')).toBeInTheDocument()
    expect(screen.getByText(/Faltam 3 indicações para ganhar/)).toBeInTheDocument()

    // WhatsApp com a mensagem montada no app (link com a origem de quem abriu)
    const wa = screen.getByRole('link', { name: /enviar no whatsapp/i })
    const text = decodeURIComponent(new URL(wa.getAttribute('href')!).searchParams.get('text')!)
    expect(text).toBe(`Cadastra com o meu código JOAO7K2F e ganha 3 pãezins no primeiro pedido: ${window.location.origin}/?ref=JOAO7K2F`)
  })

  it('empty → "Sua lista começa aqui" e "Como funciona" sobe para antes da lista', async () => {
    respond({ ...base, referrals: [], stats: { earnedBreads: 0, valeram: 0, emAndamento: 0 }, goals: { ...base.goals, count: 0 } })
    renderScreen()
    expect(await screen.findByText('Sua lista começa aqui')).toBeInTheDocument()
    const how = screen.getByRole('heading', { name: 'Como funciona' })
    const list = screen.getByRole('heading', { name: 'Seus indicados' })
    expect(how.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('Seu resumo')).toBeNull()
    expect(screen.queryByText(/Faltam/)).toBeNull()
  })

  it('campaign → selo no hero e "Em vez de 5…"', async () => {
    respond({ ...base, rewardBreads: 10, campaign: { label: 'Semana em dobro', until: '2026-10-11' } })
    renderScreen()
    expect(await screen.findByText('Semana em dobro · até 11/10')).toBeInTheDocument()
    expect(screen.getByText('10 pãezins')).toBeInTheDocument()
    expect(screen.getByText('Em vez de 5, para quem indicar até 11/10.')).toBeInTheDocument()
  })

  it('goal → "Meta atingida!" e a próxima', async () => {
    respond({
      ...base,
      goals: {
        count: 5,
        milestones: [
          { quantidade: 5, bonus: 10, reached: true, paid: true },
          { quantidade: 10, bonus: 25, reached: false, paid: false },
        ],
        justHit: { quantidade: 5, bonus: 10 },
        next: { quantidade: 10, bonus: 25 },
      },
    })
    renderScreen()
    expect(await screen.findByText(/Meta atingida!/)).toBeInTheDocument()
    expect(screen.getByText('Próxima: +25 na 10ª indicação.')).toBeInTheDocument()
  })

  it('nobonus → sem a linha do amigo; passo 3 = "Você ganha"', async () => {
    respond({ ...base, welcomeBreads: 0 })
    renderScreen()
    await screen.findByText(/Indique um vizinho e ganhe/)
    expect(screen.queryByText(/Seu amigo ganha/)).toBeNull()
    expect(screen.getByText('O pão chegou? Você ganha')).toBeInTheDocument()
    expect(screen.getByText('+5 pãezins caem no seu saldo na hora.')).toBeInTheDocument()
  })

  it('paused → hero pausado, sem código, sem compartilhar, sem metas; resumo + lista + regras', async () => {
    respond({ ...base, state: 'paused', code: null })
    renderScreen()
    expect(await screen.findByText('O programa está pausado')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Código/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /whatsapp/i })).toBeNull()
    expect(screen.queryByText(/Faltam/)).toBeNull()
    expect(screen.getByText('Seu resumo')).toBeInTheDocument()
    expect(screen.getByText('Maria S.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regras' })).toBeInTheDocument()
  })

  it('Regras abre e fecha (aria-expanded) com o prazo e a compra mínima', async () => {
    respond({ ...base, rules: { prazoDias: 30, compraMinima: 15 } })
    renderScreen()
    const toggle = await screen.findByRole('button', { name: 'Regras' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const list = document.getElementById('ref-rules')!
    expect(within(list).getByText(/30 dias, a partir do cadastro/)).toBeInTheDocument()
    expect(within(list).getByText(/pelo menos R\$\s?15,00/)).toBeInTheDocument()
  })

  it('pede GET /referrals/me', async () => {
    respond(base)
    renderScreen()
    await waitFor(() => expect(api.fetch).toHaveBeenCalledWith('/referrals/me'))
  })
})
