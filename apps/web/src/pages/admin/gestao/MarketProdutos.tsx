import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { FilterChips } from '../../../components/admin/FilterChips'
import { PauseProductSheet } from '../../../components/admin/PauseProductSheet'
import { MarketProductsReorder } from '../../../components/admin/MarketProductsReorder'
import { useNow } from '../../../hooks/useNow'
import { availabilityBadge, windowLabel, type ProductAvailability } from '../../../lib/product-availability'
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
  /** Janela diária de PEDIDO (corte por ciclo de entrega), "HH:MM"; null = sem restrição. */
  availableFrom?: string | null
  availableUntil?: string | null
  isActive: boolean
  sortOrder?: number
  lowStock?: boolean
  /** Estado real: inclui pausa manual/temporária e corte por horário, com motivo e volta. */
  availability?: ProductAvailability
  /** Selo de novidade valendo AGORA (leva o prazo em conta). */
  isNovidade?: boolean
  isNew?: boolean
  newUntil?: string | null
  // ── Promoção (preço) ──
  isPromo?: boolean
  promoType?: 'PERCENT' | 'FIXED' | null
  promoValue?: number | null
  promoUntil?: string | null
  promoPriority?: boolean
  /** A promoção está valendo AGORA (leva o prazo em conta). */
  isPromoVigente?: boolean
  /** Preço COBRADO agora (= `price` quando não há promoção vigente). */
  effectivePrice?: number
  /** O preço promocional ficou abaixo do custo — avisa, não bloqueia. */
  belowCost?: boolean
  /** Produto fixo "Pão Francês" — preço/estoque travados, não excluível. */
  isBread?: boolean
  // H9 — custo esperado pela matriz de fornecimento (D-8) e margem. null = sem custo cadastrado.
  unitCost?: number | null
  margin?: number | null
  marginPct?: number | null
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function MarketProdutos() {
  const [products, setProducts] = useState<MarketProduct[]>([])
  const [categories, setCategories] = useState<MarketCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)
  const [form, setForm] = useState<null | { editId?: string }>(null)
  const [reordering, setReordering] = useState(false)
  const [pauseTarget, setPauseTarget] = useState<MarketProduct | null>(null)
  const [busy, setBusy] = useState(false)
  const [reorderError, setReorderError] = useState<string | null>(null)

  // A pausa vence sem gerar evento (o estado é derivado no servidor), então a contagem
  // regressiva das pills precisa de um tique local para não congelar.
  const now = useNow(30_000)

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

  const pause = async (payload: { minutes?: number; reason?: string }) => {
    if (!pauseTarget) return
    setBusy(true)
    try {
      const res = await apiFetch(`/admin/market/products/${pauseTarget.id}/pause`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setPauseTarget(null)
        await load()
      }
    } catch {
      // falha silenciosa — o estado na tela continua o último conhecido
    } finally {
      setBusy(false)
    }
  }

  const resume = async () => {
    if (!pauseTarget) return
    setBusy(true)
    try {
      const res = await apiFetch(`/admin/market/products/${pauseTarget.id}/resume`, { method: 'POST' })
      if (res.ok) {
        setPauseTarget(null)
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  const saveOrder = async (payload: { novidades: string[]; promocoes: string[]; catalogo: string[] }) => {
    setBusy(true)
    setReorderError(null)
    try {
      const res = await apiFetch('/admin/market/products/order', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setProducts((await res.json()) as MarketProduct[])
        setReordering(false)
      } else {
        const e = (await res.json().catch(() => null)) as { error?: string } | null
        setReorderError(e?.error ?? 'Não foi possível salvar a ordem.')
      }
    } catch {
      setReorderError('Erro de conexão. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

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

  // O modo ordenar toma a tela: a lista filtrada por categoria não serve para definir uma
  // ordem global, e tap-para-editar brigaria com o arraste.
  if (reordering) {
    return (
      <MarketProductsReorder
        products={products}
        emojiOf={catEmoji}
        saving={busy}
        error={reorderError}
        onCancel={() => {
          setReorderError(null)
          setReordering(false)
        }}
        onSave={(payload) => void saveOrder(payload)}
      />
    )
  }

  return (
    <div style={{ padding: '0 20px 24px' }}>
      {/* Novo produto + ordenar */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={() => setForm({})}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            flex: 1,
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
        {products.length > 1 && (
          <button
            type="button"
            onClick={() => setReordering(true)}
            aria-label="Ordenar vitrine"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              minHeight: 44,
              padding: '0 15px',
              background: 'transparent',
              color: 'var(--color-text)',
              border: '1.5px solid var(--color-border)',
              borderRadius: 14,
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Icon name="list" size={17} color="var(--color-text-sec)" stroke={2} />
            Ordenar
          </button>
        )}
      </div>

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

      {/* Filtro por categoria — nível 2, mesmo chip das outras seções do hub. */}
      {categories.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <FilterChips
            chips={[
              { key: 'all', label: 'Tudo' },
              ...categories.map((c) => ({ key: c.id, label: `${c.emoji ?? ''} ${c.name}`.trim() })),
            ]}
            value={filter ?? 'all'}
            onChange={(k) => setFilter(k === 'all' ? null : k)}
            ariaLabel="Filtrar produtos por categoria"
          />
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
            const st = availabilityBadge(p.availability, now, p.lowStock)
            const paused = p.availability?.state === 'pausado'
            const emPromo = p.isPromoVigente === true
            const janela = windowLabel(p.availableFrom, p.availableUntil)
            const estoqueTxt =
              p.stockType === 'FIXED'
                ? `${p.stock ?? 0} un (fixo)`
                : `${p.dailyCapacity ?? 0}/dia (diário)`
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                {/* Trilho de pausa — marca a linha de relance, sem gritar como erro. */}
                {paused && <span aria-hidden="true" style={{ width: 4, background: 'var(--color-gold)', flexShrink: 0 }} />}

                <button
                  type="button"
                  onClick={() => setForm({ editId: p.id })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: 'transparent',
                    border: 'none',
                    padding: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                    flex: 1,
                    minWidth: 0,
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
                      filter: paused ? 'grayscale(45%)' : undefined,
                      opacity: paused ? 0.75 : 1,
                    }}
                  >
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span>{catEmoji(p.categoryId)}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </p>
                      {p.isNovidade && (
                        <span
                          style={{
                            flexShrink: 0,
                            fontFamily: 'var(--font-body)',
                            fontSize: 9.5,
                            fontWeight: 800,
                            letterSpacing: '0.06em',
                            color: 'var(--color-gold)',
                            background: 'var(--color-espresso)',
                            padding: '2px 6px',
                            borderRadius: 999,
                          }}
                        >
                          ✦ NOVIDADE
                        </span>
                      )}
                      {/* O admin precisa distinguir promoção COM e SEM destaque — no cliente as
                          duas mostram o mesmo selo, mas só uma fura fila. */}
                      {emPromo && (
                        <span
                          style={{
                            flexShrink: 0,
                            fontFamily: 'var(--font-body)',
                            fontSize: 9.5,
                            fontWeight: 800,
                            letterSpacing: '0.06em',
                            color: 'var(--color-accent)',
                            background: 'var(--color-gold-soft, #F3DDA6)',
                            padding: '2px 6px',
                            borderRadius: 999,
                          }}
                        >
                          🏷 {p.promoPriority ? 'PROMO · DESTAQUE' : 'PROMO'}
                        </span>
                      )}
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
                      {catName(p.categoryId)} ·{' '}
                      {emPromo ? (
                        <>
                          <span style={{ textDecoration: 'line-through' }}>{formatBRL(p.price)}</span>{' '}
                          <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
                            {formatBRL(p.effectivePrice ?? p.price)}
                          </span>
                        </>
                      ) : (
                        formatBRL(p.price)
                      )}{' '}
                      · {estoqueTxt}
                      {janela ? ` · 🕐 ${janela}` : ''}
                    </p>
                    {/* H9 — margem onde o preço é definido. "sem custo" é dito explicitamente: um
                        produto sem fornecedor cadastrado não tem margem de 100%, tem margem
                        desconhecida. O pão é ignorado (preço travado, não é venda de mercadinho). */}
                    {!p.isBread && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, margin: '1px 0 0', color: p.margin == null ? 'var(--color-text-ter)' : p.margin < 0 ? 'var(--color-warn)' : 'var(--color-good)' }}>
                        {p.margin == null
                          ? 'custo não cadastrado'
                          : `${p.belowCost ? '⚠ ' : ''}custo ${formatBRL(p.unitCost ?? 0)} · margem ${formatBRL(p.margin)} (${p.marginPct}%)`}
                      </p>
                    )}
                  </div>
                </button>

                {/* Estado + atalho de pausa. Fora do botão de editar: pausar é ação de pânico e
                    precisa estar a dois toques da lista, sem entrar no produto. */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 6, padding: '12px 12px 12px 0', flexShrink: 0 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: st.color,
                      background: st.bg,
                      padding: '3px 9px',
                      borderRadius: 999,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {paused ? '⏸ ' : ''}
                    {st.label}
                    {st.detail ? ` · ${st.detail}` : ''}
                  </span>
                  {!p.isBread && (
                    <button
                      type="button"
                      onClick={() => setPauseTarget(p)}
                      aria-label={paused ? `Ver pausa de ${p.name}` : `Pausar ${p.name}`}
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: 'var(--color-text-sec)',
                        background: 'var(--color-surface-2)',
                        border: 'none',
                        borderRadius: 999,
                        padding: '4px 10px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {paused ? 'gerenciar' : '⏸ pausar'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PauseProductSheet
        open={pauseTarget != null}
        productName={pauseTarget?.name ?? ''}
        availability={pauseTarget?.availability}
        busy={busy}
        onPause={(payload) => void pause(payload)}
        onResume={() => void resume()}
        onCancel={() => setPauseTarget(null)}
      />
    </div>
  )
}

