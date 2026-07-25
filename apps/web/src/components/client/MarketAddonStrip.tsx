import { useNavigate } from 'react-router'
import { useMarketCatalog } from '../../hooks/useMarketCatalog'
import { useCart } from '../../contexts/CartContext'
import { MarketMiniCard } from './MarketMiniCard'
import { Icon } from '../brand/Icon'

/**
 * MarketAddonStrip — add-on C8 no pedido único: "Além do Pãozin" na mesma cara da Home
 * (cabeçalho inline + "Ver tudo" → aba Cestinha, sem fundo/card). A diferença para a Home é
 * só o comportamento dos cards: aqui tocar ADICIONA à Cestinha (modo onAdd), sem navegar.
 * A finalização é feita pelo rodapé da SingleScreen ("Ir para a Cestinha"). Sem produtos → some.
 */
export function MarketAddonStrip() {
  const navigate = useNavigate()
  const { categories, products, avulsoUnit, maxEconomyPercent, isLoading } = useMarketCatalog()
  const { addProduct, qtyOf } = useCart()

  if (isLoading) return null

  // O Pão Francês já é o próprio pedido único — fora da faixa (só na aba Cestinha).
  const visible = products.filter((p) => !p.isBread)
  if (visible.length === 0) return null

  const emojiOf = (categoryId: string) => categories.find((c) => c.id === categoryId)?.emoji ?? null
  const featured = [...visible].sort((a, b) => Number(a.soldOut) - Number(b.soldOut)).slice(0, 8)

  return (
    <div>
      {/* Cabeçalho — igual ao bloco da Home */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '4px 2px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Icon name="basket" size={19} color="var(--color-accent)" stroke={2} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 16,
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
              }}
            >
              Além do Pãozin
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)' }}>
              {maxEconomyPercent > 0
                ? `Pague com pãezinhos e economize até ${Math.round(maxEconomyPercent)}%`
                : 'Café da manhã completo, entregue com o pão'}
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/client/market')}
          style={{
            flexShrink: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-accent)',
            padding: 0,
          }}
        >
          Ver tudo
        </button>
      </div>

      {/* Faixa de cards — modo adicionar (onAdd), como no pedido único */}
      <div className="cdp-carousel" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollSnapType: 'x proximity' }}>
        {featured.map((p) => (
          <MarketMiniCard
            key={p.id}
            product={p}
            emoji={emojiOf(p.categoryId)}
            avulsoUnit={avulsoUnit}
            economyPercent={maxEconomyPercent}
            onAdd={() => addProduct(p, 1)}
            qtyInCart={qtyOf(p.id)}
          />
        ))}
      </div>
    </div>
  )
}
