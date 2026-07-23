import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { MarketProductForm } from './MarketProductForm'

export interface MarketCategory {
  id: string
  name: string
  emoji?: string | null
  sortOrder?: number
  productCount?: number
}

export interface MarketProduct {
  id: string
  name: string
  description?: string | null
  categoryId: string
  price: number
  photoUrl?: string | null
  stockType: 'DAILY' | 'FIXED'
  stock: number | null
  dailyCapacity: number | null
  availableDays?: string[] | null
  isActive: boolean
  sortOrder?: number
  lowStock?: boolean
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function statusOf(p: MarketProduct): { label: string; color: string; bg: string } {
  if (!p.isActive) return { label: 'Inativo', color: 'var(--color-text-ter)', bg: 'var(--color-surface-2)' }
  if (p.stockType === 'FIXED' && p.stock != null && p.stock <= 0)
    return { label: 'Esgotado', color: 'var(--color-accent)', bg: 'var(--color-gold-soft, #F3DDA6)' }
  if (p.lowStock) return { label: 'Baixo', color: 'var(--color-accent)', bg: 'var(--color-gold-soft, #F3DDA6)' }
  return { label: 'Ativo', color: 'var(--color-good)', bg: 'var(--color-good-soft)' }
}

export function MarketProdutos() {
  const [products, setProducts] = useState<MarketProduct[]>([])
  const [categories, setCategories] = useState<MarketCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)
  const [form, setForm] = useState<null | { editId?: string }>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, cRes] = await Promise.all([
        apiFetch('/admin/market/products'),
        apiFetch('/admin/market/categories'),
      ])
      if (pRes.ok) setProducts((await pRes.json()) as MarketProduct[])
      if (cRes.ok) setCategories((await cRes.json()) as MarketCategory[])
    } catch {
      // falha silenciosa
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (form) {
    return (
      <MarketProductForm
        id={form.editId}
        categories={categories}
        onBack={() => setForm(null)}
        onSaved={() => {
          setForm(null)
          void load()
        }}
      />
    )
  }

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—'
  const catEmoji = (id: string) => categories.find((c) => c.id === id)?.emoji ?? '🥐'
  const lowStockNames = products.filter((p) => p.lowStock).map((p) => p.name)
  const shown = filter ? products.filter((p) => p.categoryId === filter) : products

  return (
    <div style={{ padding: '0 20px 24px' }}>
      {/* Novo produto */}
      <button
        type="button"
        onClick={() => setForm({})}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          minHeight: 44,
          background: 'var(--color-espresso)',
          color: '#FAF5EC',
          border: 'none',
          borderRadius: 14,
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <Icon name="plus" size={18} color="#FAF5EC" />
        Novo produto
      </button>

      {/* Alerta de baixo estoque */}
      {lowStockNames.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            background: 'var(--color-gold-soft, #F3DDA6)',
            borderRadius: 12,
            padding: '10px 13px',
            marginTop: 12,
          }}
        >
          <span style={{ fontSize: 15 }}>⚠️</span>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: '#6b4e12', margin: 0, lineHeight: 1.4 }}>
            {lowStockNames.length} produto{lowStockNames.length !== 1 ? 's' : ''} com estoque baixo: {lowStockNames.slice(0, 3).join(', ')}
            {lowStockNames.length > 3 ? '…' : ''}
          </p>
        </div>
      )}

      {/* Filtro por categoria */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, overflowX: 'auto', paddingBottom: 2 }}>
          <FilterChip label="Tudo" active={filter === null} onClick={() => setFilter(null)} />
          {categories.map((c) => (
            <FilterChip key={c.id} label={`${c.emoji ?? ''} ${c.name}`.trim()} active={filter === c.id} onClick={() => setFilter(c.id)} />
          ))}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p style={{ textAlign: 'center', paddingTop: 28, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
          Carregando...
        </p>
      ) : shown.length === 0 ? (
        <p style={{ textAlign: 'center', paddingTop: 28, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
          Nenhum produto {filter ? 'nesta categoria' : 'cadastrado'}.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {shown.map((p) => {
            const st = statusOf(p)
            const estoqueTxt =
              p.stockType === 'FIXED'
                ? `${p.stock ?? 0} un (fixo)`
                : `${p.dailyCapacity ?? 0}/dia (diário)`
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setForm({ editId: p.id })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 16,
                  padding: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                {/* Thumb: foto ou emoji da categoria */}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: 'var(--color-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                    fontSize: 24,
                  }}
                >
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>{catEmoji(p.categoryId)}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.3 }}>
                    {p.name}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
                    {catName(p.categoryId)} · {formatBRL(p.price)} · {estoqueTxt}
                  </p>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: st.color,
                    background: st.bg,
                    padding: '3px 9px',
                    borderRadius: 999,
                    flexShrink: 0,
                  }}
                >
                  {st.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        minHeight: 32,
        padding: '0 13px',
        borderRadius: 999,
        border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
        background: active ? 'var(--color-surface)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-sec)',
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 12.5,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}
