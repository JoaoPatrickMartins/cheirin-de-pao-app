import { useNavigate } from 'react-router'
import { useCart } from '../../contexts/CartContext'
import { useMarketCatalog } from '../../hooks/useMarketCatalog'
import { useFreeHookStatus } from '../../hooks/useFreeHookStatus'
import { ProdPhoto } from '../../components/client/ProdPhoto'
import StepperInline from '../../components/client/StepperInline'
import { Icon } from '../../components/brand/Icon'
import { formatBRL, PAO_FRANCES, type CartLine } from '../../lib/market'

/**
 * CestinhaScreen — o carrinho unificado (produtos + pães do add-on C8). Persistido por
 * usuário no backend (via CartContext). Mostra subtotal recalculado no servidor e o mínimo
 * da Cestinha. O checkout/pagamento misto chega na Onda 4.
 */
export function CestinhaScreen() {
  const navigate = useNavigate()
  const { cart, isLoading, setQty, removeProduct, setBreadQty } = useCart()
  const { categories } = useMarketCatalog()
  const { status: hook, podeGanharGratis } = useFreeHookStatus()

  const emojiOf = (categoryId: string) => categories.find((c) => c.id === categoryId)?.emoji ?? null

  const isEmpty = cart.items.length === 0 && cart.breadQty === 0
  const breadValue = cart.breadQty * cart.avulsoUnit
  const faltam = Math.max(0, cart.minimo - cart.subtotal)
  // Mensagens de mínimo: pão só de pão respeita a quantidade (breadMin); com produtos, o R$.
  const breadShort = cart.breadQty > 0 && cart.breadQty < cart.breadMin
  const moneyShort = cart.items.length > 0 && cart.subtotal < cart.minimo

  // Aviso do gancho grátis — mesmo papel do nudge do pedido único, mas o gatilho aqui é o
  // VALOR da Cestinha. `cestinhaMinValue` é 0 quando a regra está indisponível (sem preço
  // avulso configurado): nesse caso não prometemos nada.
  const cestinhaMin = hook?.cestinhaMinValue ?? 0
  const ganchoAlcancavel = podeGanharGratis && cestinhaMin > 0
  // O critério é o `totalValue` da Cestinha (produtos + pães × avulso) = exatamente este
  // subtotal, e vale mesmo pagando com pãezins. Meio centavo de tolerância espelha o
  // FLOAT_EPSILON do backend — sem isso uma Cestinha de R$ 6,00 gravada como 5,999999
  // mostraria "faltam R$ 0,00".
  const vaiGanharGratis = ganchoAlcancavel && cart.subtotal + 0.005 >= cestinhaMin
  const faltaParaGancho = Math.max(0, Math.round((cestinhaMin - cart.subtotal) * 100) / 100)

  return (
    <div style={{ background: 'var(--color-app-bg)', minHeight: 'calc(100dvh - 56px)', paddingBottom: isEmpty ? 24 : 168 }}>
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
          Sua Cestinha
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.25 }}>
                    {PAO_FRANCES.name}
                  </p>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {formatBRL(breadValue)}
                  </span>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
                  {formatBRL(cart.avulsoUnit)} · pão
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  {/* Mesmo mínimo do pedido único: abaixo do piso, remove (0 ou ≥ mínimo). */}
                  <StepperInline
                    min={0}
                    max={100}
                    value={cart.breadQty}
                    onChange={(v) => setBreadQty(v < cart.breadMin ? 0 : v)}
                  />
                  <button
                    onClick={() => setBreadQty(0)}
                    aria-label={`Remover ${PAO_FRANCES.name}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, display: 'grid', placeItems: 'center' }}
                  >
                    <Icon name="trash" size={18} color="var(--color-text-ter)" stroke={1.9} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Continuar comprando (botão tracejado) */}
          <button
            onClick={() => navigate('/client/market')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              minHeight: 48,
              marginTop: 4,
              borderRadius: 14,
              border: '1.5px dashed var(--color-border)',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--color-accent)',
            }}
          >
            <Icon name="plus" size={17} color="var(--color-accent)" stroke={2.4} />
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
          {breadShort && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-accent)', margin: '0 0 8px', lineHeight: 1.4 }}>
              Pedido mínimo de <strong>{cart.breadMin} pães</strong> — faltam {cart.breadMin - cart.breadQty}.
            </p>
          )}
          {moneyShort && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-accent)', margin: '0 0 8px', lineHeight: 1.4 }}>
              Faltam <strong>{formatBRL(faltam)}</strong> para o pedido mínimo de {formatBRL(cart.minimo)}.
            </p>
          )}
          {/* Gancho grátis — espelha o nudge do pedido único (SingleScreen), só que o
              gatilho é o valor da Cestinha. */}
          {vaiGanharGratis && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-good)', margin: '0 0 8px', lineHeight: 1.4 }}>
              🎁 Esta Cestinha te dá o gancho de porta grátis!
            </p>
          )}
          {ganchoAlcancavel && !vaiGanharGratis && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', margin: '0 0 8px', lineHeight: 1.4 }}>
              🎁 Chegue a <strong>{formatBRL(cestinhaMin)}</strong> e ganhe o gancho de porta grátis
              {faltaParaGancho > 0 ? ` · faltam ${formatBRL(faltaParaGancho)}` : ''}.{' '}
              <button
                type="button"
                onClick={() => navigate('/client/market')}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent)' }}
              >
                Adicionar mais
              </button>
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)' }}>Subtotal do mercadinho</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
              {formatBRL(cart.subtotal)}
            </span>
          </div>
          <button
            onClick={() => cart.meetsMinimum && navigate('/client/market/checkout')}
            disabled={!cart.meetsMinimum}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
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
            <Icon name="chevR" size={18} color="var(--color-primary-btn-text)" stroke={2.4} />
            Ir para pagamento
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
  onQty,
  onRemove,
}: {
  line: CartLine
  emoji?: string | null
  onQty: (q: number) => void
  onRemove: () => void
}) {
  return (
    <div style={rowStyle}>
      <div style={{ width: 56, flexShrink: 0 }}>
        <ProdPhoto photoUrl={line.photoUrl} emoji={emoji} tintSeed={line.categoryId} alt={line.name} radius={12} height={56} emojiSize={26} dimmed={line.soldOut} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.25 }}>
            {line.name}
          </p>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {formatBRL(line.lineTotal)}
          </span>
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
          {formatBRL(line.price)} · un
        </p>
        {line.stockType === 'DAILY' && line.maxQty != null && line.maxQty < 99 && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
            máx {line.maxQty}/dia
          </p>
        )}
        {line.soldOut && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: 'var(--color-accent)', margin: '3px 0 0' }}>
            Esgotado — remova para continuar
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <StepperInline min={1} max={line.maxQty ?? 99} value={line.qty} onChange={onQty} />
          <button
            onClick={onRemove}
            aria-label={`Remover ${line.name}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, display: 'grid', placeItems: 'center' }}
          >
            <Icon name="trash" size={18} color="var(--color-text-ter)" stroke={1.9} />
          </button>
        </div>
      </div>
    </div>
  )
}
