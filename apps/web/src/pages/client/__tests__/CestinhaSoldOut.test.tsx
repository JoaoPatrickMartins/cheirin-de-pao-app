// CestinhaScreen — item esgotado trava o checkout.
//
// O backend sempre recusou (409), mas o front deixava o cliente tocar em "Ir para pagamento" e
// levar o erro na cara. Com a pausa de produtos isso deixa de ser caso raro: o admin derruba um
// item e quem já o tinha no carrinho encosta nessa parede.
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))

vi.mock('../../../hooks/useMarketCatalog', () => ({
  useMarketCatalog: () => ({
    categories: [],
    products: [],
    avulsoUnit: 1.2,
    maxEconomyPercent: 0,
    isLoading: false,
    error: null,
    reload: vi.fn(),
  }),
}))

const cartState = vi.hoisted(() => ({ soldOut: false }))
vi.mock('../../../contexts/CartContext', async () => {
  const { emptyCart } = await import('../../../lib/market')
  return {
    useCart: () => ({
      setQty: vi.fn(),
      removeProduct: vi.fn(),
      setBreadQty: vi.fn(),
      isLoading: false,
      cart: {
        ...emptyCart(),
        avulsoUnit: 1.2,
        minimo: 0,
        breadMin: 4,
        items: [
          {
            productId: 'p1',
            name: 'Geleia',
            categoryId: 'c1',
            price: 12,
            qty: 1,
            lineTotal: 12,
            photoUrl: null,
            soldOut: cartState.soldOut,
          },
        ],
        breadQty: 0,
        productSubtotal: 12,
        subtotal: 12,
        count: 1,
        // O mínimo está satisfeito de propósito: o que precisa travar o CTA aqui é o esgotado.
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

function renderScreen() {
  mockApiFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
  return render(
    <MemoryRouter>
      <CestinhaScreen />
    </MemoryRouter>,
  )
}

const cta = () => screen.getByRole('button', { name: /ir para pagamento/i })

describe('CestinhaScreen — item esgotado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cartState.soldOut = false
  })

  it('libera o pagamento quando nada está esgotado', () => {
    renderScreen()
    expect(cta()).not.toBeDisabled()
  })

  it('trava o pagamento quando há linha esgotada, mesmo batendo o mínimo', () => {
    cartState.soldOut = true
    renderScreen()
    expect(cta()).toBeDisabled()
  })

  it('diz o que fazer em vez de só desabilitar', () => {
    cartState.soldOut = true
    renderScreen()
    expect(screen.getByText(/remova os itens esgotados/i)).toBeInTheDocument()
  })

  it('não mostra o aviso quando não há esgotado', () => {
    renderScreen()
    expect(screen.queryByText(/remova os itens esgotados/i)).not.toBeInTheDocument()
  })
})
