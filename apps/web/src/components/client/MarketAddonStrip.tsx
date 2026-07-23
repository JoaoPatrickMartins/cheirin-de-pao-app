import { useMarketCatalog } from '../../hooks/useMarketCatalog'
import { useCart } from '../../contexts/CartContext'
import { MarketMiniCard } from './MarketMiniCard'
import { Icon } from '../brand/Icon'

/**
 * MarketAddonStrip — add-on C8 no pedido único de pão: "Adicione algo do Além do Pãozin".
 * Tocar num produto adiciona à Cestinha. A finalização é feita pelo rodapé da SingleScreen
 * ("Ir para a Cestinha"), que assume o fluxo único quando há produto do market — por isso
 * este bloco não tem CTA próprio (evita dois botões conflitantes na mesma tela).
 * Sem produtos → não renderiza.
 */
export function MarketAddonStrip() {
  const { categories, products, avulsoUnit, maxEconomyPercent, isLoading } = useMarketCatalog()
  const { addProduct, qtyOf } = useCart()

  if (isLoading || products.length === 0) return null

  const emojiOf = (categoryId: string) => categories.find((c) => c.id === categoryId)?.emoji ?? null
  const featured = [...products].sort((a, b) => Number(a.soldOut) - Number(b.soldOut)).slice(0, 8)

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 'var(--radius-card)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--color-gold-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="basket" size={18} color="var(--color-accent)" stroke={2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            Adicione algo do Além do Pãozin
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '1px 0 0' }}>
            Chega junto, no mesmo pedido
          </p>
        </div>
      </div>

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
