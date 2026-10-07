import type { ReactNode } from 'react'
import { Icon, type Ic } from '../brand/Icon'
import { CRIconBtn, CR_BODY, CR_DISPLAY } from './kit'

/**
 * Tela cheia do entregador (Perfil, Meus números, Minha escala) sobre a tela principal: barra com
 * voltar + título e o conteúdo rolando. Fica sobreposta para usar a mesma fila de envios.
 */
export function CourierPage({ title, onBack, children, label }: { title: string; onBack: () => void; children: ReactNode; label?: string }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label ?? title}
      style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'var(--color-app-bg)', display: 'flex', flexDirection: 'column', fontFamily: CR_BODY }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(10px + env(safe-area-inset-top, 0px)) 16px 12px' }}>
        <CRIconBtn icon="arrowL" tone="soft" label="Voltar" onClick={onBack} />
        <h1 style={{ fontFamily: CR_DISPLAY, fontWeight: 700, fontSize: 21, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
      </div>
      {/* A coluna fica num filho sem altura fixa: dentro do contêiner que rola, os cards (overflow
          hidden) encolheriam até sumir quando a página passa da altura da tela. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
      </div>
    </div>
  )
}

/** Linha de lista do perfil (ícone · título/descrição · à direita). Clicável quando tem `onClick` ou `href`. */
export function CRRow({
  icon,
  title,
  desc,
  right,
  last,
  tone,
  onClick,
  href,
  chev = true,
}: {
  icon?: keyof typeof Ic
  title: string
  desc?: ReactNode
  right?: ReactNode
  last?: boolean
  tone?: 'danger' | 'gold'
  onClick?: () => void
  href?: string
  chev?: boolean
}) {
  const clickable = !!onClick || !!href
  const content = (
    <>
      {icon && (
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: tone === 'danger' ? 'var(--color-warn-soft)' : tone === 'gold' ? 'var(--color-gold-soft)' : 'var(--color-surface-2)',
            color: tone === 'danger' ? 'var(--color-warn)' : 'var(--color-accent)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={19} stroke={2} aria-hidden="true" />
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, padding: '11px 0', textAlign: 'left' }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 15, color: tone === 'danger' ? 'var(--color-warn)' : 'var(--color-text)' }}>{title}</span>
        {desc && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-text-sec)', marginTop: 1 }}>{desc}</span>}
      </span>
      {right}
      {chev && clickable && !right && <Icon name="chevR" size={17} color="var(--color-text-ter)" aria-hidden="true" />}
    </>
  )
  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 13,
    padding: '0 16px',
    minHeight: 60,
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    borderBottom: last ? 'none' : '1px solid var(--color-border-2)',
    width: '100%',
    background: 'none',
    borderRadius: 0,
    fontFamily: CR_BODY,
    cursor: clickable ? 'pointer' : 'default',
    textDecoration: 'none',
    color: 'inherit',
    boxSizing: 'border-box',
  }
  if (href) return <a href={href} style={style} {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{content}</a>
  if (onClick) return <button type="button" onClick={onClick} style={style}>{content}</button>
  return <div style={style}>{content}</div>
}

/** Cartão branco com borda (grupo de linhas). */
export function CRCard({ children, pad = 0 }: { children: ReactNode; pad?: number }) {
  return <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 18, padding: pad, overflow: 'hidden' }}>{children}</div>
}
