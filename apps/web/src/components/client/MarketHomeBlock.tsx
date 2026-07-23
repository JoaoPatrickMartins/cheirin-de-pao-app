import { useNavigate } from 'react-router'
import { useMarketCatalog } from '../../hooks/useMarketCatalog'
import { MarketMiniCard } from './MarketMiniCard'
import { Icon } from '../brand/Icon'

/**
 * MarketHomeBlock — bloco fixo "Além do Pãozin" na Home (abaixo dos atalhos, acima das
 * próximas entregas). Faixa horizontal de até 6 produtos + "Ver tudo" → aba Cestinha.
 * Sem produtos ativos → esconde o bloco (return null). Números/dados são reais (catálogo).
 */
export function MarketHomeBlock() {
  const navigate = useNavigate()
  const { categories, products, avulsoUnit, maxEconomyPercent, isLoading } = useMarketCatalog()

  if (isLoading) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 10, overflow: 'hidden' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="cdp-shimmer"
              style={{ flexShrink: 0, width: 126, height: 150, borderRadius: 16 }}
            />
          ))}
        </div>
      </div>
    )
  }

  // Sem produtos ativos → não renderiza o bloco.
  if (products.length === 0) return null

  const emojiOf = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.emoji ?? null

  // Disponíveis primeiro; até 6 na faixa de destaque.
  const featured = [...products]
    .sort((a, b) => Number(a.soldOut) - Number(b.soldOut))
    .slice(0, 6)

  return (
    <div>
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

      <div
        className="cdp-carousel"
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollSnapType: 'x proximity',
        }}
      >
        {featured.map((p) => (
          <MarketMiniCard
            key={p.id}
            product={p}
            emoji={emojiOf(p.categoryId)}
            avulsoUnit={avulsoUnit}
            economyPercent={maxEconomyPercent}
            onOpen={() => navigate(`/client/market/produto/${p.id}`)}
          />
        ))}
      </div>
    </div>
  )
}
