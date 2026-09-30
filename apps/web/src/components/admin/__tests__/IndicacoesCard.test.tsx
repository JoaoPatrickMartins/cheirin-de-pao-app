// A5 — Detalhe do cliente: linha "Indicação de" / "Vincular indicação", card de indicações e o
// sheet de vínculo manual (válido, inválido, próprio cliente, sucesso).
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))

import { IndicacoesCard, ReferredByRow, type ClientReferrals } from '../IndicacoesCard'
import { VincularIndicacaoSheet } from '../VincularIndicacaoSheet'

const data: ClientReferrals = {
  active: true,
  code: 'MARI4P9Q',
  referredBy: null,
  stats: { fez: 4, valeram: 1, earnedBreads: 15 },
  referrals: [
    { id: 'r1', name: 'Ana Lopes', createdAt: '2026-09-20T15:30:00.000Z', state: 'aguardando' },
    { id: 'r2', name: 'Rafael Teixeira', createdAt: '2026-07-10T17:22:00.000Z', state: 'expirou' },
  ],
}

function json(body: unknown, ok = true, status = ok ? 200 : 422) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReferredByRow', () => {
  it('com indicador: "Indicação de João Silva" abre o cliente', () => {
    const onOpenClient = vi.fn()
    render(
      <ReferredByRow
        data={{ ...data, referredBy: { id: 'u1', name: 'João Silva', state: 'ganhou' } }}
        onOpenClient={onOpenClient}
        onLink={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Indicação de João Silva/ }))
    expect(onOpenClient).toHaveBeenCalledWith('u1')
    expect(screen.queryByText('Vincular indicação')).toBeNull()
  })

  it('sem indicador: a linha vira a ação "Vincular indicação"', () => {
    const onLink = vi.fn()
    render(<ReferredByRow data={data} onOpenClient={vi.fn()} onLink={onLink} />)
    fireEvent.click(screen.getByRole('button', { name: 'Vincular indicação' }))
    expect(onLink).toHaveBeenCalled()
  })

  it('programa desligado e sem indicador: nada aparece', () => {
    const { container } = render(<ReferredByRow data={{ ...data, active: false }} onOpenClient={vi.fn()} onLink={vi.fn()} />)
    expect(container.textContent).toBe('')
  })
})

describe('IndicacoesCard', () => {
  it('código, fez / valeram / pãezins ganhos e a lista com o estado do admin', () => {
    render(<IndicacoesCard data={data} />)
    expect(screen.getByText('código MARI4P9Q')).toBeDefined()
    expect(screen.getByText('4')).toBeDefined()
    expect(screen.getByText('15')).toBeDefined()
    expect(screen.getByText('pãezins ganhos')).toBeDefined()
    expect(screen.getByText('Ana Lopes')).toBeDefined()
    expect(screen.getByText('Aguardando')).toBeDefined()
    expect(screen.getByText('Expirada')).toBeDefined()
  })

  it('sem indicações ainda', () => {
    render(<IndicacoesCard data={{ ...data, referrals: [], stats: { fez: 0, valeram: 0, earnedBreads: 0 } }} />)
    expect(screen.getByText('Nenhuma indicação ainda.')).toBeDefined()
  })
})

describe('VincularIndicacaoSheet', () => {
  const renderSheet = (onLinked = vi.fn()) =>
    render(<VincularIndicacaoSheet clientId="c1" clientName="Maria Souza" onClose={vi.fn()} onLinked={onLinked} />)
  const type = (v: string) => fireEvent.change(screen.getByRole('textbox'), { target: { value: v } })
  const confirmBtn = () => screen.getByRole('button', { name: 'Confirmar' }) as HTMLButtonElement

  it('válido: mostra o dono e o que acontece; confirma e vincula', async () => {
    const onLinked = vi.fn()
    api.fetch.mockImplementation((url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') return json({ ok: true, outcome: 'PENDING', referredBy: { id: 'u1', name: 'João Silva' } })
      return json({ valid: true, self: false, owner: { name: 'João Silva', condo: 'Parque das Flores' } })
    })
    renderSheet(onLinked)
    expect(confirmBtn().disabled).toBe(true)
    type('joao7k2f')
    await screen.findByText(/Ao confirmar, a indicação entra como "Aguardando 1º pedido"/)
    expect(screen.getByText(/se Maria já recebeu a 1ª entrega/)).toBeDefined()
    expect(api.fetch.mock.calls[0][0]).toBe('/admin/clients/c1/referral-code-check?code=JOAO7K2F')
    fireEvent.click(confirmBtn())
    await screen.findByText(/Vinculado! Agora Maria aparece com a indicação de João Silva\./)
    const post = api.fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(post[0]).toBe('/admin/clients/c1/referral')
    expect(JSON.parse(post[1].body)).toEqual({ code: 'JOAO7K2F' })
    expect(onLinked).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeDefined()
  })

  it('inválido: aviso e Confirmar travado', async () => {
    api.fetch.mockImplementation(() => json({ valid: false, self: false, owner: null }))
    renderSheet()
    type('JOAO7K2X')
    await screen.findByText('Código não encontrado. Confira as letras com o cliente.')
    expect(confirmBtn().disabled).toBe(true)
  })

  it('próprio cliente: ninguém indica a si mesmo', async () => {
    api.fetch.mockImplementation(() => json({ valid: false, self: true, owner: null }))
    renderSheet()
    type('MARI4P9Q')
    await screen.findByText('Esse é o código de Maria. Ninguém pode indicar a si mesmo.')
    expect(confirmBtn().disabled).toBe(true)
  })

  it('código curto não consulta; erro do servidor no vínculo aparece', async () => {
    api.fetch.mockImplementation((url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') return json({ error: 'Este cliente já tem uma indicação.' }, false, 409)
      return json({ valid: true, self: false, owner: { name: 'João Silva', condo: null } })
    })
    renderSheet()
    type('JOA')
    await new Promise((r) => setTimeout(r, 450))
    expect(api.fetch).not.toHaveBeenCalled()
    type('JOAO7K2F')
    await waitFor(() => expect(confirmBtn().disabled).toBe(false))
    fireEvent.click(confirmBtn())
    await screen.findByText('Este cliente já tem uma indicação.')
  })
})
