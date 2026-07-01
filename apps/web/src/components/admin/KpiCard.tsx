import type { ReactNode } from 'react'
import { Icon, Ic } from '../brand/Icon'

interface PillProps {
  text: string
  tone: 'good' | 'gold' | 'neutral'
}

function Pill({ text, tone }: PillProps) {
  const styles: Record<string, { bg: string; color: string }> = {
    good: { bg: 'var(--color-good-soft)', color: 'var(--color-good)' },
    gold: { bg: 'var(--color-gold-soft)', color: '#8A6A00' },
    neutral: { bg: 'var(--color-surface-2)', color: 'var(--color-text-sec)' },
  }
  const s = styles[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 99,
        background: s.bg,
        color: s.color,
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  )
}

interface KpiCardProps {
  icon: keyof typeof Ic
  value: ReactNode
  label: string
  pill?: { text: string; tone: 'good' | 'gold' | 'neutral' }
  sub?: string
}

export function KpiCard({ icon, value, label, pill, sub }: KpiCardProps) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 22,
        padding: 16,
        border: '1px solid var(--color-border-2)',
      }}
    >
      {/* Header: ícone + pill opcional */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Icon name={icon} size={20} color="var(--color-accent)" stroke={2} />
        {pill && <Pill text={pill.text} tone={pill.tone} />}
      </div>

      {/* Valor principal */}
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: 'var(--color-text)',
          margin: '12px 0 0',
          lineHeight: 1,
        }}
      >
        {value}
      </p>

      {/* Label */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--color-text-sec)',
          margin: '4px 0 0',
          lineHeight: 1.2,
        }}
      >
        {label}
      </p>

      {/* Linha secundária opcional (ex.: previstos pela agenda) */}
      {sub && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--color-accent)',
            margin: '4px 0 0',
            lineHeight: 1.2,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}
