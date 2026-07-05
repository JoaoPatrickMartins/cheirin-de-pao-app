import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { SwitchToggle } from '../../../components/admin/SwitchToggle'

interface AdminNotificacoesProps {
  onBack: () => void
}

type PrefsMap = Record<string, boolean>

/** Ordem/rótulos dos toggles — paridade com ADMIN_NOTIFICATION_TYPES do backend. */
const NOTIF_ITEMS: { key: string; titulo: string; descricao: string }[] = [
  { key: 'ADMIN_ORDER_PLACED', titulo: 'Pedidos realizados', descricao: 'Quando um cliente faz um novo pedido' },
  { key: 'ADMIN_HOOK_REQUESTED', titulo: 'Solicitação de gancho', descricao: 'Quando um cliente confirma o recebimento do gancho' },
  { key: 'ADMIN_DELIVERY_DONE', titulo: 'Entregas realizadas', descricao: 'Quando uma entrega é confirmada' },
  { key: 'ADMIN_DELIVERY_FAILED', titulo: 'Entregas não realizadas', descricao: 'Quando uma entrega é marcada como não entregue' },
  { key: 'ADMIN_DELIVERY_PENDING', titulo: 'Entregas pendentes', descricao: 'Quando há entregas pendentes após o prazo do turno' },
  { key: 'ADMIN_ORDER_CANCELLED', titulo: 'Pedidos cancelados', descricao: 'Quando um cliente cancela um pedido' },
  { key: 'ADMIN_CREDIT_PURCHASED', titulo: 'Compras de créditos', descricao: 'Quando um cliente compra combos/créditos' },
  { key: 'ADMIN_CUTOFF_REACHED', titulo: 'Horário de corte', descricao: 'Quando bate o corte para gerar o pedido ao fornecedor' },
  { key: 'ADMIN_AUTOGEN_WARNING', titulo: 'Aviso de geração automática', descricao: '15 min antes de o pedido ser gerado automaticamente' },
  { key: 'ADMIN_AUTOGEN_DONE', titulo: 'Pedido gerado automaticamente', descricao: 'Quando o pedido ao fornecedor é gerado automaticamente' },
]

export function AdminNotificacoes({ onBack }: AdminNotificacoesProps) {
  const [prefs, setPrefs] = useState<PrefsMap | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Chaves com salvamento em andamento (para desabilitar o toggle enquanto salva).
  const [saving, setSaving] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch('/admin/notification-prefs')
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { prefs: PrefsMap }
          setPrefs(data.prefs)
        }
      } catch {
        // falha silenciosa — mantém null (mostra estado de carregamento/erro implícito)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = async (key: string) => {
    if (!prefs) return
    const next = !(prefs[key] !== false)
    // Otimista: aplica já; reverte se o PUT falhar.
    const prev = prefs
    setPrefs({ ...prefs, [key]: next })
    setSaving((s) => new Set(s).add(key))
    try {
      const res = await apiFetch('/admin/notification-prefs', {
        method: 'PUT',
        body: JSON.stringify({ [key]: next }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('falha')
      const data = (await res.json()) as { prefs: PrefsMap }
      setPrefs(data.prefs)
    } catch {
      setPrefs(prev) // reverte
    } finally {
      setSaving((s) => {
        const n = new Set(s)
        n.delete(key)
        return n
      })
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 14px' }}>
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          style={{
            background: 'var(--color-surface-2)',
            border: 'none',
            width: 36,
            height: 36,
            borderRadius: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            Notificações
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '1px 0 0' }}>
            Escolha quais avisos você quer receber
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px 24px' }}>
        {isLoading && (
          <>
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                style={{ height: 66, borderRadius: 16, background: 'var(--color-surface-2)' }}
              />
            ))}
          </>
        )}

        {!isLoading &&
          prefs &&
          NOTIF_ITEMS.map((item) => {
            const on = prefs[item.key] !== false
            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 13,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 16,
                  padding: 15,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 14.5,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      margin: 0,
                      lineHeight: 1.3,
                    }}
                  >
                    {item.titulo}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--color-text-ter)',
                      margin: '2px 0 0',
                      lineHeight: 1.35,
                    }}
                  >
                    {item.descricao}
                  </p>
                </div>
                <SwitchToggle
                  on={on}
                  disabled={saving.has(item.key)}
                  onChange={() => void toggle(item.key)}
                  aria-label={`${item.titulo}: ${on ? 'ligado' : 'desligado'}`}
                />
              </div>
            )
          })}
      </div>
    </div>
  )
}
