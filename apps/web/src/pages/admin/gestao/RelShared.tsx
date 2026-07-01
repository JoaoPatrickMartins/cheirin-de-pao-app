import type { ReactNode } from 'react'
import { Icon } from '../../../components/brand/Icon'

// ------------------------------------------------------------------ formatadores
export const fmtInt = (n: number): string => (n ?? 0).toLocaleString('pt-BR')
export const fmtBRL = (n: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0)
export const fmtPct = (rate: number): string => `${((rate ?? 0) * 100).toFixed(1).replace('.', ',')}%`

// ------------------------------------------------------------------ AppBar
const iconBtnStyle = {
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
} as const

export function ReportAppBar({
  title,
  onBack,
  onExport,
}: {
  title: string
  onBack: () => void
  onExport?: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 14px' }}>
      <button type="button" aria-label="Voltar" onClick={onBack} style={iconBtnStyle}>
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
        {title}
      </h2>
      {onExport && (
        <button type="button" aria-label="Exportar CSV" onClick={onExport} style={iconBtnStyle}>
          <Icon name="download" size={18} color="var(--color-text)" />
        </button>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ contêineres
export function ReportScroll({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        overflow: 'auto',
        flex: 1,
        padding: '0 20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--color-text)',
        margin: '4px 0 -4px',
      }}
    >
      {children}
    </p>
  )
}

export function ReportCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 18,
        padding: 18,
      }}
    >
      {title && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text)',
            margin: '0 0 14px',
          }}
        >
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

/** Linha rótulo → valor (com barra proporcional opcional). */
export function StatRow({
  label,
  value,
  pct,
}: {
  label: string
  value: string
  pct?: number // 0..1 — desenha barra dourada proporcional
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-sec)' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
          {value}
        </span>
      </div>
      {pct != null && (
        <div style={{ height: 6, borderRadius: 99, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(Math.max(pct * 100, 0), 100)}%`,
              background: 'var(--color-gold)',
              borderRadius: 99,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}
    </div>
  )
}

export function LoadingText() {
  return (
    <div style={{ paddingTop: 32, textAlign: 'center' }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
        Carregando...
      </span>
    </div>
  )
}

export function ErrorText() {
  return (
    <div style={{ paddingTop: 32, textAlign: 'center' }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
        Falha na conexão. Tente novamente.
      </span>
    </div>
  )
}
