// CestinhaScreen — aviso do gancho grátis pelo VALOR da Cestinha (regra R3).
// O limiar (`cestinhaMinValue`) é configurável pelo admin e vem do backend; o aviso não pode
// prometer o gancho fora dele nem ficar calado quando o cliente já bateu a meta.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))

vi.mock('../../../hooks/useMarketCatalog', () => ({
  useMarketCatalog: () => ({ categories: [], products: [], avulsoUnit: 1.2, maxEconomyPercent: 0, isLoading: false, error: null, reload: vi.fn() }),
}))

// Carrinho controlável: o subtotal é o que dispara (ou não) o aviso.
const cartState = vi.hoisted(() => ({ subtotal: 0 }))
vi.mock('../../../contexts/CartContext', async () => {
  const { emptyCart } = await import('../../../lib/market')
  return {
    useCart: () => ({
      ...{ setQty: vi.fn(), removeProduct: vi.fn(), setBreadQty: vi.fn(), isLoading: false },
      cart: {
        ...emptyCart(),
        avulsoUnit: 1.2,
        minimo: 0,
        breadMin: 4,
        items: [
          { productId: 'p1', name: 'Bolo', categoryId: 'c1', price: cartState.subtotal, qty: 1, lineTotal: cartState.subtotal, photoUrl: null },
        ],
        breadQty: 0,
        productSubtotal: cartState.subtotal,
        subtotal: cartState.subtotal,
        count: 1,
        meetsMinimum: true,
      },
    }),
  }
})

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

import { CestinhaScreen } from '../CestinhaScreen'

/** Resposta de GET /client/hook-request. cestinhaMinValue = R$ 6,00 (5 pães × R$ 1,20). */
const hookState: { response: Record<string, unknown> | null } = { response: null }

function renderScreen() {
  mockApiFetch.mockImplementation((url: string) => {
    if (url === '/client/hook-request') {
      return Promise.resolve({ ok: hookState.response != null, json: () => Promise.resolve(hookState.response) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  })
  return render(
    <MemoryRouter>
      <CestinhaScreen />
    </MemoryRouter>,
  )
}

const SEM_GANCHO = { hasHook: false, freeEligible: false, pedidoUnicoMin: 5, cestinhaMinValue: 6 }

describe('CestinhaScreen — aviso do gancho grátis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hookState.response = null
    cartState.subtotal = 0
  })

  it('abaixo do limiar mostra quanto falta em R$', async () => {
    hookState.response = SEM_GANCHO
    cartState.subtotal = 3.5
    renderScreen()

    expect(await screen.findByText(/ganhe o gancho de porta grátis/i)).toBeInTheDocument()
    expect(screen.getByText(/faltam R\$ ?2,50/i)).toBeInTheDocument()
  })

  it('no limiar exato promete o gancho', async () => {
    hookState.response = SEM_GANCHO
    cartState.subtotal = 6
    renderScreen()

    expect(await screen.findByText(/te dá o gancho de porta grátis/i)).toBeInTheDocument()
  })

  it('centavo de float abaixo do limiar ainda conta (mesma tolerância do backend)', async () => {
    // Float: uma Cestinha de R$ 6,00 pode chegar como 5.999999… — um `>=` cru diria "faltam R$ 0,00".
    hookState.response = SEM_GANCHO
    cartState.subtotal = 5.999999
    renderScreen()

    expect(await screen.findByText(/te dá o gancho de porta grátis/i)).toBeInTheDocument()
  })

  it('não promete nada a quem já tem gancho', async () => {
    hookState.response = { ...SEM_GANCHO, hasHook: true }
    cartState.subtotal = 20
    renderScreen()

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/client/hook-request'))
    expect(screen.queryByText(/gancho de porta grátis/i)).not.toBeInTheDocument()
  })

  it('não promete nada a quem já qualificou por outra via (ex.: combo)', async () => {
    hookState.response = { ...SEM_GANCHO, freeEligible: true }
    cartState.subtotal = 20
    renderScreen()

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/client/hook-request'))
    expect(screen.queryByText(/gancho de porta grátis/i)).not.toBeInTheDocument()
  })

  it('regra indisponível (cestinhaMinValue = 0) não promete gancho', async () => {
    // Sem preço avulso configurado o backend manda 0 — limiar 0 liberaria o gancho para
    // qualquer Cestinha, então o aviso tem de sumir.
    hookState.response = { ...SEM_GANCHO, cestinhaMinValue: 0 }
    cartState.subtotal = 20
    renderScreen()

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/client/hook-request'))
    expect(screen.queryByText(/gancho de porta grátis/i)).not.toBeInTheDocument()
  })
})
