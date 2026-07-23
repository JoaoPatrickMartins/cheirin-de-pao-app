import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'

export function MarketConfig() {
  const [minimo, setMinimo] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [focused, setFocused] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const r = await apiFetch('/admin/market/config')
        if (r.ok) setMinimo(String(((await r.json()) as { minimo: number }).minimo))
      } catch {
        /* falha silenciosa */
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const r = await apiFetch('/admin/market/config', {
        method: 'PATCH',
        body: JSON.stringify({ minimo: Number(minimo) }),
      })
      setMsg(r.ok ? { text: 'Salvo!', ok: true } : { text: 'Não foi possível salvar.', ok: false })
    } catch {
      setMsg({ text: 'Erro de conexão.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p style={{ textAlign: 'center', paddingTop: 28, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>Carregando...</p>
  }

  const valid = Number(minimo) >= 0 && minimo.trim() !== ''

  return (
    <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <label style={{ display: 'block' }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', marginBottom: 7 }}>
          Mínimo da Cestinha (R$)
        </div>
        <div style={{ background: 'var(--color-surface-alt, #FBF6EC)', border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`, borderRadius: 14, padding: '12px 14px' }}>
          <input
            type="number"
            step="0.01"
            value={minimo}
            onChange={(e) => setMinimo(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Ex.: 15.00"
            style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 500, color: 'var(--color-text)' }}
          />
        </div>
      </label>

      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', margin: 0, lineHeight: 1.5 }}>
        Pedidos do mercadinho abaixo desse valor ficam bloqueados no checkout. O resgate com pãezinhos
        segue sempre o preço do pão avulso (Gestão → Compra personalizada).
      </p>

      {msg && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: msg.ok ? 'var(--color-good)' : 'var(--color-accent)', margin: 0 }}>{msg.text}</p>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={!valid || saving}
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
          cursor: !valid || saving ? 'default' : 'pointer',
          opacity: !valid || saving ? 0.5 : 1,
        }}
      >
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  )
}
