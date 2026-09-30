// A7 — Pedidos de novos condomínios: grupos com "N por indicação", o 1º aberto, contatos, e
// "Marcar como tratado" / "Reabrir" do grupo inteiro (tratado esmaecido com selo verde).
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: api.fetch }))

import { CondoInterestsSection } from '../CondoInterestsSection'

const groups = [
  {
    key: 'solar|campinas',
    name: 'Condomínio Solar das Palmeiras',
    city: 'Campinas',
    count: 2,
    viaReferral: 1,
    handled: false,
    lastAt: '2026-09-24T15:00:00.000Z',
    contacts: [
      { id: 'i2', name: 'Luciana P.', email: 'luciana@email.com', phone: null, createdAt: '2026-09-24T15:00:00.000Z', viaReferral: true },
      { id: 'i1', name: 'Roberto K.', email: null, phone: '19981234400', createdAt: '2026-09-22T15:00:00.000Z', viaReferral: false },
    ],
  },
  {
    key: 'acacias|sumare',
    name: 'Vila das Acácias',
    city: 'Sumaré',
    count: 1,
    viaReferral: 0,
    handled: true,
    lastAt: '2026-09-02T15:00:00.000Z',
    contacts: [{ id: 'i3', name: 'Helena F.', email: null, phone: '19988001122', createdAt: '2026-09-02T15:00:00.000Z', viaReferral: false }],
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  api.fetch.mockImplementation((_url: string, init?: { method?: string }) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(init?.method === 'PATCH' ? { ok: true } : { groups }) }),
  )
})

describe('CondoInterestsSection (A7)', () => {
  it('grupos com pedidos, "por indicação" e o 1º aberto com os contatos', async () => {
    render(<CondoInterestsSection />)
    expect(await screen.findByText('Pedidos de novos condomínios')).toBeDefined()
    expect(screen.getByText('Campinas · 2 pedidos')).toBeDefined()
    expect(screen.getByText('1 por indicação')).toBeDefined()
    expect(screen.getByText('Sumaré · 1 pedido')).toBeDefined()
    expect(screen.getByText('Tratado')).toBeDefined()
    // 1º grupo aberto: contatos, "por indicação" e o celular formatado.
    expect(screen.getByText('luciana@email.com')).toBeDefined()
    expect(screen.getByText('· por indicação')).toBeDefined()
    expect(screen.getByText('(19) 9 8123-4400')).toBeDefined()
    expect(screen.queryByText('Helena F.')).toBeNull()
  })

  it('"Marcar como tratado" grava o grupo e vira "Reabrir"', async () => {
    render(<CondoInterestsSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como tratado' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reabrir' })).toBeDefined())
    const patch = api.fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(patch[0]).toBe('/admin/condominiums/interests/handled')
    expect(JSON.parse(patch[1].body)).toEqual({ groupKey: 'solar|campinas', handled: true })
  })

  it('abrir outro grupo mostra os contatos dele (aria-expanded)', async () => {
    render(<CondoInterestsSection />)
    const header = await screen.findByRole('button', { name: /Vila das Acácias/ })
    expect(header.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(header)
    expect(header.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Helena F.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeDefined()
  })

  it('sem pedidos ainda', async () => {
    api.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ groups: [] }) })
    render(<CondoInterestsSection />)
    expect(await screen.findByText('Nenhum pedido por enquanto.')).toBeDefined()
  })
})
