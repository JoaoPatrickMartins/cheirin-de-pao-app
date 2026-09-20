// Selo de novidade no card do catálogo.
//
// A regra visual que importa: o selo de novidade e o de estoque ocupam cantos OPOSTOS, então um
// lançamento que esgotou mostra os dois. Já foi o caso de um selo comer o outro.
import { vi, describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../../contexts/CartContext', () => ({
  useCart: () => ({ qtyOf: () => 0, addProduct: vi.fn(), setQty: vi.fn() }),
}))

import { ProdCard } from '../ProdCard'
import type { MarketProduct } from '../../../lib/market'

const product = (over: Partial<MarketProduct> = {}): MarketProduct => ({
  id: 'p1',
  name: 'Geleia de Morango',
  categoryId: 'c1',
  price: 12,
  photoUrl: null,
  availableDays: [],
  soldOut: false,
  limited: false,
  stockType: 'FIXED',
  maxQty: 10,
  ...over,
})

const renderCard = (p: MarketProduct) =>
  render(<ProdCard product={p} avulsoUnit={1.2} economyPercent={0} onOpen={vi.fn()} />)

describe('ProdCard — selo de novidade', () => {
  it('não aparece em produto comum', () => {
    renderCard(product())
    expect(screen.queryByText(/novidade/i)).not.toBeInTheDocument()
  })

  it('aparece quando o produto é novidade', () => {
    renderCard(product({ isNew: true }))
    expect(screen.getByText(/novidade/i)).toBeInTheDocument()
  })

  it('convive com o selo de esgotado — cantos opostos', () => {
    renderCard(product({ isNew: true, soldOut: true }))
    expect(screen.getByText(/novidade/i)).toBeInTheDocument()
    expect(screen.getByText('Esgotado')).toBeInTheDocument()
  })

  it('esgotado troca o botão por "Indisponível", mesmo sendo novidade', () => {
    renderCard(product({ isNew: true, soldOut: true }))
    expect(screen.getByText('Indisponível')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /adicionar/i })).not.toBeInTheDocument()
  })
})

describe('ProdCard — promoção', () => {
  it('mostra o selo PROMO e o preço antigo riscado', () => {
    renderCard(product({ isPromo: true, price: 9.84, priceBefore: 12 }))
    expect(screen.getByText(/promo/i)).toBeInTheDocument()
    expect(screen.getByText('R$ 12,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 9,84')).toBeInTheDocument()
  })

  it('sem promoção não rende riscado nenhum', () => {
    renderCard(product({ price: 12 }))
    expect(screen.queryByText(/promo/i)).not.toBeInTheDocument()
    expect(screen.getByText('R$ 12,00')).toBeInTheDocument()
  })

  it('UM SELO SÓ: novidade ganha de promoção', () => {
    renderCard(product({ isNew: true, isPromo: true, price: 9.84, priceBefore: 12 }))
    expect(screen.getByText(/novidade/i)).toBeInTheDocument()
    expect(screen.queryByText(/promo/i)).not.toBeInTheDocument()
    // O de/por continua lá — é ele que denuncia a promoção quando o selo é da novidade.
    expect(screen.getByText('R$ 12,00')).toBeInTheDocument()
  })

  it('o preço em pãezins acompanha o desconto sozinho', () => {
    // avulso R$ 1,20: R$ 9,84 → 8,2 pãezins (e não os 10 do preço cheio).
    renderCard(product({ isPromo: true, price: 9.84, priceBefore: 12 }))
    expect(screen.getByText(/8,2 pãezins/)).toBeInTheDocument()
  })
})
