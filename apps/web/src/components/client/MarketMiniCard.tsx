import { ProdPhoto } from './ProdPhoto'
import { creditsForPrice } from '@cheirin-de-pao/shared'
import { formatBRL, labelPaezinhos, type MarketProduct } from '../../lib/market'

interface MarketMiniCardProps {
  product: MarketProduct
  emoji?: string | null
  /** Preço do pão avulso (R$) — base do "N pães". */
  avulsoUnit: number
  /** Maior economia % dos combos ativos (real/dinâmico) — selo "−X%". 0 = sem selo. */
  economyPercent: number
  /** Modo navegação (faixa da Home): tocar abre o detalhe. */
  onOpen?: () => void
  /** Modo adicionar (add-on C8): tocar adiciona à Cestinha, sem navegar. */
  onAdd?: () => void
  /** Quantidade já na Cestinha (modo adicionar) — mostra selo. */
  qtyInCart?: number
}

/**
 * MarketMiniCard — card da faixa horizontal (Home e add-on do pedido único), no layout do
 * design: selo de economia (canto), preço "à vista" e rodapé "🥖 N pães · −X%". O X% é o
 * desconto REAL/dinâmico dos combos (nunca o 37% do mock). Dois modos:
 * - `onOpen` (Home): tocar abre o detalhe.
 * - `onAdd` (C8): tocar adiciona à Cestinha (botão + / selo de quantidade), sem navegar.
 */
export function MarketMiniCard({
  product,
  emoji,
  avulsoUnit,
  economyPercent,
  onOpen,
  onAdd,
  qtyInCart = 0,
}: MarketMiniCardProps) {
  const addMode = !!onAdd
  const disabled = addMode && product.soldOut
  // Preço em pãezinhos (milésimos): o crédito é fracionado, então cobre 100% do valor —
  // R$ 1,80 com avulso R$ 1,20 = 1,5 🥖, sem resto em dinheiro. É isso que devolve ao selo o
  // % CHEIO do combo: antes, o resto pago em dinheiro não tinha desconto e diluía a economia.
  const milli = creditsForPrice(product.price, avulsoUnit)
  const pct = Math.round(economyPercent)
  const showEconomy = pct > 0 && !product.soldOut

  return (
    <button
      type="button"
      onClick={addMode ? (disabled ? undefined : onAdd) : onOpen}
      disabled={disabled}
      aria-label={addMode ? `Adicionar ${product.name}` : product.name}
      style={{
        flexShrink: 0,
        width: 150,
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        gap: 8,
        padding: 8,
        background: 'var(--color-surface)',
        border: qtyInCart > 0 ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border-2)',
        borderRadius: 18,
        boxShadow: 'var(--shadow-soft)',
        cursor: disabled ? 'default' : 'pointer',
        scrollSnapAlign: 'start',
      }}
    >
      <div style={{ position: 'relative' }}>
        <ProdPhoto
          photoUrl={product.photoUrl}
          emoji={emoji}
          tintSeed={product.categoryId}
          alt={product.name}
          radius={12}
          height={104}
          emojiSize={38}
          dimmed={product.soldOut}
        />

        {/* Selo de novidade à esquerda — o canto direito é do estoque / botão de adicionar.
            Na faixa (150px) o rótulo encolhe para caber sem quebrar linha. */}
        {product.isNew ? (
          <span style={novidadeBadge()}>✦ NOVO</span>
        ) : product.isPromo ? (
          <span style={novidadeBadge()}>🏷 PROMO</span>
        ) : null}

        {/* Estado de estoque / botão de adicionar. */}
        {product.soldOut ? (
          <span style={cornerBadge('var(--color-text-sec)', '#fff')}>Esgotado</span>
        ) : addMode ? (
          <span style={plusBadge()}>
            {qtyInCart > 0 && <span style={{ fontSize: 12.5 }}>{qtyInCart}</span>}
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          </span>
        ) : null}
      </div>

      {/* Nome (até 2 linhas) */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--color-text)',
          margin: 0,
          lineHeight: 1.22,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: 32,
        }}
      >
        {product.name}
      </p>

      {/* Preço à vista, com o riscado do cheio quando há promoção */}
      <div>
        {product.priceBefore != null && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', textDecoration: 'line-through', margin: '0 0 1px' }}>
            {formatBRL(product.priceBefore)}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
            {formatBRL(product.price)}
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-ter)' }}>à vista</span>
        </div>
      </div>

      {/* Rodapé: pague com pãezinhos (N pães · −X%) */}
      {milli > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            background: 'var(--color-gold-soft)',
            borderRadius: 10,
            padding: '5px 9px',
          }}
        >
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: 'var(--color-accent)' }}>
            🥖 {labelPaezinhos(milli)}
          </span>
          {showEconomy && (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 800, color: 'var(--color-accent)' }}>
              −{pct}%
            </span>
          )}
        </div>
      )}
    </button>
  )
}

/** Selo de novidade da faixa — mesmo par espresso/ouro do card do catálogo, em escala menor. */
function novidadeBadge(): React.CSSProperties {
  return {
    position: 'absolute',
    top: 5,
    left: 5,
    height: 20,
    padding: '0 7px',
    borderRadius: 999,
    background: 'var(--color-espresso)',
    color: 'var(--color-gold)',
    fontFamily: 'var(--font-body)',
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: '0.06em',
    display: 'grid',
    placeItems: 'center',
    lineHeight: 1,
    zIndex: 2,
  }
}

function cornerBadge(bg: string, color: string): React.CSSProperties {
  return {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 22,
    height: 22,
    padding: '0 6px',
    borderRadius: 999,
    background: bg,
    color,
    fontFamily: 'var(--font-body)',
    fontSize: 11,
    fontWeight: 800,
    display: 'grid',
    placeItems: 'center',
    lineHeight: 1,
    zIndex: 2,
  }
}

// Botão de adicionar do modo add — pílula escura (design): "+" (vazio) ou "N +" (na Cestinha).
function plusBadge(): React.CSSProperties {
  return {
    position: 'absolute',
    bottom: 6,
    right: 6,
    minWidth: 28,
    height: 28,
    padding: '0 8px',
    borderRadius: 10,
    background: 'var(--color-espresso)',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    lineHeight: 1,
    boxShadow: '0 1px 3px rgba(30,18,7,0.25)',
    zIndex: 2,
  }
}
