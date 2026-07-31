import { ProdPhoto } from './ProdPhoto'
import { useCart } from '../../contexts/CartContext'
import { Icon } from '../brand/Icon'
import { CREDIT_SCALE } from '@cheirin-de-pao/shared'
import { formatBRL, labelPaezinhos, type MarketProduct } from '../../lib/market'

interface BreadCardProps {
  /** Produto fixo "Pão Francês" (isBread) — fonte de foto/nome/categoria, configurado no admin. */
  product: MarketProduct
  /** Nome da categoria (rótulo em CAIXA ALTA). */
  categoryName?: string | null
  /** Emoji da categoria (fallback de foto). */
  emoji?: string | null
  /** Preço do pão avulso (R$) — o preço do card e do valor no carrinho. */
  avulsoUnit: number
  /** Maior economia % dos combos ativos — selo "−X%", igual aos demais cards. */
  economyPercent: number
}

/**
 * BreadCard — o "Pão Francês", produto FIXO da Cestinha. A apresentação (foto/nome/descrição)
 * vem do banco (admin configura), mas a COMPRA escreve no `cart.breadQty` (add-on de pão já
 * existente): vira uma MarketOrder de entrega, preço = avulso, mínimo do pedido único. É o mesmo
 * pão do pedido único, em outro fluxo. Não navega para detalhe (a compra é sempre por aqui).
 */
export function BreadCard({ product, categoryName, emoji, avulsoUnit, economyPercent }: BreadCardProps) {
  const { cart, setBreadQty } = useCart()
  const qty = cart.breadQty
  // Mesmo mínimo do pedido único: "Adicionar" já entra com o mínimo e o stepper não fica abaixo
  // dele — ao passar do piso, remove de vez (0). Ou seja: 0 ou ≥ mínimo, nunca 1..min-1.
  const breadMin = Math.max(1, cart.breadMin || 1)
  const dec = () => setBreadQty(qty - 1 < breadMin ? 0 : qty - 1)
  // O pão é a BASE do crédito: preço = avulso e vale exatamente 1 pãozinho, por definição.
  const showEconomy = economyPercent > 0
  const pct = Math.round(economyPercent)

  return (
    <div
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
      }}
    >
      <ProdPhoto
        photoUrl={product.photoUrl}
        emoji={emoji}
        tintSeed={product.categoryId}
        alt={product.name}
        radius={12}
        height={132}
        emojiSize={40}
      />

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
          }}
        >
          {categoryName}
        </p>
      )}

      {/* Nome */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--color-text)',
          margin: 0,
          lineHeight: 1.25,
          minHeight: 35,
        }}
      >
        {product.name}
      </p>

      {/* Preço à vista */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
          {formatBRL(avulsoUnit)}
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-ter)' }}>a unidade</span>
      </div>

      {/* Valor em pãezinhos + economia — mesma pílula dos demais cards. Sempre "1 pão". */}
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
          🥖 {labelPaezinhos(CREDIT_SCALE)}
        </span>
        {showEconomy && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 800, color: 'var(--color-accent)' }}>
            −{pct}%
          </span>
        )}
      </div>

      {/* Rodapé: adicionar (largura total) — escreve no breadQty, respeitando o mínimo */}
      {qty > 0 ? (
        <div style={stepperBox}>
          <StepBtn label="Diminuir" onClick={dec}>
            <Icon name="minus" size={16} color="#fff" stroke={2.4} />
          </StepBtn>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: '#fff', minWidth: 20, textAlign: 'center' }}>
            {qty}
          </span>
          <StepBtn label="Aumentar" onClick={() => setBreadQty(qty + 1)}>
            <Icon name="plus" size={16} color="#fff" stroke={2.4} />
          </StepBtn>
        </div>
      ) : (
        <button type="button" aria-label={`Adicionar ${product.name}`} onClick={() => setBreadQty(breadMin)} style={addButton}>
          <Icon name="plus" size={16} color="#fff" stroke={2.4} />
          Adicionar
        </button>
      )}

      {breadMin > 1 && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, color: 'var(--color-text-ter)', margin: '-3px 0 0', textAlign: 'center' }}>
          Pedido mínimo de {breadMin} pães
        </p>
      )}
    </div>
  )
}

function StepBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, border: 'none', background: 'transparent' }}
    >
      {children}
    </button>
  )
}

const addButton: React.CSSProperties = {
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

const stepperBox: React.CSSProperties = {
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
