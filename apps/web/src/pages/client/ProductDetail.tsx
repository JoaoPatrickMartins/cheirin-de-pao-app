import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMarketCatalog } from '../../hooks/useMarketCatalog'
import { useCart } from '../../contexts/CartContext'
import { ProdPhoto } from '../../components/client/ProdPhoto'
import { CartButton } from '../../components/client/CartButton'
import StepperInline from '../../components/client/StepperInline'
import { Icon } from '../../components/brand/Icon'
import { formatBRL, paezinhosDe, formatAvailableDays, type MarketProduct } from '../../lib/market'

/**
 * ProductDetail — detalhe de um produto do mini market. Read-only na Onda 2:
 * foto, painel de 2 preços (À vista R$ × Com pãezinhos = N), descrição, disponibilidade e
 * estados (esgotado / últimas). O botão "Adicionar à Cestinha" chega na Onda 3 (carrinho).
 */
export function ProductDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { categories, products, avulsoUnit, maxEconomyPercent, isLoading, error, reload } =
    useMarketCatalog()

  const product = products.find((p) => p.id === id) ?? null
  const category = product ? categories.find((c) => c.id === product.categoryId) ?? null : null

  return (
    <div style={{ background: 'var(--color-app-bg)', minHeight: 'calc(100dvh - 56px)', paddingBottom: 32 }}>
      {/* AppBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(10px + env(safe-area-inset-top)) 20px 8px' }}>
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <div style={{ flex: 1 }} />
        <CartButton />
      </div>

      {isLoading ? (
        <div style={{ padding: '4px 20px' }}>
          <div className="cdp-shimmer" style={{ width: '100%', height: 280, borderRadius: 22 }} />
          <div className="cdp-shimmer" style={{ width: '60%', height: 24, borderRadius: 8, marginTop: 18 }} />
          <div className="cdp-shimmer" style={{ width: '100%', height: 84, borderRadius: 16, marginTop: 16 }} />
        </div>
      ) : error ? (
        <NotFound
          title="Não foi possível carregar"
          subtitle={error}
          onBack={() => navigate('/client/market')}
          onRetry={reload}
        />
      ) : !product ? (
        <NotFound
          title="Produto indisponível"
          subtitle="Este produto não está mais no catálogo."
          onBack={() => navigate('/client/market')}
        />
      ) : (
        <>
          <ProductBody
            name={product.name}
            description={product.description}
            price={product.price}
            photoUrl={product.photoUrl}
            categoryId={product.categoryId}
            categoryName={category?.name ?? null}
            categoryEmoji={category?.emoji ?? null}
            availableDays={product.availableDays}
            soldOut={product.soldOut}
            limited={product.limited}
            avulsoUnit={avulsoUnit}
            maxEconomyPercent={maxEconomyPercent}
          />
          <DetailFooter product={product} />
        </>
      )}
    </div>
  )
}

/**
 * DetailFooter — rodapé fixo (acima da tab bar) com stepper de quantidade + "Adicionar à
 * Cestinha". Esgotado → CTA desabilitado. Mostra quanto já há na Cestinha.
 */
function DetailFooter({ product }: { product: MarketProduct }) {
  const { addProduct, qtyOf } = useCart()
  const [qty, setQty] = useState(1)
  const [justAdded, setJustAdded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inCart = qtyOf(product.id)

  const handleAdd = () => {
    addProduct(product, qty)
    setQty(1)
    setJustAdded(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setJustAdded(false), 1800)
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'calc(56px + env(safe-area-inset-bottom))',
        background: 'var(--color-app-bg)',
        borderTop: '1px solid var(--color-border-2)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {product.soldOut ? (
        <button
          disabled
          style={{
            flex: 1,
            minHeight: 52,
            borderRadius: 'var(--radius-btn)',
            border: 'none',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text-ter)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 16,
            cursor: 'default',
          }}
        >
          Esgotado
        </button>
      ) : (
        <>
          <StepperInline min={1} max={99} value={qty} onChange={setQty} />
          <button
            onClick={handleAdd}
            style={{
              flex: 1,
              minHeight: 52,
              borderRadius: 'var(--radius-btn)',
              border: 'none',
              background: justAdded ? 'var(--color-good)' : 'var(--color-espresso)',
              color: '#FBF3E4',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 15.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background .2s',
            }}
          >
            {justAdded ? (
              <>
                <Icon name="check" size={18} color="#FBF3E4" /> Adicionado
              </>
            ) : (
              <>
                Adicionar · {formatBRL(product.price * qty)}
                {inCart > 0 ? ` (${inCart})` : ''}
              </>
            )}
          </button>
        </>
      )}
    </div>
  )
}

interface ProductBodyProps {
  name: string
  description?: string | null
  price: number
  photoUrl?: string | null
  categoryId: string
  categoryName: string | null
  categoryEmoji: string | null
  availableDays: string[]
  soldOut: boolean
  limited: boolean
  avulsoUnit: number
  maxEconomyPercent: number
}

function ProductBody({
  name,
  description,
  price,
  photoUrl,
  categoryId,
  categoryName,
  categoryEmoji,
  availableDays,
  soldOut,
  limited,
  avulsoUnit,
  maxEconomyPercent,
}: ProductBodyProps) {
  const paes = paezinhosDe(price, avulsoUnit)
  const showEconomy = maxEconomyPercent > 0
  const restricted = availableDays.length > 0

  return (
    <div style={{ padding: '4px 20px 110px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Foto grande */}
      <div style={{ position: 'relative' }}>
        <ProdPhoto
          photoUrl={photoUrl}
          emoji={categoryEmoji}
          tintSeed={categoryId}
          alt={name}
          radius={22}
          height={280}
          emojiSize={92}
          dimmed={soldOut}
        />
        {soldOut ? (
          <span style={heroBadge('var(--color-text-sec)', '#fff')}>Esgotado</span>
        ) : limited ? (
          <span style={heroBadge('var(--color-gold)', 'var(--color-espresso)')}>Últimas unidades</span>
        ) : null}
      </div>

      {/* Categoria + nome */}
      <div>
        {(categoryName || categoryEmoji) && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent)', margin: '0 0 4px', letterSpacing: '0.02em' }}>
            {categoryEmoji ? `${categoryEmoji} ` : ''}{categoryName ?? ''}
          </p>
        )}
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15 }}>
          {name}
        </h1>
      </div>

      {/* Painel de 2 preços */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-2)',
          borderRadius: 18,
          boxShadow: 'var(--shadow-soft)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex' }}>
          {/* À vista */}
          <div style={{ flex: 1, padding: '15px 16px' }}>
            <p style={priceLabel}>À vista</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: '3px 0 0' }}>
              {formatBRL(price)}
            </p>
          </div>
          {/* divisória */}
          <div style={{ width: 1, background: 'var(--color-border-2)' }} />
          {/* Com pãezinhos */}
          <div style={{ flex: 1, padding: '15px 16px', background: 'var(--color-gold-soft)' }}>
            <p style={{ ...priceLabel, color: 'var(--color-accent)' }}>Com pãezinhos</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--color-accent)', letterSpacing: '-0.02em', margin: '3px 0 0' }}>
              {paes > 0 ? `${paes} 🥖` : '—'}
            </p>
          </div>
        </div>
        {showEconomy && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderTop: '1px solid var(--color-border-2)',
              background: 'var(--color-good-soft)',
            }}
          >
            <Icon name="spark" size={16} color="var(--color-good)" stroke={2} />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-good)', margin: 0 }}>
              Pagando com pãezinhos você economiza até {Math.round(maxEconomyPercent)}%
            </p>
          </div>
        )}
      </div>

      {/* Descrição */}
      {description && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, color: 'var(--color-text-sec)', margin: 0, lineHeight: 1.5 }}>
          {description}
        </p>
      )}

      {/* Disponibilidade (quando restrito a dias) */}
      {restricted && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--color-surface-2)', borderRadius: 13, padding: '11px 13px' }}>
          <Icon name="calendar" size={18} color="var(--color-text-sec)" stroke={2} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-sec)', margin: 0 }}>
            Disponível às <strong style={{ color: 'var(--color-text)' }}>{formatAvailableDays(availableDays)}</strong>
          </p>
        </div>
      )}

      {/* Aviso de estado do estoque */}
      {soldOut ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--color-surface-2)', borderRadius: 13, padding: '11px 13px' }}>
          <Icon name="ban" size={18} color="var(--color-text-sec)" stroke={2} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-sec)', margin: 0 }}>
            Esgotado no momento. Volte em breve.
          </p>
        </div>
      ) : limited ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--color-gold-soft)', borderRadius: 13, padding: '11px 13px' }}>
          <Icon name="alert" size={18} color="var(--color-accent)" stroke={2} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-accent)', margin: 0 }}>
            Últimas unidades disponíveis.
          </p>
        </div>
      ) : null}

      {/* Nota: paga em dinheiro e/ou pãezinhos; chega junto com o pão. */}
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: 0, lineHeight: 1.4 }}>
        Você escolhe quanto pagar em dinheiro ou com pãezinhos na hora de fechar a Cestinha. Chega junto com a entrega do seu pão.
      </p>
    </div>
  )
}

const priceLabel: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 11.5,
  fontWeight: 700,
  color: 'var(--color-text-ter)',
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

function heroBadge(bg: string, color: string): React.CSSProperties {
  return {
    position: 'absolute',
    top: 12,
    left: 12,
    background: bg,
    color,
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    fontWeight: 800,
    borderRadius: 999,
    padding: '5px 12px',
    letterSpacing: '0.01em',
  }
}

function NotFound({
  title,
  subtitle,
  onBack,
  onRetry,
}: {
  title: string
  subtitle: string
  onBack: () => void
  onRetry?: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--color-surface-2)', display: 'grid', placeItems: 'center' }}>
        <Icon name="basket" size={28} color="var(--color-text-ter)" stroke={1.8} />
      </div>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--color-text)', margin: '4px 0 0', letterSpacing: '-0.01em' }}>
        {title}
      </p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-ter)', margin: 0, lineHeight: 1.4, maxWidth: 260 }}>
        {subtitle}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{ minHeight: 44, padding: '0 18px', borderRadius: 'var(--radius-btn)', border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-sec)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Tentar novamente
          </button>
        )}
        <button
          onClick={onBack}
          style={{ minHeight: 44, padding: '0 18px', borderRadius: 'var(--radius-btn)', border: 'none', background: 'var(--color-espresso)', color: '#FAF5EC', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          Ver catálogo
        </button>
      </div>
    </div>
  )
}
