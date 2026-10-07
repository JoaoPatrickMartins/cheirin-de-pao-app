// C2 do plano do entregador — comprovante para o cliente: motivo da não entrega, bloco
// "Comprovante" com a foto, câmera no histórico, "foto expirada" e o link do aviso (?comprovante=).
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))

const mockUseOrderTracking = vi.hoisted(() => vi.fn())
vi.mock('../../../hooks/useOrderTracking', () => ({ useOrderTracking: mockUseOrderTracking }))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ updateCreditBalance: vi.fn(), user: { condominiumName: 'Residencial Jardins', apartment: '101' } }),
}))

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

import { TrackingScreen } from '../TrackingScreen'

const today = new Date().toISOString()
// 09:12Z = 06:12 em Brasília
const deliveredAtToday = `${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })}T09:12:00.000Z`
const order = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  status: 'DELIVERED',
  quantity: 4,
  scheduledDate: today,
  proof: { available: false, expired: false },
  ...over,
})
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
const notFound = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: 'x' }) })

let history: unknown[] = []
let market: unknown[] = []
beforeEach(() => {
  vi.clearAllMocks()
  history = []
  market = []
  mockApiFetch.mockImplementation((url: string) => {
    if (url.startsWith('/orders/history')) return ok(history)
    if (url === '/market/orders/history') return ok(market)
    if (url === '/orders/o1/proof' || url === '/orders/h1/proof' || url === '/market/orders/m1/proof') {
      return ok({ url: 'https://s3/signed/deliveries/abc.jpg', at: deliveredAtToday, outcome: 'DELIVERED' })
    }
    if (url.endsWith('/proof')) return notFound()
    return ok([])
  })
})

const renderAt = (path = '/client/pedidos') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TrackingScreen />
    </MemoryRouter>,
  )

describe('TrackingScreen — comprovante (C2)', () => {
  it('não entrega com motivo: "Tentamos entregar às HH:MM — motivo."', () => {
    mockUseOrderTracking.mockReturnValue({
      order: order({ status: 'NOT_DELIVERED', failedAt: '2026-10-01T08:52:00.000Z', failureText: 'não conseguimos acesso pela portaria' }),
      isToday: true,
    })
    renderAt()
    expect(screen.getByText('Tentamos entregar às 05:52 — não conseguimos acesso pela portaria.')).toBeDefined()
  })

  it('entrega com foto: bloco "Comprovante" → tela cheia com "Fale com o suporte"', async () => {
    mockUseOrderTracking.mockReturnValue({ order: order({ proof: { available: true, expired: false } }), isToday: true })
    renderAt()
    const card = await screen.findByRole('button', { name: /Entregue às 06:12/ })
    expect(within(card).getByText('Foto da porta · toque para ver')).toBeDefined()
    fireEvent.click(card)
    const viewer = await screen.findByRole('dialog', { name: 'Seu pãozin chegou' })
    expect(within(viewer).getByText('Hoje, 06:12 · Residencial Jardins · Apto 101')).toBeDefined()
    expect(within(viewer).getByRole('link', { name: 'Fale com o suporte' }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\//)
    fireEvent.click(within(viewer).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('sem foto liberada, o bloco não aparece (nem a busca da foto)', async () => {
    mockUseOrderTracking.mockReturnValue({ order: order(), isToday: true })
    renderAt()
    await screen.findByText('Histórico')
    expect(screen.queryByText('Comprovante')).toBeNull()
    expect(mockApiFetch.mock.calls.some(([u]) => String(u).endsWith('/proof'))).toBe(false)
  })

  it('foto expirada no dia: aviso dos 90 dias', () => {
    mockUseOrderTracking.mockReturnValue({ order: order({ proof: { available: false, expired: true } }), isToday: true })
    renderAt()
    expect(screen.getByText('O comprovante fica disponível por 90 dias.')).toBeDefined()
  })

  it('histórico: câmera "Ver foto" no pão e na Cestinha; "foto expirada" no antigo', async () => {
    mockUseOrderTracking.mockReturnValue({ order: null, isToday: false })
    history = [
      { id: 'h1', status: 'DELIVERED', quantity: 4, scheduledDate: today, type: 'SCHEDULED', proof: { available: true, expired: false } },
      { id: 'h2', status: 'DELIVERED', quantity: 4, scheduledDate: '2026-06-26T15:00:00.000Z', type: 'SCHEDULED', proof: { available: false, expired: true } },
    ]
    market = [
      {
        id: 'm1',
        status: 'DELIVERED',
        // A Cestinha vem com a data pura (YYYY-MM-DD).
        scheduledDate: today.slice(0, 10),
        slotId: 'manha',
        deliveryTime: '06:30',
        breadQty: 0,
        items: [{ productId: 'p1', name: 'Café 250 g', qty: 1, unitPrice: 20 }],
        totalValue: 20,
        creditsApplied: 0,
        moneyAmount: 20,
        createdAt: today,
        cancelable: false,
        cancelReason: null,
        refundedCredits: null,
        proof: { available: true, expired: false },
      },
    ]
    renderAt()
    const buttons = await screen.findAllByRole('button', { name: 'Ver foto' })
    expect(buttons).toHaveLength(2)
    expect(screen.getByText('foto expirada')).toBeDefined()
    expect(screen.getByText('O comprovante fica disponível por 90 dias.')).toBeDefined()
    fireEvent.click(buttons[1])
    expect(await screen.findByRole('dialog', { name: 'Seu pãozin chegou' })).toBeDefined()
  })

  it('o aviso "Ver foto" (?comprovante=) abre a foto direto', async () => {
    mockUseOrderTracking.mockReturnValue({ order: null, isToday: false })
    renderAt('/client/pedidos?comprovante=o1')
    expect(await screen.findByRole('dialog', { name: 'Seu pãozin chegou' })).toBeDefined()
    expect(mockApiFetch).toHaveBeenCalledWith('/orders/o1/proof')
  })

  it('foto que não pode mais ser mostrada: explica, sem quebrar', async () => {
    mockUseOrderTracking.mockReturnValue({ order: null, isToday: false })
    renderAt('/client/pedidos?comprovante=zz')
    expect(await screen.findByText('A foto não está disponível')).toBeDefined()
  })
})
