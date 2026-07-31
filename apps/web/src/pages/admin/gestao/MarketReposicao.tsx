import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'

/**
 * MarketReposicao — comprar reposição de inventário (produtos de estoque FIXO) — Onda H8 / D-9.
 *
 * Até aqui não existia caminho nenhum: o pedido ao fornecedor é sempre por turno e derivado da
 * demanda do dia, o que não faz sentido para geleia (não se compra 3 potes porque 3 pessoas pediram
 * hoje — repõe-se quando está acabando). A tela mostra a sugestão do servidor (ritmo de venda ×
 * dias de cobertura − estoque), deixa o admin ajustar quantidade por fornecedor e cria o pedido.
 *
 * O rateio e o custo vêm do backend: a tela NÃO reimplementa a regra (duas implementações do mesmo
 * arredondamento sempre divergem, e aí o que a tela mostra deixa de ser o que o botão faz).
 */

interface SuggestionOption {
  supplierId: string
  supplierName: string
  unitCost: number
  defaultSharePct: number
  isPreferred: boolean
  minOrderQty: number | null
  suggested: number
  belowMinimum: boolean
}

interface SuggestionProduct {
  productId: string
  productName: string
  stock: number
  sold: number
  dailyRate: number
  coverDays: number | null
  suggestedQty: number
  basis: 'CONSUMPTION' | 'FALLBACK'
  lowStock: boolean
  outOfStock: boolean
  options: SuggestionOption[]
}

interface Suggestion {
  coverDays: number
  products: SuggestionProduct[]
  unsourced: Array<{ productId: string; productName: string; qty: number }>
  totalQuantity: number
  totalValue: number
}

const COVER_OPTIONS = [7, 15, 30, 60]

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-2)',
  borderRadius: 16,
  padding: 14,
}

export function MarketReposicao() {
  const [coverDays, setCoverDays] = useState(30)
  const [data, setData] = useState<Suggestion | null>(null)
  const [loading, setLoading] = useState(true)
  /** Quantidade editada por (produto|fornecedor). Ausente = usa a sugestão do servidor. */
  const [qty, setQty] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/admin/supplier-orders/restock-suggestion?coverDays=${coverDays}`)
      if (res.ok) {
        setData((await res.json()) as Suggestion)
        setQty({}) // sugestão nova → descarta ajustes da anterior
      }
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [coverDays])

  useEffect(() => {
    void load()
  }, [load])

  const key = (productId: string, supplierId: string) => `${productId}|${supplierId}`
  const valueOf = (p: SuggestionProduct, o: SuggestionOption) => qty[key(p.productId, o.supplierId)] ?? o.suggested

  const linhas = (data?.products ?? []).flatMap((p) =>
    p.options
      .map((o) => ({ productId: p.productId, supplierId: o.supplierId, quantity: valueOf(p, o), unitCost: o.unitCost }))
      .filter((l) => l.quantity > 0),
  )
  const totalUnidades = linhas.reduce((s, l) => s + l.quantity, 0)
  const totalValor = linhas.reduce((s, l) => s + l.quantity * l.unitCost, 0)

  async function comprar() {
    if (linhas.length === 0 || saving) return
    setSaving(true)
    try {
      const res = await apiFetch('/admin/supplier-orders/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: linhas.map((l) => ({ supplierId: l.supplierId, productId: l.productId, quantity: l.quantity })),
        }),
      })
      if (res.ok) {
        const r = (await res.json()) as { totalItems: number; totalValue: number }
        setToast({ msg: `Reposição criada · ${r.totalItems} un · ${fmtBRL(r.totalValue)}`, ok: true })
        await load()
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        setToast({ msg: err?.error ?? 'Falha ao criar a reposição', ok: false })
      }
    } catch {
      setToast({ msg: 'Falha na conexão', ok: false })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '0 20px 24px' }}>
      {/* Cobertura desejada — é o parâmetro do admin, não uma constante escondida no código */}
      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 3px' }}>
          Cobertura desejada
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '0 0 10px', lineHeight: 1.4 }}>
          Quantos dias de estoque a sugestão tenta cobrir, pelo ritmo de venda dos últimos 30 dias.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {COVER_OPTIONS.map((d) => {
            const active = d === coverDays
            return (
              <button
                key={d}
                type="button"
                onClick={() => setCoverDays(d)}
                style={{
                  flex: 1,
                  minHeight: 38,
                  borderRadius: 11,
                  border: active ? 'none' : '1px solid var(--color-border)',
                  background: active ? 'var(--color-espresso)' : 'transparent',
                  color: active ? '#FAF5EC' : 'var(--color-text-sec)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {d}d
              </button>
            )
          })}
        </div>
      </div>

      {loading && <div style={{ height: 80, borderRadius: 16, background: 'var(--color-surface-2)' }} />}

      {!loading && data && data.products.length === 0 && data.unsourced.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '22px 14px' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-ter)', margin: 0 }}>
            Nenhum produto de estoque precisa de reposição.
          </p>
        </div>
      )}

      {/* Produto sem fornecedor: não pode ser pedido e NÃO pode desaparecer da tela em silêncio */}
      {!loading && data && data.unsourced.length > 0 && (
        <div style={{ ...cardStyle, background: 'var(--color-gold-soft, #F3DDA6)', border: 'none', marginBottom: 12 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: '#6b4e12', margin: 0, lineHeight: 1.45 }}>
            ⚠️ Sem fornecedor cadastrado: {data.unsourced.map((u) => `${u.productName} (${u.qty})`).join(', ')}.
            Cadastre o produto no fornecedor para poder comprar.
          </p>
        </div>
      )}

      {!loading &&
        data?.products.map((p) => (
          <div key={p.productId} style={{ ...cardStyle, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0, flex: 1, minWidth: 0 }}>
                {p.productName}
              </p>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: p.outOfStock ? 'var(--color-warn)' : p.lowStock ? 'var(--color-accent)' : 'var(--color-text-ter)',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.outOfStock ? 'esgotado' : `${p.stock} em estoque`}
              </span>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '2px 0 10px', lineHeight: 1.4 }}>
              {p.basis === 'CONSUMPTION' ? (
                <>
                  {p.sold} vendidos em 30 dias ({p.dailyRate}/dia)
                  {p.coverDays != null ? ` · cobre ${p.coverDays} dia${p.coverDays === 1 ? '' : 's'}` : ''}
                </>
              ) : (
                // Sem venda medida a sugestão é um piso — dizer isso evita o admin confiar num número
                // que não tem base (o produto pode ter vendido zero por estar esgotado).
                <>sem venda nos últimos 30 dias — sugestão mínima, ajuste se souber o giro</>
              )}
            </p>

            {p.options.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-warn)', margin: 0 }}>
                Nenhum fornecedor cadastrado para este produto.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.options.map((o) => {
                  const v = valueOf(p, o)
                  return (
                    <div key={o.supplierId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-sec)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.supplierName}
                          {o.isPreferred && <span style={{ color: 'var(--color-accent)' }}> ★</span>}
                        </p>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: 0 }}>
                          {fmtBRL(o.unitCost)}/un · {fmtBRL(v * o.unitCost)}
                          {o.minOrderQty != null && o.minOrderQty > 0 && v > 0 && v < o.minOrderQty
                            ? ` · mínimo ${o.minOrderQty}`
                            : ''}
                        </p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={v}
                        aria-label={`Quantidade de ${p.productName} em ${o.supplierName}`}
                        onChange={(e) =>
                          setQty((prev) => ({
                            ...prev,
                            [key(p.productId, o.supplierId)]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                          }))
                        }
                        style={{
                          width: 68,
                          minHeight: 38,
                          textAlign: 'center',
                          borderRadius: 10,
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface-2)',
                          fontFamily: 'var(--font-display)',
                          fontSize: 15,
                          fontWeight: 700,
                          color: 'var(--color-text)',
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}

      {/* Rodapé de compra */}
      {!loading && linhas.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
              {totalUnidades} unidade{totalUnidades === 1 ? '' : 's'}
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: 'var(--color-text)' }}>
              {fmtBRL(totalValor)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void comprar()}
            disabled={saving}
            style={{
              width: '100%',
              minHeight: 46,
              borderRadius: 14,
              border: 'none',
              background: saving ? 'var(--color-border)' : 'var(--color-espresso)',
              color: '#FAF5EC',
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Criando…' : 'Criar pedido de reposição'}
          </button>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '8px 0 0', lineHeight: 1.4 }}>
            O pedido é finalizado na hora e aparece no histórico de compras, sem turno. O PDF/Excel
            por fornecedor sai de lá.
          </p>
        </div>
      )}

      {toast && (
        <div
          role="status"
          onClick={() => setToast(null)}
          style={{
            position: 'fixed',
            left: 20,
            right: 20,
            bottom: 88,
            background: toast.ok ? 'var(--color-espresso)' : 'var(--color-warn)',
            color: '#FAF5EC',
            borderRadius: 12,
            padding: '12px 14px',
            fontFamily: 'var(--font-body)',
            fontSize: 13.5,
            fontWeight: 600,
            zIndex: 60,
            cursor: 'pointer',
          }}
        >
          <Icon name="check" size={15} color="#FAF5EC" /> {toast.msg}
        </div>
      )}
    </div>
  )
}
