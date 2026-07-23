import { useNavigate } from 'react-router'
import { useCart } from '../../contexts/CartContext'
import { useMarketCatalog } from '../../hooks/useMarketCatalog'
import { ProdPhoto } from '../../components/client/ProdPhoto'
import StepperInline from '../../components/client/StepperInline'
import { Icon } from '../../components/brand/Icon'
import { formatBRL, paezinhosDe, type CartLine } from '../../lib/market'

/**
 * CestinhaScreen — o carrinho unificado (produtos + pães do add-on C8). Persistido por
 * usuário no backend (via CartContext). Mostra subtotal recalculado no servidor e o mínimo
 * da Cestinha. O checkout/pagamento misto chega na Onda 4.
 */
export function CestinhaScreen() {
  const navigate = useNavigate()
  const { cart, isLoading, setQty, removeProduct, setBreadQty } = useCart()
  const { categories } = useMarketCatalog()

  const emojiOf = (categoryId: string) => categories.find((c) => c.id === categoryId)?.emoji ?? null

  const isEmpty = cart.items.length === 0 && cart.breadQty === 0
  const breadValue = cart.breadQty * cart.avulsoUnit
  const faltam = Math.max(0, cart.minimo - cart.subtotal)

  return (
    <div style={{ background: 'var(--color-app-bg)', minHeight: 'calc(100dvh - 56px)', paddingBottom: isEmpty ? 24 : 132 }}>
      {/* AppBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(10px + env(safe-area-inset-top)) 20px 10px' }}>
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0 }}>
          Cestinha
        </h1>
      </div>

      {isLoading && isEmpty ? (
        <div style={{ padding: '4px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1].map((i) => (
            <div key={i} className="cdp-shimmer" style={{ height: 84, borderRadius: 16 }} />
          ))}
        </div>
      ) : isEmpty ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '56px 20px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--color-surface-2)', display: 'grid', placeItems: 'center' }}>
            <Icon name="basket" size={28} color="var(--color-text-ter)" stroke={1.8} />
          </div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--color-text)', margin: '4px 0 0', letterSpacing: '-0.01em' }}>
            Sua Cestinha está vazia
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-ter)', margin: 0, lineHeight: 1.4, maxWidth: 260 }}>
            Adicione produtos do Além do Pãozin — eles chegam junto com o seu pão.
          </p>
          <button
            onClick={() => navigate('/client/market')}
            style={{ marginTop: 8, minHeight: 48, padding: '0 20px', borderRadius: 'var(--radius-btn)', border: 'none', background: 'var(--color-espresso)', color: '#FAF5EC', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            Ver o Além do Pãozin
          </button>
        </div>
      ) : (
        <div style={{ padding: '4px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Itens de produto */}
          {cart.items.map((line) => (
            <CartItemRow
              key={line.productId}
              line={line}
              emoji={emojiOf(line.categoryId)}
              avulsoUnit={cart.avulsoUnit}
              onQty={(q) => setQty(line.productId, q)}
              onRemove={() => removeProduct(line.productId)}
            />
          ))}

          {/* Linha do pedido de pão (add-on C8) — pago com pãezinhos */}
          {cart.breadQty > 0 && (
            <div style={rowStyle}>
              <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--color-gold-soft)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 26 }}>
                🥖
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                  Seu pedido de pão
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
                  {cart.breadQty} {cart.breadQty === 1 ? 'pão' : 'pães'} · {formatBRL(breadValue)} · pago com pãezinhos
                </p>
                <div style={{ marginTop: 8 }}>
                  <StepperInline min={0} max={100} value={cart.breadQty} onChange={setBreadQty} />
                </div>
              </div>
            </div>
          )}

          {/* Resumo */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, padding: 16, marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-sec)' }}>Subtotal</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
                {formatBRL(cart.subtotal)}
              </span>
            </div>
            {!cart.meetsMinimum && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-accent)', margin: '8px 0 0', lineHeight: 1.4 }}>
                Faltam <strong>{formatBRL(faltam)}</strong> para o pedido mínimo de {formatBRL(cart.minimo)}.
              </p>
            )}
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '8px 0 0', lineHeight: 1.4 }}>
              Você escolhe quanto pagar em dinheiro ou com pãezinhos no pagamento.
            </p>
          </div>

          <button
            onClick={() => navigate('/client/market')}
            style={{ alignSelf: 'center', marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-accent)', padding: 8 }}
          >
            Continuar comprando
          </button>
        </div>
      )}

      {/* Rodapé fixo — CTA de pagamento */}
      {!isEmpty && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'calc(56px + env(safe-area-inset-bottom))',
            background: 'var(--color-app-bg)',
            borderTop: '1px solid var(--color-border-2)',
            padding: '12px 20px',
          }}
        >
          <button
            onClick={() => cart.meetsMinimum && navigate('/client/market/checkout')}
            disabled={!cart.meetsMinimum}
            style={{
              width: '100%',
              minHeight: 52,
              borderRadius: 'var(--radius-btn)',
              border: 'none',
              background: 'var(--color-espresso)',
              color: 'var(--color-primary-btn-text)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 16,
              cursor: cart.meetsMinimum ? 'pointer' : 'default',
              opacity: cart.meetsMinimum ? 1 : 0.45,
            }}
          >
            Ir para pagamento · {formatBRL(cart.subtotal)}
          </button>
        </div>
      )}
    </div>
  )
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-2)',
  borderRadius: 16,
  padding: 12,
}

function CartItemRow({
  line,
  emoji,
  avulsoUnit,
  onQty,
  onRemove,
}: {
  line: CartLine
  emoji?: string | null
  avulsoUnit: number
  onQty: (q: number) => void
  onRemove: () => void
}) {
  const paes = paezinhosDe(line.price, avulsoUnit)
  return (
    <div style={rowStyle}>
      <div style={{ width: 56, flexShrink: 0 }}>
        <ProdPhoto photoUrl={line.photoUrl} emoji={emoji} tintSeed={line.categoryId} alt={line.name} radius={12} height={56} emojiSize={26} dimmed={line.soldOut} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.25 }}>
            {line.name}
          </p>
          <button
            onClick={onRemove}
            aria-label={`Remover ${line.name}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, display: 'grid', placeItems: 'center', height: 24 }}
          >
            <Icon name="x" size={16} color="var(--color-text-ter)" />
          </button>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
          {formatBRL(line.price)}{paes > 0 ? ` · ou ${paes} 🥖` : ''}
        </p>
        {line.soldOut && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: 'var(--color-accent)', margin: '3px 0 0' }}>
            Esgotado — remova para continuar
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
          <StepperInline min={1} max={99} value={line.qty} onChange={onQty} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
            {formatBRL(line.lineTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}
