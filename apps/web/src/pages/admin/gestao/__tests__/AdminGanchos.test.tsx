// AdminGanchos page tests
// Requirements: contagem de pendentes (GET /admin/hook-requests/summary) e impressão de cupom
// de entrega — um a um ou em lote por seleção múltipla.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))

import { AdminGanchos } from '../AdminGanchos'

const ana = {
  id: 'hook-01',
  userId: 'user-01',
  type: 'FREE',
  status: 'REQUESTED',
  reason: null,
  name: 'Ana Souza',
  phone: null,
  apartment: '302',
  block: 'B',
  complement: null,
  condominiumId: 'condo-01',
  condominiumName: 'Residencial Sol',
  requestedAt: '2026-06-12T12:00:00.000Z',
  deliveredAt: null,
}
const bruno = {
  ...ana,
  id: 'hook-02',
  userId: 'user-02',
  type: 'BONUS',
  name: 'Bruno Lima',
  apartment: '101',
  reason: 'reposição de cortesia',
}

function mockRespostas({ pending = 2, items = [ana, bruno] } = {}) {
  mockApiFetch.mockImplementation((url: string) => {
    if (url.startsWith('/admin/hook-requests/summary')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ pending }) })
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ items, total: items.length, page: 1, limit: 20 }),
    })
  })
}

describe('AdminGanchos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.print = vi.fn()
    mockRespostas()
  })

  it('mostra a contagem de solicitações pendentes', async () => {
    render(<AdminGanchos onBack={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('pendentes')).toBeDefined())
    // O número aparece no cabeçalho e no chip "Pendentes".
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
  })

  it('imprime o cupom de um gancho pelo botão do card', async () => {
    render(<AdminGanchos onBack={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Ana Souza')).toBeDefined())

    fireEvent.click(screen.getByLabelText('Imprimir cupom do gancho de Ana Souza'))

    await waitFor(() => expect(window.print).toHaveBeenCalledOnce())
    // O cupom sai com o endereço da porta; o outro cliente não entra na folha.
    expect(screen.getAllByText('Residencial Sol').length).toBeGreaterThan(0)
    expect(screen.getByText('Gancho de porta')).toBeDefined()
  })

  it('imprimir NÃO marca o gancho como entregue', async () => {
    render(<AdminGanchos onBack={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Ana Souza')).toBeDefined())

    fireEvent.click(screen.getByLabelText('Imprimir cupom do gancho de Ana Souza'))
    await waitFor(() => expect(window.print).toHaveBeenCalledOnce())

    const chamadas = mockApiFetch.mock.calls.map((c) => String(c[0]))
    expect(chamadas.some((u) => u.includes('/deliver'))).toBe(false)
  })

  it('seleciona vários e imprime o lote de cupons', async () => {
    render(<AdminGanchos onBack={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Ana Souza')).toBeDefined())

    fireEvent.click(screen.getByLabelText('Selecionar gancho de Ana Souza'))
    fireEvent.click(screen.getByLabelText('Selecionar gancho de Bruno Lima'))

    expect(screen.getByText('2 selecionados')).toBeDefined()
    fireEvent.click(screen.getByText('Imprimir 2 cupons'))

    await waitFor(() => expect(window.print).toHaveBeenCalledOnce())
    // Os dois cupons na mesma folha, com o motivo do bônus impresso.
    expect(screen.getAllByText('Gancho de porta').length).toBe(2)
    expect(screen.getAllByText('reposição de cortesia').length).toBeGreaterThan(0)
  })

  it('"Selecionar todos" cobre o que está carregado e "Limpar" desfaz', async () => {
    render(<AdminGanchos onBack={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Ana Souza')).toBeDefined())

    fireEvent.click(screen.getByText('Selecionar os 2 carregados'))
    expect(screen.getByText('2 selecionados')).toBeDefined()

    fireEvent.click(screen.getByText('Limpar'))
    expect(screen.queryByText('2 selecionados')).toBeNull()
  })

  it('clicar no card abre o cliente; as ações do card não abrem', async () => {
    const abertos: string[] = []
    const ouvir = (e: Event) => abertos.push((e as CustomEvent<{ clientId: string }>).detail.clientId)
    window.addEventListener('cdp:open-admin-client', ouvir)
    try {
      render(<AdminGanchos onBack={vi.fn()} />)
      await waitFor(() => expect(screen.getByText('Ana Souza')).toBeDefined())

      // O botão "Ver cliente" com texto saiu: o card inteiro abre o cliente.
      expect(screen.queryByText('Ver cliente')).toBeNull()

      fireEvent.click(screen.getByLabelText('Selecionar gancho de Ana Souza'))
      fireEvent.click(screen.getByLabelText('Imprimir cupom do gancho de Ana Souza'))
      fireEvent.click(screen.getAllByRole('button', { name: /Enviar na rota/ })[0])
      fireEvent.click(screen.getAllByRole('button', { name: /Marcar entregue/ })[0])
      expect(abertos).toEqual([])

      // Pelo nome (caminho do teclado e do leitor de tela) e por qualquer ponto do card.
      fireEvent.click(screen.getByRole('button', { name: 'Ver cliente Ana Souza' }))
      fireEvent.click(screen.getByText('reposição de cortesia'))
      expect(abertos).toEqual(['user-01', 'user-02'])
    } finally {
      window.removeEventListener('cdp:open-admin-client', ouvir)
    }
  })

  it('trocar de filtro limpa a seleção pendente', async () => {
    render(<AdminGanchos onBack={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Ana Souza')).toBeDefined())

    fireEvent.click(screen.getByLabelText('Selecionar gancho de Ana Souza'))
    expect(screen.getByText('1 selecionado')).toBeDefined()

    fireEvent.click(screen.getByText('Entregues'))

    await waitFor(() => expect(screen.queryByText('1 selecionado')).toBeNull())
  })
})

describe('AdminGanchos — gancho na rota (A7)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('na rota, voltou para a fila e entregue pelo entregador; "Tirar da rota" chama o DELETE', async () => {
    const naRota = { ...ana, routeState: 'rota', route: { date: '2026-10-03', slotId: 'manha', slotLabel: '☀️ Manhã', courierName: 'Antônio Ribeiro', overdue: false } }
    const volta = { ...bruno, routeState: 'volta', routeFailedAt: '2026-10-01T09:00:00.000Z' }
    mockRespostas({ items: [naRota, volta] as never })
    render(<AdminGanchos onBack={vi.fn()} />)
    expect(await screen.findByText('🪝 Na rota de 03/10 · ☀️ Manhã · Antônio')).toBeDefined()
    expect(screen.getByText('Na rota')).toBeDefined()
    expect(screen.getByText(/Ficou para outro dia .* · voltou para a fila/)).toBeDefined()
    expect(screen.getByText('Não entregue na rota')).toBeDefined()
    expect(screen.getByRole('button', { name: /Enviar na rota/ })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Tirar da rota/ }))
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/admin/hook-requests/hook-01/route', { method: 'DELETE' }))
  })

  it('gancho sozinho na rota e motivo da volta para a fila', async () => {
    const sozinho = { ...ana, routeState: 'rota', route: { date: '2026-10-08', slotId: 'manha', slotLabel: '☀️ Manhã', courierName: 'Antônio Ribeiro', overdue: false, alone: true } }
    const volta = { ...bruno, routeState: 'volta', routeFailedAt: '2026-10-01T12:00:00.000Z', routeFailedReason: 'Cliente ausente' }
    mockRespostas({ items: [sozinho, volta] as never })
    render(<AdminGanchos onBack={vi.fn()} />)
    expect(await screen.findByText('🪝 Na rota de 08/10 · ☀️ Manhã · Antônio · só o gancho')).toBeDefined()
    expect(screen.getByText(/Ficou para outro dia \(.* · Cliente ausente\) · voltou para a fila/)).toBeDefined()
  })
})
