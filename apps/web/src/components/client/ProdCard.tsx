import { ProdPhoto } from './ProdPhoto'
import { useCart } from '../../contexts/CartContext'
import { Icon } from '../brand/Icon'
import { formatBRL, paezinhosDe, type MarketProduct } from '../../lib/market'

interface ProdCardProps {
  product: MarketProduct
  /** Emoji da categoria (fallback de foto). */
  emoji?: string | null
  avulsoUnit: number
  /** Maior economia % dos combos ativos — selo "🥖 −X%". 0 = sem selo. */
  economyPercent: number
  onOpen: () => void
}

/**
 * ProdCard — card do grid do catálogo (2 colunas). Tocar no corpo abre o detalhe;
 * o controle de adicionar (+ / stepper) fica isolado (stopPropagation). Estados:
 * esgotado (esmaecido, sem add) e "Últimas" (estoque fixo baixo).
 */
export function ProdCard({ product, emoji, avulsoUnit, economyPercent, onOpen }: ProdCardProps) {
  const { qtyOf, addProduct, setQty } = useCart()
  const qty = qtyOf(product.id)
  const paes = paezinhosDe(product.price, avulsoUnit)
  const showEconomy = economyPercent > 0

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      aria-label={product.name}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 10,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 18,
        boxShadow: 'var(--shadow-soft)',
        cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative' }}>
        <ProdPhoto
          photoUrl={product.photoUrl}
          emoji={emoji}
          tintSeed={product.categoryId}
          alt={product.name}
          radius={12}
          emojiSize={38}
          dimmed={product.soldOut}
        />
        {/* Estado de estoque no canto superior esquerdo */}
        {product.soldOut ? (
          <span style={badgeStyle('var(--color-text-sec)', '#fff', 'left')}>Esgotado</span>
        ) : product.limited ? (
          <span style={badgeStyle('var(--color-gold)', 'var(--color-espresso)', 'left')}>Últimas</span>
        ) : null}
        {/* Selo de economia no canto superior direito */}
        {showEconomy && !product.soldOut && (
          <span style={badgeStyle('var(--color-good)', '#fff', 'right')}>🥖 −{Math.round(economyPercent)}%</span>
        )}
      </div>

      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13.5,
          fontWeight: 700,
          color: 'var(--color-text)',
          margin: 0,
          lineHeight: 1.25,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: 34,
        }}
      >
        {product.name}
      </p>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--color-text)',
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            {formatBRL(product.price)}
          </p>
          {paes > 0 && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '1px 0 0' }}>
              ou {paes} 🥖
            </p>
          )}
        </div>

        {/* Controle de adicionar (isolado do clique do card) */}
        {product.soldOut ? null : qty > 0 ? (
          <div onClick={stop} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <RoundBtn label="Diminuir" onClick={() => setQty(product.id, qty - 1)} variant="ghost">
              <Icon name="minus" size={15} color="var(--color-espresso)" stroke={2.4} />
            </RoundBtn>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: 'var(--color-accent)', minWidth: 14, textAlign: 'center' }}>
              {qty}
            </span>
            <RoundBtn label="Aumentar" onClick={() => addProduct(product, 1)} variant="solid">
              <Icon name="plus" size={15} color="var(--color-gold)" stroke={2.4} />
            </RoundBtn>
          </div>
        ) : (
          <div onClick={stop} style={{ flexShrink: 0 }}>
            <RoundBtn label={`Adicionar ${product.name}`} onClick={() => addProduct(product, 1)} variant="solid">
              <Icon name="plus" size={17} color="var(--color-gold)" stroke={2.4} />
            </RoundBtn>
          </div>
        )}
      </div>
    </div>
  )
}

function RoundBtn({
  children,
  onClick,
  label,
  variant,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  variant: 'solid' | 'ghost'
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        borderRadius: 10,
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        border: variant === 'solid' ? 'none' : '1.5px solid var(--color-border)',
        background: variant === 'solid' ? 'var(--color-espresso)' : 'var(--color-surface)',
      }}
    >
      {children}
    </button>
  )
}

function badgeStyle(bg: string, color: string, side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: 6,
    left: side === 'left' ? 6 : undefined,
    right: side === 'right' ? 6 : undefined,
    background: bg,
    color,
    fontFamily: 'var(--font-body)',
    fontSize: 10.5,
    fontWeight: 800,
    borderRadius: 999,
    padding: '3px 8px',
    letterSpacing: '0.01em',
  }
}
