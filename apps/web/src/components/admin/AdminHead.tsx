import type { ReactNode } from 'react'
import { BreadMark } from '../brand/BreadMark'

interface AdminHeadProps {
  sub: string
  titulo: string
  /** Ação secundária opcional, renderizada à direita do header (ex.: atalho de histórico). */
  action?: ReactNode
}

export function AdminHead({ sub, titulo, action }: AdminHeadProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '4px 20px 14px',
      }}
    >
      {/* Avatar espresso com BreadMark dourado */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          background: 'var(--color-espresso)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <BreadMark size={27} color="#E3AC3F" />
      </div>

      {/* Texto: subtítulo + título */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color-text-ter)',
            margin: 0,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {sub}
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {titulo}
        </h1>
      </div>

      {/* Ação à direita (opcional) */}
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}
