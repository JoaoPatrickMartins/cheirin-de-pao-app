// A4 — Indicações: chips com a contagem "em análise", cards com sinais, vazio por filtro, e o
// detalhe (sheet) com as ações só em análise — aprovar com confirmação, recusar com motivo + detalhe.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))

import { IndicacoesLista } from '../IndicacoesLista'

const julia = {
  id: 'r1',
  state: 'analise',
  referrer: { id: 'u1', name: 'João Silva' },
  referred: { id: 'u2', name: 'Júlia Ramos' },
  createdAt: '2026-09-18T12:12:00.000Z',
  condo: 'Parque das Flores',
  signals: ['Mesmo apartamento'],
}

const list = {
  items: [julia],
  counts: { analise: 3, aguardando: 9, ganhou: 17, recusada: 2, expirou: 3, todas: 34 },
  total: 1,
  page: 1,
  pageSize: 20,
}

const detail = {
  id: 'r1',
  state: 'analise',
  referrer: { id: 'u1', name: 'João Silva' },
  referred: { id: 'u2', name: 'Júlia Ramos' },
  condo: 'Parque das Flores',
  signals: ['Mesmo apartamento'],
  code: 'JOAO7K2F',
  source: 'LINK',
  rewardBreads: 5,
  welcomeBreads: 3,
  campaignLabel: null,
  timeline: {
    cadastro: '2026-09-18T12:12:00.000Z',
    login: '2026-09-18T12:20:00.000Z',
    pagamento: '2026-09-20T00:40:00.000Z',
    entrega: '2026-09-20T09:31:00.000Z',
    recompensa: null,
  },
  reviewedAt: null,
  rejectReason: null,
  rejectDetail: null,
  expiresAt: null,
}

type Handler = (url: string, init?: { method?: string; body?: string }) => { ok: boolean; status?: number; body: unknown } | undefined

function respond(extra?: Handler) {
  api.fetch.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
    const custom = extra?.(url, init)
    const r = custom ?? (url.startsWith('/admin/referrals?') ? { ok: true, body: list } : url === '/admin/referrals/r1' ? { ok: true, body: detail } : { ok: true, body: { ok: true } })
    return Promise.resolve({ ok: r.ok, status: r.status ?? (r.ok ? 200 : 409), json: () => Promise.resolve(r.body) })
  })
}

async function openDetail() {
  fireEvent.click(await screen.findByRole('button', { name: /João Silva indicou Júlia Ramos/ }))
  return screen.findByRole('dialog')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('IndicacoesLista (A4)', () => {
  it('abre em "Em análise" com a contagem no chip; card com estado, data · condomínio e sinais', async () => {
    respond()
    render(<IndicacoesLista />)
    const card = await screen.findByRole('button', { name: /João Silva indicou Júlia Ramos/ })
    expect(api.fetch.mock.calls[0][0]).toBe('/admin/referrals?state=analise&page=1')
    const chip = screen.getByRole('button', { name: /Em análise/ })
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    expect(within(chip).getByText('3')).toBeDefined()
    expect(within(card).getByText('Em análise')).toBeDefined()
    expect(within(card).getByText('18/09 · Parque das Flores')).toBeDefined()
    expect(within(card).getByText('Mesmo apartamento')).toBeDefined()
  })

  it('vazio por filtro', async () => {
    respond((url) => (url.startsWith('/admin/referrals?') ? { ok: true, body: { ...list, items: [], total: 0 } } : undefined))
    render(<IndicacoesLista />)
    await screen.findByText('Nada por aqui')
    fireEvent.click(screen.getByRole('button', { name: 'Recusadas' }))
    await waitFor(() => expect(screen.getByText('Nenhuma indicação recusada no momento.')).toBeDefined())
    expect(api.fetch).toHaveBeenLastCalledWith('/admin/referrals?state=recusada&page=1')
  })

  it('busca pelo nome vai na query', async () => {
    respond()
    render(<IndicacoesLista />)
    await screen.findByRole('button', { name: /João Silva indicou/ })
    fireEvent.change(screen.getByLabelText('Buscar indicação por nome'), { target: { value: 'júlia' } })
    await waitFor(() => expect(api.fetch).toHaveBeenLastCalledWith('/admin/referrals?state=analise&page=1&q=j%C3%BAlia'))
  })

  it('detalhe: pessoas, sinais, valores congelados e "aguardando você" na linha do tempo', async () => {
    respond()
    render(<IndicacoesLista />)
    const dialog = await openDetail()
    await within(dialog).findByText('Valores congelados no momento do cadastro')
    expect(within(dialog).getByRole('button', { name: /Quem indicou: João Silva/ })).toBeDefined()
    expect(within(dialog).getByText('+5')).toBeDefined()
    expect(within(dialog).getByText('+3')).toBeDefined()
    expect(within(dialog).getByText('aguardando você')).toBeDefined()
    expect(within(dialog).getByText('18/09 09:12')).toBeDefined()
  })

  it('aprovar: confirma quem ganha o quê, chama a API e mostra o sucesso', async () => {
    const onChanged = vi.fn()
    respond()
    render(<IndicacoesLista onChanged={onChanged} />)
    const dialog = await openDetail()
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Aprovar' }))
    expect(within(dialog).getByText('João ganha +5 e Júlia ganha +3 agora. As duas pessoas recebem uma notificação.')).toBeDefined()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aprovar' }))
    await within(dialog).findByText('Aprovada. +5 pãezins para João e +3 para Júlia.')
    expect(api.fetch).toHaveBeenCalledWith('/admin/referrals/r1/approve', expect.objectContaining({ method: 'POST' }))
    expect(onChanged).toHaveBeenCalled()
  })

  it('recusar: exige motivo e detalhe; manda os dois', async () => {
    respond()
    render(<IndicacoesLista />)
    const dialog = await openDetail()
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Recusar' }))
    expect(within(dialog).getByText('O motivo fica só aqui. O cliente vê apenas "Não valeu".')).toBeDefined()
    // O primeiro sinal ("Mesmo apartamento") já sugere o motivo.
    expect(within(dialog).getByRole('radio', { name: 'Mesma residência' }).getAttribute('aria-checked')).toBe('true')
    const confirm = within(dialog).getAllByRole('button', { name: 'Recusar' }).at(-1) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.change(within(dialog).getByLabelText('Detalhe da recusa (obrigatório)'), {
      target: { value: 'Mesmo apartamento do indicador (Bl. B 42).' },
    })
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    await within(dialog).findByText('Recusada. O cliente vê apenas "Não valeu".')
    const call = api.fetch.mock.calls.find(([url]) => url === '/admin/referrals/r1/reject')!
    expect(JSON.parse(call[1].body)).toEqual({ reason: 'SAME_RESIDENCE', detail: 'Mesmo apartamento do indicador (Bl. B 42).' })
  })

  it('aguardando não tem ações (D-12)', async () => {
    respond((url) => (url === '/admin/referrals/r1' ? { ok: true, body: { ...detail, state: 'aguardando', signals: [] } } : undefined))
    render(<IndicacoesLista />)
    const dialog = await openDetail()
    await within(dialog).findByText('Valores congelados no momento do cadastro')
    expect(within(dialog).queryByRole('button', { name: 'Aprovar' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Recusar' })).toBeNull()
  })

  it('recusada mostra o motivo e o detalhe (só o admin vê)', async () => {
    respond((url) =>
      url === '/admin/referrals/r1'
        ? {
            ok: true,
            body: { ...detail, state: 'recusada', rejectReason: 'SAME_DEVICE', rejectDetail: 'Mesmo celular.', reviewedAt: '2026-09-21T13:00:00.000Z' },
          }
        : undefined,
    )
    render(<IndicacoesLista />)
    const dialog = await openDetail()
    expect(await within(dialog).findByText('MOTIVO DA RECUSA')).toBeDefined()
    expect(within(dialog).getByText('Mesmo aparelho')).toBeDefined()
    expect(within(dialog).getByText('Mesmo celular.')).toBeDefined()
  })

  it('outro admin decidiu antes (409): mostra o aviso e recarrega', async () => {
    respond((url) => (url === '/admin/referrals/r1/approve' ? { ok: false, status: 409, body: { error: 'Esta indicação não está mais em análise.' } } : undefined))
    render(<IndicacoesLista />)
    const dialog = await openDetail()
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Aprovar' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aprovar' }))
    await within(dialog).findByText('Esta indicação não está mais em análise.')
  })

  it('tocar numa pessoa abre o cliente (evento do AdminLayout)', async () => {
    respond()
    const listener = vi.fn()
    window.addEventListener('cdp:open-admin-client', listener)
    render(<IndicacoesLista />)
    const dialog = await openDetail()
    fireEvent.click(await within(dialog).findByRole('button', { name: /Quem veio pela indicação: Júlia Ramos/ }))
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ clientId: 'u2' })
    window.removeEventListener('cdp:open-admin-client', listener)
  })
})
