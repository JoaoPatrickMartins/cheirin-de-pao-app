import { ProdPhoto } from './ProdPhoto'
import { useCart } from '../../contexts/CartContext'
import { Icon } from '../brand/Icon'
import { formatBRL, paezinhosDe, type MarketProduct } from '../../lib/market'

interface ProdCardProps {
  product: MarketProduct
  /** Emoji da categoria (fallback de foto). */
  emoji?: string | null
  /** Nome da categoria (rótulo em CAIXA ALTA acima do nome). */
  categoryName?: string | null
  avulsoUnit: number
  /** Maior economia % dos combos ativos — selo "−X%". 0 = sem selo. */
  economyPercent: number
  onOpen: () => void
}

/**
 * ProdCard — card do grid do catálogo (2 colunas), no layout do design: selo de desconto
 * sobre a foto, rótulo da categoria, preço "à vista", faixa "🥖 N pães · −X%" e, no rodapé,
 * o botão "Adicionar" (largura total) ou o stepper "− N +". Tocar no corpo abre o detalhe;
 * o rodapé de adicionar fica isolado (stopPropagation). Estados: esgotado e "Últimas".
 */
export function ProdCard({ product, emoji, categoryName, avulsoUnit, economyPercent, onOpen }: ProdCardProps) {
  const { qtyOf, addProduct, setQty } = useCart()
  const qty = qtyOf(product.id)
  // Teto por pedido (capacidade diária / estoque): no limite, desabilita o "+".
  const atMax = product.maxQty != null && qty >= product.maxQty
  const paes = paezinhosDe(product.price, avulsoUnit)
  const showEconomy = economyPercent > 0 && !product.soldOut
  const pct = Math.round(economyPercent)

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
        gap: 9,
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
          height={132}
          emojiSize={38}
          dimmed={product.soldOut}
        />
        {/* Estado de estoque no canto superior direito */}
        {product.soldOut ? (
          <span style={cornerBadge('var(--color-text-sec)', '#fff')}>Esgotado</span>
        ) : product.limited ? (
          <span style={cornerBadge('var(--color-gold)', 'var(--color-espresso)')}>Últimas</span>
        ) : null}
      </div>

      {/* Rótulo da categoria */}
      {categoryName && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--color-text-ter)',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {categoryName}
        </p>
      )}

      {/* Nome (até 2 linhas) */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--color-text)',
          margin: 0,
          lineHeight: 1.25,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: 35,
        }}
      >
        {product.name}
      </p>

      {/* Preço à vista */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
          {formatBRL(product.price)}
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-ter)' }}>à vista</span>
      </div>

      {/* Faixa: pague com pãezinhos (N pães · −X%) */}
      {paes > 0 && (
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
            🥖 {paes} {paes === 1 ? 'pão' : 'pães'}
          </span>
          {showEconomy && (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 800, color: 'var(--color-accent)' }}>
              −{pct}%
            </span>
          )}
        </div>
      )}

      {/* Rodapé: adicionar (largura total) — isolado do clique do card */}
      {product.soldOut ? (
        <div style={soldOutFooter()}>Indisponível</div>
      ) : qty > 0 ? (
        <div onClick={stop} style={stepperBox()}>
          <StepBtn label="Diminuir" onClick={() => setQty(product.id, qty - 1)}>
            <Icon name="minus" size={16} color="#fff" stroke={2.4} />
          </StepBtn>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: '#fff', minWidth: 20, textAlign: 'center' }}>
            {qty}
          </span>
          <StepBtn label="Aumentar" disabled={atMax} onClick={() => addProduct(product, 1)}>
            <Icon name="plus" size={16} color="#fff" stroke={2.4} />
          </StepBtn>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Adicionar ${product.name}`}
          onClick={(e) => {
            stop(e)
            addProduct(product, 1)
          }}
          style={addButton()}
        >
          <Icon name="plus" size={16} color="#fff" stroke={2.4} />
          Adicionar
        </button>
      )}

      {/* Teto diário do produto (só p/ DAILY com limite baixo) — explica o "+" travado */}
      {product.stockType === 'DAILY' && product.maxQty != null && product.maxQty > 0 && product.maxQty < 99 && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, color: 'var(--color-text-ter)', margin: '-3px 0 0', textAlign: 'center' }}>
          máx {product.maxQty}/dia
        </p>
      )}
    </div>
  )
}

function StepBtn({ children, onClick, label, disabled = false }: { children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        borderRadius: 9,
        display: 'grid',
        placeItems: 'center',
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
        border: 'none',
        background: 'transparent',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

function addButton(): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    width: '100%',
    height: 40,
    borderRadius: 12,
    border: 'none',
    background: 'var(--color-espresso)',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  }
}

function stepperBox(): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    width: '100%',
    height: 40,
    padding: '0 3px',
    borderRadius: 12,
    border: 'none',
    background: 'var(--color-espresso)',
  }
}

function soldOutFooter(): React.CSSProperties {
  return {
    display: 'grid',
    placeItems: 'center',
    width: '100%',
    height: 40,
    borderRadius: 12,
    background: 'var(--color-surface-2)',
    color: 'var(--color-text-ter)',
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    fontWeight: 700,
  }
}

function cornerBadge(bg: string, color: string): React.CSSProperties {
  return {
    position: 'absolute',
    top: 6,
    right: 6,
    background: bg,
    color,
    fontFamily: 'var(--font-body)',
    fontSize: 10.5,
    fontWeight: 800,
    borderRadius: 999,
    padding: '3px 8px',
    letterSpacing: '0.01em',
    zIndex: 2,
  }
}
