import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { SwitchToggle } from '../../../components/admin/SwitchToggle'
import { ConfirmSheet } from '../../../components/admin/ConfirmSheet'
import type { MarketCategory, MarketProduct } from './MarketProdutos'

const WEEKDAYS: { key: string; label: string }[] = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
]

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

interface Combo {
  name: string
  quantity: number
  price: number
}

interface MarketProductFormProps {
  id?: string
  categories: MarketCategory[]
  onBack: () => void
  onSaved: () => void
}

export function MarketProductForm({ id, categories, onBack, onSaved }: MarketProductFormProps) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [preco, setPreco] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [stockType, setStockType] = useState<'DAILY' | 'FIXED'>('FIXED')
  const [stockValue, setStockValue] = useState('')
  const [dias, setDias] = useState<string[]>([]) // vazio = sempre
  const [restrito, setRestrito] = useState(false)
  const [ativo, setAtivo] = useState(true)

  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Precificação ao vivo
  const [avulsoUnit, setAvulsoUnit] = useState(0)
  const [combos, setCombos] = useState<Combo[]>([])

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadPricing = async () => {
      try {
        const [aRes, cRes] = await Promise.all([apiFetch('/admin/settings/avulso'), apiFetch('/admin/combos')])
        if (aRes.ok) setAvulsoUnit(((await aRes.json()) as { unitPrice: number }).unitPrice)
        if (cRes.ok) setCombos((await cRes.json()) as Combo[])
      } catch {
        /* silencioso — só afeta a prévia */
      }
    }
    void loadPricing()
  }, [])

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const res = await apiFetch(`/admin/market/products/${id}`)
        if (res.ok) {
          const p = (await res.json()) as MarketProduct
          setNome(p.name)
          setDescricao(p.description ?? '')
          setCategoryId(p.categoryId)
          setPreco(String(p.price))
          setPhotoUrl(p.photoUrl ?? null)
          setStockType(p.stockType)
          setStockValue(String(p.stockType === 'FIXED' ? (p.stock ?? 0) : (p.dailyCapacity ?? 0)))
          const d = p.availableDays ?? []
          setDias(d)
          setRestrito(d.length > 0)
          setAtivo(p.isActive)
        }
      } catch {
        /* silencioso */
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id])

  const precoNum = Number(preco)
  const paezinhos = avulsoUnit > 0 && precoNum > 0 ? Math.round(precoNum / avulsoUnit) : 0
  const comboCosts = combos
    .filter((c) => c.quantity > 0)
    .map((c) => ({ name: c.name, cost: paezinhos * (c.price / c.quantity) }))
  const minCombo = comboCosts.length ? comboCosts.reduce((a, b) => (b.cost < a.cost ? b : a)) : null
  const maxCombo = comboCosts.length ? comboCosts.reduce((a, b) => (b.cost > a.cost ? b : a)) : null

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await apiFetch('/admin/market/upload', { method: 'POST', body: fd })
      if (res.ok) {
        setPhotoUrl(((await res.json()) as { url: string }).url)
      } else {
        const e = (await res.json().catch(() => null)) as { error?: string } | null
        setError(e?.error ?? 'Não foi possível enviar a foto.')
      }
    } catch {
      setError('Erro de conexão ao enviar a foto.')
    } finally {
      setUploading(false)
    }
  }

  const toggleDia = (key: string) =>
    setDias((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]))

  const isValid =
    nome.trim() !== '' && categoryId !== '' && precoNum > 0 && Number(stockValue) >= 0 &&
    (!restrito || dias.length > 0)

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      const stockNum = Number(stockValue)
      const daysPayload = restrito ? dias : id ? null : undefined
      const body = {
        name: nome.trim(),
        description: descricao.trim() ? descricao.trim() : id ? null : undefined,
        categoryId,
        price: precoNum,
        photoUrl: photoUrl ?? (id ? null : undefined),
        stockType,
        ...(stockType === 'FIXED' ? { stock: stockNum } : { dailyCapacity: stockNum }),
        availableDays: daysPayload,
        isActive: ativo,
      }
      const res = await apiFetch(id ? `/admin/market/products/${id}` : '/admin/market/products', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      if (res.ok) {
        onSaved()
      } else {
        const e = (await res.json().catch(() => null)) as { error?: string } | null
        setError(e?.error ?? 'Não foi possível salvar. Tente novamente.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setConfirmDelete(false)
    setSaving(true)
    try {
      const res = await apiFetch(`/admin/market/products/${id}`, { method: 'DELETE' })
      if (res.ok) onSaved()
      else setError('Não foi possível excluir.')
    } catch {
      setError('Erro de conexão.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
        Carregando...
      </div>
    )
  }

  return (
    <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sub-AppBar do form */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 4px' }}>
        <button type="button" aria-label="Voltar" onClick={onBack} style={miniBackStyle}>
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>
          {id ? 'Editar produto' : 'Novo produto'}
        </h3>
      </div>

      {/* Foto */}
      <div>
        <FieldLabel>Foto do produto</FieldLabel>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleUpload(f)
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            width: '100%',
            minHeight: 120,
            borderRadius: 14,
            border: '1.5px dashed var(--color-border)',
            background: 'var(--color-surface-alt, #FBF6EC)',
            cursor: uploading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: 0,
          }}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="Prévia" style={{ width: '100%', height: 160, objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              {uploading ? 'Enviando…' : 'Toque para enviar (JPG/PNG/WebP ≤ 5 MB)'}
            </span>
          )}
        </button>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '6px 2px 0' }}>
          Sem foto, usamos o ícone da categoria.
        </p>
      </div>

      <TextField label="Nome" value={nome} onChange={setNome} placeholder="Ex.: Geleia de Morango" />
      <TextField label="Descrição (opcional)" value={descricao} onChange={setDescricao} placeholder="Ex.: Feita com morangos da estação" />

      {/* Categoria */}
      <div>
        <FieldLabel>Categoria</FieldLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((c) => {
            const active = categoryId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                style={{
                  minHeight: 36,
                  padding: '0 13px',
                  borderRadius: 999,
                  border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                  background: active ? 'var(--color-surface)' : 'transparent',
                  color: active ? 'var(--color-accent)' : 'var(--color-text-sec)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {c.emoji ? `${c.emoji} ` : ''}{c.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Preço + precificação ao vivo */}
      <div>
        <TextField label="Preço (R$)" value={preco} onChange={setPreco} placeholder="Ex.: 12.00" type="number" step="0.01" />
        {paezinhos > 0 && (
          <div style={{ background: 'var(--color-espresso)', borderRadius: 12, padding: '11px 13px', marginTop: 8 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-gold, #E3AC3F)', margin: 0 }}>
              🥖 = {paezinhos} pãezinhos <span style={{ color: '#C9B79A', fontWeight: 600 }}>({formatBRL(avulsoUnit)}/pão)</span>
            </p>
            {minCombo && maxCombo && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#C9B79A', margin: '4px 0 0', lineHeight: 1.4 }}>
                Com saldo, o cliente gasta o equivalente a <strong style={{ color: '#F4E8D2' }}>{formatBRL(minCombo.cost)}</strong> ({minCombo.name})
                {maxCombo.name !== minCombo.name ? <> a <strong style={{ color: '#F4E8D2' }}>{formatBRL(maxCombo.cost)}</strong> ({maxCombo.name})</> : null}.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tipo de estoque */}
      <div>
        <FieldLabel>Tipo de estoque</FieldLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <SegBtn active={stockType === 'DAILY'} onClick={() => setStockType('DAILY')} title="Diário" sub="Reseta a cada dia" />
          <SegBtn active={stockType === 'FIXED'} onClick={() => setStockType('FIXED')} title="Fixo" sub="Inventário total" />
        </div>
      </div>

      <TextField
        label={stockType === 'FIXED' ? 'Quantidade em estoque' : 'Capacidade por dia'}
        value={stockValue}
        onChange={setStockValue}
        placeholder="Ex.: 18"
        type="number"
      />

      {/* Disponibilidade */}
      <div>
        <FieldLabel>Disponibilidade</FieldLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: restrito ? 10 : 0 }}>
          <SegBtn active={!restrito} onClick={() => setRestrito(false)} title="Sempre" sub="Todos os dias" />
          <SegBtn active={restrito} onClick={() => setRestrito(true)} title="Dias da semana" sub="Escolher dias" />
        </div>
        {restrito && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {WEEKDAYS.map((d) => {
              const on = dias.includes(d.key)
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDia(d.key)}
                  style={{
                    minWidth: 46,
                    minHeight: 34,
                    borderRadius: 10,
                    border: on ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                    background: on ? 'var(--color-surface)' : 'transparent',
                    color: on ? 'var(--color-accent)' : 'var(--color-text-sec)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Ativo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 14, padding: '12px 14px' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Produto ativo</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '1px 0 0' }}>Aparece no catálogo do cliente</p>
        </div>
        <SwitchToggle on={ativo} onChange={() => setAtivo((v) => !v)} aria-label="Ativar produto" />
      </div>

      {error && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent)', margin: 0 }}>{error}</p>
      )}

      {/* Salvar */}
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={!isValid || saving || uploading}
        style={{
          width: '100%',
          minHeight: 52,
          background: 'var(--color-espresso)',
          color: '#FAF5EC',
          border: 'none',
          borderRadius: 16,
          fontFamily: 'var(--font-body)',
          fontSize: 16,
          fontWeight: 700,
          cursor: !isValid || saving || uploading ? 'default' : 'pointer',
          opacity: !isValid || saving || uploading ? 0.5 : 1,
        }}
      >
        {saving ? 'Salvando...' : id ? 'Salvar alterações' : 'Criar produto'}
      </button>

      {id && (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={saving}
          style={{ width: '100%', minHeight: 44, background: 'none', border: 'none', color: 'var(--color-bad, #C2410C)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Excluir produto
        </button>
      )}

      <ConfirmSheet
        open={confirmDelete}
        title="Excluir produto?"
        description="O produto sai do catálogo permanentemente. Para apenas ocultar, use o toggle 'Produto ativo'."
        confirmLabel="Excluir"
        tone="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

// ── primitivas locais ──
const miniBackStyle: React.CSSProperties = {
  background: 'var(--color-surface-2)',
  border: 'none',
  width: 34,
  height: 34,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', marginBottom: 7 }}>
      {children}
    </div>
  )
}

function TextField({
  label, value, onChange, placeholder, type = 'text', step,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  step?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <label style={{ display: 'block' }}>
      <FieldLabel>{label}</FieldLabel>
      <div
        style={{
          background: 'var(--color-surface-alt, #FBF6EC)',
          border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 14,
          padding: '12px 14px',
        }}
      >
        <input
          type={type}
          value={value}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--color-text)',
          }}
        />
      </div>
    </label>
  )
}

function SegBtn({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        borderRadius: 12,
        border: active ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-border)',
        background: active ? 'var(--color-surface)' : 'transparent',
        padding: '10px 12px',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: active ? 'var(--color-accent)' : 'var(--color-text)', margin: 0 }}>{title}</p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '1px 0 0' }}>{sub}</p>
    </button>
  )
}
