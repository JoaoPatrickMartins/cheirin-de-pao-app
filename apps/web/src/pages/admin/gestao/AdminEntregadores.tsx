import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { EntregadorForm } from './EntregadorForm'

// ------------------------------------------------------------------ tipos
interface Entregador {
  id: string
  name: string
  cpf?: string | null
  phone?: string | null
  isBlocked: boolean
}

type SubTelaSub = null | 'criar'

interface AdminEntregadoresProps {
  onBack: () => void
}

// ------------------------------------------------------------------ componente
export function AdminEntregadores({ onBack }: AdminEntregadoresProps) {
  const [sub, setSub] = useState<SubTelaSub>(null)
  const [entregadores, setEntregadores] = useState<Entregador[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchEntregadores = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch('/admin/couriers')
      if (res.ok) {
        setEntregadores((await res.json()) as Entregador[])
      }
    } catch {
      // falha silenciosa
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchEntregadores()
  }, [fetchEntregadores])

  if (sub === 'criar') {
    return (
      <EntregadorForm
        onBack={() => setSub(null)}
        onSaved={() => {
          setSub(null)
          void fetchEntregadores()
        }}
      />
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px 14px',
        }}
      >
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
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
            flex: 1,
          }}
        >
          Entregadores
        </h2>
      </div>

      {/* Conteúdo */}
      <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 24px' }}>
        <GoldBtn icon="plus" onClick={() => setSub('criar')}>
          Cadastrar entregador
        </GoldBtn>

        {isLoading ? (
          <div style={{ paddingTop: 32, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              Carregando...
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {entregadores.map((e) => (
              <EntregadorCard
                key={e.id}
                entregador={e}
                onToggle={(newActive) => {
                  setEntregadores((prev) =>
                    prev.map((x) => (x.id === e.id ? { ...x, isBlocked: !newActive } : x)),
                  )
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ EntregadorCard
interface EntregadorCardProps {
  entregador: Entregador
  onToggle: (newActive: boolean) => void
}

function EntregadorCard({ entregador: e, onToggle }: EntregadorCardProps) {
  const [localActive, setLocalActive] = useState(!e.isBlocked)

  const handleToggle = async () => {
    const prev = localActive
    const next = !prev
    setLocalActive(next)
    onToggle(next)
    try {
      await apiFetch(`/admin/couriers/${e.id}/toggle`, { method: 'PATCH' })
    } catch {
      setLocalActive(prev)
      onToggle(prev)
    }
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Linha principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Avatar circular */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--color-surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: localActive ? 1 : 0.5,
            transition: 'opacity 0.2s ease',
          }}
        >
          <Icon name="user" size={22} color="var(--color-accent)" />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--color-text)',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {e.name}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--color-text-ter)',
              margin: '2px 0 0',
            }}
          >
            {localActive ? 'Ativo' : 'Desativado'}
          </p>
        </div>

        {/* Switch */}
        <SwitchToggle on={localActive} onChange={() => void handleToggle()} />
      </div>

      {/* Footer */}
      {(e.cpf || e.phone) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--color-border-2)',
          }}
        >
          {e.cpf && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="card" size={13} color="var(--color-text-ter)" />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-text-ter)',
                }}
              >
                {e.cpf}
              </span>
            </div>
          )}
          {e.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="phone" size={13} color="var(--color-text-ter)" />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-text-ter)',
                }}
              >
                {e.phone}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ primitivas locais
interface GoldBtnProps {
  icon: string
  onClick: () => void
  children: React.ReactNode
}

function GoldBtn({ icon, onClick, children }: GoldBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        minHeight: 44,
        background: 'var(--color-gold)',
        color: 'var(--color-espresso)',
        border: 'none',
        borderRadius: 14,
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: '-0.01em',
      }}
    >
      <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} color="var(--color-espresso)" />
      {children}
    </button>
  )
}

interface SwitchToggleProps {
  on: boolean
  onChange: () => void
}

function SwitchToggle({ on, onChange }: SwitchToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      style={{
        width: 44,
        height: 26,
        borderRadius: 99,
        border: 'none',
        background: on ? 'var(--color-gold)' : 'var(--color-border)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s ease',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}
