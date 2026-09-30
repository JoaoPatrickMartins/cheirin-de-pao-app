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
  /** Cor da pílula: verde (padrão, status) ou dourada (Indique e Ganhe: "novo", campanha). */
  badgeTone?: 'good' | 'gold'
  /** Ícone opcional dentro da pílula (ex.: `spark` na campanha). */
  badgeIcon?: keyof typeof Ic
  /** `gold`: quadrado do ícone em dourado suave — a identidade do Indique e Ganhe (C2). */
  tone?: 'default' | 'gold'
}

const BADGE_TONES = {
  good: { fg: 'var(--color-good)', bg: 'var(--color-good-soft)' },
  gold: { fg: 'var(--color-accent)', bg: 'var(--color-gold-soft)' },
} as const

/**
 * Linha de menu do hub de Perfil — ícone + label (+ descrição opcional) + chevron.
 * Variante `danger` (vermelho, sem chevron) usada para ações como "Sair".
 */
export function ProfileMenuRow({
  icon,
  label,
  description,
  onClick,
  danger = false,
  badge,
  badgeTone = 'good',
  badgeIcon,
  tone = 'default',
}: ProfileMenuRowProps) {
  const color = danger ? '#C0392B' : 'var(--color-text)'
  const iconBg = danger ? 'rgba(192,57,43,0.08)' : tone === 'gold' ? 'var(--color-gold-soft)' : 'var(--color-surface-2)'
  const badgeColors = BADGE_TONES[badgeTone]
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
          background: iconBg,
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
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--font-body)',
            fontSize: 11.5,
            fontWeight: 700,
            color: badgeColors.fg,
            background: badgeColors.bg,
            borderRadius: 999,
            padding: '3px 9px',
            flexShrink: 0,
          }}
        >
          {badgeIcon && <Icon name={badgeIcon} size={11} stroke={2.6} />}
          {badge}
        </span>
      )}
      {!danger && <Icon name="chevR" size={20} color="var(--color-text-ter)" />}
    </button>
  )
}
