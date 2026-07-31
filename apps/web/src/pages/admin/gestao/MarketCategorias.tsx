import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { ConfirmSheet } from '../../../components/admin/ConfirmSheet'
import type { MarketCategory } from './MarketProdutos'

export function MarketCategorias() {
  const [cats, setCats] = useState<MarketCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<null | 'new' | string>(null)
  const [nome, setNome] = useState('')
  const [emoji, setEmoji] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MarketCategory | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiFetch('/admin/market/categories')
      if (r.ok) setCats((await r.json()) as MarketCategory[])
    } catch {
      /* falha silenciosa */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const body = { name: nome.trim(), emoji: emoji.trim() ? emoji.trim() : undefined }
      const isNew = editing === 'new'
      const r = await apiFetch(isNew ? '/admin/market/categories' : `/admin/market/categories/${editing}`, {
        method: isNew ? 'POST' : 'PATCH',
        body: JSON.stringify(body),
      })
      if (r.ok) {
        setEditing(null)
        void load()
      } else {
        const e = (await r.json().catch(() => null)) as { error?: string } | null
        setError(e?.error ?? 'Não foi possível salvar.')
      }
    } catch {
      setError('Erro de conexão.')
    } finally {
      setSaving(false)
    }
  }

  const del = async (c: MarketCategory) => {
    setPendingDelete(null)
    setError(null)
    try {
      const r = await apiFetch(`/admin/market/categories/${c.id}`, { method: 'DELETE' })
      if (r.ok) void load()
      else {
        const e = (await r.json().catch(() => null)) as { error?: string } | null
        setError(e?.error ?? 'Não foi possível excluir.')
      }
    } catch {
      setError('Erro de conexão.')
    }
  }

  // Formulário (nova/editar)
  if (editing) {
    return (
      <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
          <button type="button" aria-label="Voltar" onClick={() => setEditing(null)} style={miniBackStyle}>
            <Icon name="arrowL" size={18} color="var(--color-text)" />
          </button>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>
            {editing === 'new' ? 'Nova categoria' : 'Editar categoria'}
          </h3>
        </div>

        <Field label="Nome" value={nome} onChange={setNome} placeholder="Ex.: Geleias & Mel" />
        <Field label="Emoji (opcional)" value={emoji} onChange={setEmoji} placeholder="Ex.: 🍯" />

        {error && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent)', margin: 0 }}>{error}</p>}

        <button
          type="button"
          onClick={() => void save()}
          disabled={nome.trim() === '' || saving}
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
            cursor: nome.trim() === '' || saving ? 'default' : 'pointer',
            opacity: nome.trim() === '' || saving ? 0.5 : 1,
          }}
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 20px 24px' }}>
      <button
        type="button"
        onClick={() => {
          setEditing('new')
          setNome('')
          setEmoji('')
          setError(null)
        }}
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
        Nova categoria
      </button>

      {error && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent)', margin: '12px 0 0' }}>{error}</p>}

      {loading ? (
        <p style={{ textAlign: 'center', paddingTop: 28, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>Carregando...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {cats.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-2)',
                borderRadius: 16,
                padding: 12,
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {c.emoji ?? '🏷️'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{c.name}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '1px 0 0' }}>
                  {c.productCount ?? 0} produto{(c.productCount ?? 0) !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Editar ${c.name}`}
                onClick={() => {
                  setEditing(c.id)
                  setNome(c.name)
                  setEmoji(c.emoji ?? '')
                  setError(null)
                }}
                style={iconBtnStyle}
              >
                <Icon name="edit" size={16} color="var(--color-text-sec)" />
              </button>
              <button type="button" aria-label={`Excluir ${c.name}`} onClick={() => setPendingDelete(c)} style={iconBtnStyle}>
                <Icon name="trash" size={16} color="var(--color-bad, #C2410C)" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmSheet
        open={!!pendingDelete}
        title={pendingDelete ? `Excluir ${pendingDelete.name}?` : ''}
        description="Só é possível excluir categorias sem produtos."
        confirmLabel="Excluir"
        tone="danger"
        onConfirm={() => pendingDelete && void del(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

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

const iconBtnStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false)
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', marginBottom: 7 }}>{label}</div>
      <div style={{ background: 'var(--color-surface-alt, #FBF6EC)', border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`, borderRadius: 14, padding: '12px 14px' }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 500, color: 'var(--color-text)' }}
        />
      </div>
    </label>
  )
}
