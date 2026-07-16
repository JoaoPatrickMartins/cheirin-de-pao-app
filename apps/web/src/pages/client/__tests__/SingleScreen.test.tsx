// SingleScreen page tests
// Requirements: SCHED-01 — pedido único usa saldo ou cobra só a diferença (via Pix)
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))

const auth = vi.hoisted(() => ({ creditBalance: 0, updateCreditBalance: vi.fn() }))
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Test', role: 'CLIENT', creditBalance: auth.creditBalance },
    token: 'tok',
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    updateCreditBalance: auth.updateCreditBalance,
  }),
}))

const mockNavigate = vi.fn()
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { SingleScreen } from '../SingleScreen'

const pricing = { avulsoUnit: 2.5, avulsoLimite: 30 }
const slots = [
  { name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true },
  { name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true },
]
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function setupApi() {
  mockApiFetch.mockImplementation((url: string) => {
    if (url === '/pricing') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(pricing) })
    }
    if (url === '/client/condominium/slots') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(slots) })
    }
    if (url === '/orders') {
      return Promise.resolve({ status: 201, ok: true, json: () => Promise.resolve({ creditBalance: 0 }) })
    }
    // POST /payments/pix
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({ paymentId: 'pid-1', pixQrCodeUrl: 'https://qr.png', pixCopyPaste: 'pixcode' }),
    })
  })
}

const renderScreen = () =>
  render(
    <MemoryRouter>
      <SingleScreen />
    </MemoryRouter>,
  )

// Slot da tarde (15:30/corte 10:00) está sempre disponível para amanhã → determinístico.
// O rótulo inclui emoji ("🌙 Tarde"), então casamos por regex.
const pickSlot = async () => {
  const chip = await screen.findByText(/Tarde/)
  fireEvent.click(chip)
}

describe('SingleScreen [SCHED-01]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupApi()
  })

  it('saldo suficiente → cria pedido via POST /orders com deliveryTime do slot', async () => {
    auth.creditBalance = 100
    renderScreen()
    await pickSlot()
    fireEvent.click(screen.getByText(/Reservar e confirmar/i))

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith('/orders', expect.objectContaining({ method: 'POST' })),
    )
    const call = mockApiFetch.mock.calls.find((c) => c[0] === '/orders')!
    const body = JSON.parse(call[1].body)
    expect(body).toMatchObject({ quantity: 1, deliveryTime: '15:30' })
    expect(body.scheduledDate).toMatch(DATE_RE)
  })

  it('déficit + Pix → POST /payments/pix da diferença e navega com pendingOrder (deliveryTime)', async () => {
    auth.creditBalance = 0
    renderScreen()
    await pickSlot()
    fireEvent.click(screen.getByText(/Pagar .* e agendar/i))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/client/creditos/pix', expect.anything()))
    const pixCall = mockApiFetch.mock.calls.find((c) => c[0] === '/payments/pix')!
    expect(JSON.parse(pixCall[1].body)).toMatchObject({ customQuantity: 1 })
    const [, options] = mockNavigate.mock.calls.find((c) => c[0] === '/client/creditos/pix')!
    expect(options.state.pendingOrder).toMatchObject({ quantity: 1, deliveryTime: '15:30' })
    expect(options.state.pendingOrder.scheduledDate).toMatch(DATE_RE)
  })

  it('déficit → pedido único não oferece pagamento por cartão (só Pix)', async () => {
    auth.creditBalance = 0
    renderScreen()
    await pickSlot()

    expect(screen.queryByText('Cartão')).not.toBeInTheDocument()
    expect(screen.getByText('Pagamento via Pix')).toBeInTheDocument()
  })
})
