import { Icon } from '../brand/Icon'
import type { Ic } from '../brand/Icon'

interface ProfileMenuRowProps {
  icon: keyof typeof Ic
  label: string
  description?: string
  onClick: () => void
  danger?: boolean
  /** Pílula de status à direita (ex.: "Ativada"). */
  badge?: string
}

/**
 * Linha de menu do hub de Perfil — ícone + label (+ descrição opcional) + chevron.
 * Variante `danger` (vermelho, sem chevron) usada para ações como "Sair".
 */
export function ProfileMenuRow({ icon, label, description, onClick, danger = false, badge }: ProfileMenuRowProps) {
  const color = danger ? '#C0392B' : 'var(--color-text)'
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        background: 'transparent',
        border: 'none',
        padding: '14px 4px',
        minHeight: 56,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: danger ? 'rgba(192,57,43,0.08)' : 'var(--color-surface-2)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={20} color={danger ? '#C0392B' : 'var(--color-accent)'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 600,
            color,
            margin: 0,
          }}
        >
          {label}
        </p>
        {description && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              color: 'var(--color-text-ter)',
              margin: '2px 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {description}
          </p>
        )}
      </div>
      {badge && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--color-good)',
            background: 'var(--color-good-soft)',
            borderRadius: 999,
            padding: '3px 9px',
            flexShrink: 0,
          }}
        >
          {badge}
        </span>
      )}
      {!danger && <Icon name="chevR" size={20} color="var(--color-text-ter)" />}
    </button>
  )
}
