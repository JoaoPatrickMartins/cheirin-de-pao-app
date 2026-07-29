import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { SwitchToggle } from '../../../components/admin/SwitchToggle'

/**
 * SupplierProdutos — editor da matriz de fornecimento de UM fornecedor (D-7/D-8).
 *
 * A existência da linha é a afirmação "fornece este produto": ligar o switch cria o vínculo (com
 * custo), desligar remove. Sem vínculo não há custo cadastrável e o fornecedor não aparece como
 * opção para aquele produto na hora de gerar o pedido.
 *
 * Antes disto o fornecimento era um preço único por fornecedor (`Supplier.pricePerUnit`, o do pão)
 * e um percentual global de rateio — impossível dizer "o bolo de fubá vem 50% do X e 50% do Y".
 */

interface ProductOption {
  id: string
  name: string
  isActive: boolean
}

/** Linha da matriz vinda de GET /admin/suppliers/:id/products. */
interface MatrixRow {
  productId: string
  productName: string
  productActive: boolean
  stockType: string
  unitCost: number
  defaultSharePct: number
  isPreferred: boolean
  minOrderQty: number | null
  isActive: boolean
}

/** Estado editável de uma linha (custo como texto para o input aceitar digitação parcial). */
interface Draft {
  productId: string
  productName: string
  supplies: boolean
  unitCost: string
  defaultSharePct: string
  isPreferred: boolean
  minOrderQty: string
}

function fmtCost(v: number): string {
  return v.toFixed(2).replace('.', ',')
}
function parseCost(s: string): number {
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function SupplierProdutos({ supplierId }: { supplierId: string }) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  /** Σ das fatias dos OUTROS fornecedores, por produto — para mostrar o quanto falta fechar. */
  const [otherShares, setOtherShares] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [prodRes, matrixRes] = await Promise.all([
        apiFetch('/admin/market/products'),
        apiFetch(`/admin/suppliers/${supplierId}/products`),
      ])
      const products: ProductOption[] = prodRes.ok ? await prodRes.json() : []
      const matrix: MatrixRow[] = matrixRes.ok ? (await matrixRes.json()).products : []
      const byId = new Map(matrix.map((m) => [m.productId, m]))

      setDrafts(
        products
          .filter((p) => p.isActive || byId.has(p.id)) // inativo só aparece se já é fornecido
          .map((p) => {
            const m = byId.get(p.id)
            return {
              productId: p.id,
              productName: p.name,
              supplies: !!m,
              unitCost: m ? fmtCost(m.unitCost) : '',
              defaultSharePct: m ? String(m.defaultSharePct) : '0',
              isPreferred: m?.isPreferred ?? false,
              minOrderQty: m?.minOrderQty != null ? String(m.minOrderQty) : '',
            }
          }),
      )

      // Fatias dos outros fornecedores, por produto (leitura da visão espelhada).
      const shares: Record<string, number> = {}
      await Promise.all(
        products.map(async (p) => {
          const r = await apiFetch(`/admin/market/products/${p.id}/suppliers`)
          if (!r.ok) return
          const list = (await r.json()).suppliers as Array<{ supplierId: string; defaultSharePct: number; isActive: boolean }>
          shares[p.id] = list
            .filter((x) => x.supplierId !== supplierId && x.isActive)
            .reduce((s, x) => s + x.defaultSharePct, 0)
        }),
      )
      setOtherShares(shares)
    } catch {
      /* falha silenciosa — padrão das telas do hub */
    } finally {
      setLoading(false)
    }
  }, [supplierId])

  useEffect(() => {
    void load()
  }, [load])

  function patch(productId: string, next: Partial<Draft>) {
    setMsg(null)
    setDrafts((prev) => prev.map((d) => (d.productId === productId ? { ...d, ...next } : d)))
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const products = drafts
        .filter((d) => d.supplies)
        .map((d) => ({
          productId: d.productId,
          unitCost: parseCost(d.unitCost),
          defaultSharePct: Number(d.defaultSharePct || 0),
          isPreferred: d.isPreferred,
          minOrderQty: d.minOrderQty ? Number(d.minOrderQty) : null,
          isActive: true,
        }))
      const bad = products.find((p) => !(p.unitCost > 0))
      if (bad) {
        const name = drafts.find((d) => d.productId === bad.productId)?.productName ?? ''
        setMsg({ text: `Informe o custo de "${name}".`, ok: false })
        return
      }
      const r = await apiFetch(`/admin/suppliers/${supplierId}/products`, {
        method: 'PUT',
        body: JSON.stringify({ products }),
      })
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string }
        setMsg({ text: err.error ?? 'Não foi possível salvar.', ok: false })
        return
      }
      setMsg({ text: 'Fornecimento salvo!', ok: true })
      await load()
    } catch {
      setMsg({ text: 'Erro de conexão.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)', textAlign: 'center', padding: '16px 0' }}>
        Carregando produtos...
      </p>
    )
  }

  const supplying = drafts.filter((d) => d.supplies)

  return (
    <div
      style={{
        background: 'var(--color-surface-alt, #FBF6EC)',
        border: '1.5px solid var(--color-border)',
        borderRadius: 14,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
          Produtos fornecidos
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '3px 0 0' }}>
          Ligue o que este fornecedor fornece e informe o custo dele. A fatia define quanto da
          demanda vai para cá quando o pedido é gerado — deixe 0% em todos e o padrão leva tudo.
        </p>
      </div>

      {drafts.length === 0 && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-sec)', margin: 0 }}>
          Nenhum produto cadastrado ainda. Crie produtos em Além do Pãozin › Produtos.
        </p>
      )}

      {drafts.map((d) => {
        const others = otherShares[d.productId] ?? 0
        const mine = Number(d.defaultSharePct || 0)
        const sum = others + mine
        // A soma tem de fechar 0 (padrão leva tudo) ou 100 — o backend rejeita o resto.
        const shareWarn = d.supplies && sum !== 0 && sum !== 100
        return (
          <div
            key={d.productId}
            style={{
              background: 'var(--color-surface)',
              border: `1px solid ${shareWarn ? '#E2B4A0' : 'var(--color-border-2)'}`,
              borderRadius: 12,
              padding: 11,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {d.productName}
              </span>
              <SwitchToggle on={d.supplies} onChange={() => patch(d.productId, { supplies: !d.supplies })} />
            </div>

            {d.supplies && (
              <>
                <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                  <Field label="Custo (R$)" flex={1.2}>
                    <input
                      value={d.unitCost}
                      onChange={(e) => patch(d.productId, { unitCost: e.target.value })}
                      inputMode="decimal"
                      placeholder="0,00"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Fatia (%)" flex={1}>
                    <input
                      value={d.defaultSharePct}
                      onChange={(e) => patch(d.productId, { defaultSharePct: e.target.value.replace(/\D/g, '') })}
                      inputMode="numeric"
                      placeholder="0"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Mín. pedido" flex={1}>
                    <input
                      value={d.minOrderQty}
                      onChange={(e) => patch(d.productId, { minOrderQty: e.target.value.replace(/\D/g, '') })}
                      inputMode="numeric"
                      placeholder="—"
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={d.isPreferred}
                    onChange={(e) => patch(d.productId, { isPreferred: e.target.checked })}
                    style={{ width: 17, height: 17, accentColor: 'var(--color-espresso)' }}
                  />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-sec)' }}>
                    Fornecedor padrão deste produto
                  </span>
                </label>

                {shareWarn && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: '#B4541F', margin: '7px 0 0' }}>
                    As fatias deste produto somam {sum}% ({others}% em outros fornecedores).
                    {sum < 100 ? ` Faltam ${100 - sum}%.` : ` Sobram ${sum - 100}%.`}
                  </p>
                )}
                {others > 0 && !shareWarn && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '7px 0 0' }}>
                    Outros fornecedores deste produto: {others}%.
                  </p>
                )}
              </>
            )}
          </div>
        )
      })}

      {msg && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: msg.ok ? 'var(--color-good)' : '#B4541F', margin: 0 }}>
          {msg.text}
        </p>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        style={{
          minHeight: 44,
          borderRadius: 13,
          border: '1.5px solid var(--color-border)',
          background: 'var(--color-surface)',
          fontFamily: 'var(--font-body)',
          fontSize: 14.5,
          fontWeight: 700,
          color: 'var(--color-text)',
          cursor: saving ? 'default' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Salvando...' : `Salvar fornecimento (${supplying.length})`}
      </button>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 38,
  borderRadius: 10,
  border: '1px solid var(--color-border-2)',
  background: 'var(--color-surface-2)',
  padding: '0 10px',
  fontFamily: 'var(--font-body)',
  fontSize: 13.5,
  color: 'var(--color-text)',
}

function Field({ label, flex, children }: { label: string; flex: number; children: React.ReactNode }) {
  return (
    <div style={{ flex, minWidth: 0 }}>
      <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-ter)', marginBottom: 3 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
