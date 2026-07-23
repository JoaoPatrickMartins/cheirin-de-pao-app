import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useMarketCatalog } from '../../hooks/useMarketCatalog'
import { ProdCard } from '../../components/client/ProdCard'
import { CartButton } from '../../components/client/CartButton'
import { Icon } from '../../components/brand/Icon'

/**
 * MarketCatalog — catálogo do mini market "Além do Pãozin" (aba Cestinha).
 * Read-only na Onda 2: browsear produtos, filtrar por categoria/busca e abrir o detalhe.
 * A Cestinha (add + botão flutuante) chega na Onda 3.
 */
export function MarketCatalog() {
  const navigate = useNavigate()
  const { categories, products, avulsoUnit, maxEconomyPercent, isLoading, error, reload } =
    useMarketCatalog()

  const [activeCat, setActiveCat] = useState<string>('all')
  const [query, setQuery] = useState('')

  const emojiOf = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.emoji ?? null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (activeCat !== 'all' && p.categoryId !== activeCat) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [products, activeCat, query])

  return (
    <div style={{ background: 'var(--color-app-bg)', minHeight: 'calc(100dvh - 56px)', paddingBottom: 24 }}>
      {/* AppBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 'calc(16px + env(safe-area-inset-top)) 20px 12px' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--color-espresso)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="basket" size={22} color="var(--color-gold)" stroke={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 21,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Além do Pãozin
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', margin: '1px 0 0' }}>
            Chega junto com o seu pão
          </p>
        </div>
        <CartButton />
      </div>

      {/* Banner "Duas formas de pagar" */}
      <div style={{ padding: '0 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--color-espresso)',
            borderRadius: 16,
            padding: '13px 15px',
          }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(227,172,63,0.18)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="coin" size={19} color="var(--color-gold)" stroke={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: '#FBF3E4', margin: 0 }}>
              Duas formas de pagar
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#C9B79A', margin: '2px 0 0', lineHeight: 1.35 }}>
              Em dinheiro ou com seus pãezinhos
              {maxEconomyPercent > 0 ? ` — economize até ${Math.round(maxEconomyPercent)}%` : ''}.
            </p>
          </div>
        </div>
      </div>

      {/* Busca */}
      <div style={{ padding: '14px 20px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 13,
            padding: '10px 13px',
          }}
        >
          <Icon name="search" size={18} color="var(--color-text-ter)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no Além do Pãozin"
            aria-label="Buscar produtos"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--color-text)',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}
            >
              <Icon name="x" size={16} color="var(--color-text-ter)" />
            </button>
          )}
        </div>
      </div>

      {/* Chips de categoria */}
      {categories.length > 0 && (
        <div
          className="cdp-carousel"
          style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 20px 2px', scrollSnapType: 'x proximity' }}
        >
          <CatChip label="Tudo" active={activeCat === 'all'} onClick={() => setActiveCat('all')} />
          {categories.map((c) => (
            <CatChip
              key={c.id}
              label={`${c.emoji ? `${c.emoji} ` : ''}${c.name}`}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
            />
          ))}
        </div>
      )}

      {/* Grid / estados */}
      <div style={{ padding: '14px 20px 0' }}>
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="cdp-shimmer" style={{ height: 190, borderRadius: 18 }} />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            title="Não foi possível carregar"
            subtitle={error}
            action={{ label: 'Tentar novamente', onClick: reload }}
          />
        ) : products.length === 0 ? (
          <EmptyState
            title="Em breve por aqui"
            subtitle="O Além do Pãozin ainda não tem produtos. Volte logo!"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nada encontrado"
            subtitle={query ? `Nenhum produto para "${query.trim()}".` : 'Nenhum produto nesta categoria.'}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {filtered.map((p) => (
              <ProdCard
                key={p.id}
                product={p}
                emoji={emojiOf(p.categoryId)}
                avulsoUnit={avulsoUnit}
                economyPercent={maxEconomyPercent}
                onOpen={() => navigate(`/client/market/produto/${p.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        minHeight: 36,
        padding: '0 14px',
        borderRadius: 999,
        border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
        background: active ? 'var(--color-surface)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-sec)',
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 13,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        scrollSnapAlign: 'start',
      }}
    >
      {label}
    </button>
  )
}

function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '48px 20px', textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--color-surface-2)', display: 'grid', placeItems: 'center' }}>
        <Icon name="basket" size={26} color="var(--color-text-ter)" stroke={1.8} />
      </div>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--color-text)', margin: '4px 0 0', letterSpacing: '-0.01em' }}>
        {title}
      </p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-ter)', margin: 0, lineHeight: 1.4, maxWidth: 260 }}>
        {subtitle}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 8,
            minHeight: 44,
            padding: '0 18px',
            borderRadius: 'var(--radius-btn)',
            border: 'none',
            background: 'var(--color-espresso)',
            color: '#FAF5EC',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
