import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'

/**
 * CondoScopeSelector — escolhe o ESCOPO de uma configuração: o padrão da operação ou um
 * condomínio específico.
 *
 * O modelo é herança: o padrão vale para todo condomínio que não personalizou. Ao escolher um
 * condomínio, a tela mostra o valor efetivo dele (herdado ou próprio) e permite personalizar.
 *
 * `null` = padrão global. Compartilhado por "Bloqueios e limites" e "Horários de corte" para que
 * as duas telas falem a mesma língua.
 */

interface CondoOption {
  id: string
  name: string
  isActive: boolean
}

interface CondoScopeSelectorProps {
  value: string | null
  onChange: (condominiumId: string | null) => void
  /** Texto do chip do escopo global (ex.: "Padrão (todos)"). */
  globalLabel?: string
  disabled?: boolean
}

export function CondoScopeSelector({
  value,
  onChange,
  globalLabel = 'Padrão (todos)',
  disabled = false,
}: CondoScopeSelectorProps) {
  const [condos, setCondos] = useState<CondoOption[]>([])

  useEffect(() => {
    const fetchCondos = async () => {
      try {
        const res = await apiFetch('/admin/condominiums')
        if (res.ok) {
          const data = (await res.json()) as CondoOption[]
          // Inativos não recebem entrega — não faz sentido configurá-los aqui.
          setCondos(data.filter((c) => c.isActive))
        }
      } catch {
        // Falha silenciosa: sem a lista, a tela segue funcionando no escopo global.
      }
    }
    void fetchCondos()
  }, [])

  // Sem condomínio cadastrado, o seletor não agrega nada — a tela é só o padrão.
  if (condos.length === 0) return null

  return (
    <div>
      <p style={sectionTitle}>Aplicar em</p>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        <ScopeChip
          label={globalLabel}
          active={value === null}
          disabled={disabled}
          onClick={() => onChange(null)}
        />
        {condos.map((c) => (
          <ScopeChip
            key={c.id}
            label={c.name}
            active={value === c.id}
            disabled={disabled}
            onClick={() => onChange(c.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface ScopeChipProps {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
}

function ScopeChip({ label, active, disabled, onClick }: ScopeChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      style={{
        flexShrink: 0,
        fontFamily: 'var(--font-body)',
        fontSize: 12.5,
        fontWeight: 700,
        color: active ? '#FAF5EC' : 'var(--color-text-sec)',
        background: active ? 'var(--color-espresso)' : 'var(--color-surface)',
        border: `1px solid ${active ? 'var(--color-espresso)' : 'var(--color-border-2)'}`,
        borderRadius: 999,
        padding: '8px 14px',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

/**
 * Badge "Herdado do padrão" / "Personalizado" — mostra de onde vem o valor exibido e dá ao admin
 * a saída para voltar a herdar. Só aparece quando o escopo é um condomínio.
 */
interface InheritBadgeProps {
  /** true = o valor foi definido neste condomínio; false = veio do padrão. */
  custom: boolean
  /** Volta a herdar o padrão. Ausente = badge apenas informativo. */
  onReset?: () => void
}

export function InheritBadge({ custom, onReset }: InheritBadgeProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: custom ? 'var(--color-accent)' : 'var(--color-text-ter)',
          background: 'var(--color-surface-2)',
          borderRadius: 8,
          padding: '4px 8px',
        }}
      >
        {custom ? 'Personalizado' : 'Herdado do padrão'}
      </span>
      {custom && onReset && (
        <button
          type="button"
          onClick={onReset}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--color-text-sec)',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Voltar a herdar
        </button>
      )}
    </div>
  )
}

const sectionTitle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--color-text-sec)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  margin: '0 0 9px',
}
