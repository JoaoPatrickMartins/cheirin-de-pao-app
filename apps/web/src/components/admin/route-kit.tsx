import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '../brand/Icon'

/**
 * Peças das telas de rota do admin: A4 (rota do entregador) e a rota padrão (plano-rota-padrao,
 * D-8 — a tela nova usa o visual da A4).
 */

export const km = (v: number | null) => (v === null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

export const btn = (variant: 'gold' | 'ghost' | 'primary' | 'soft', full = false): React.CSSProperties => ({
  minHeight: 46,
  padding: '0 16px',
  borderRadius: 999,
  border: variant === 'ghost' ? '1.5px solid var(--color-border)' : 'none',
  background: variant === 'gold' ? 'var(--color-gold)' : variant === 'primary' ? 'var(--color-espresso)' : variant === 'soft' ? 'var(--color-surface-2)' : 'var(--color-surface)',
  color: variant === 'primary' ? '#fff' : variant === 'gold' ? 'var(--color-espresso)' : 'var(--color-text)',
  fontFamily: 'var(--font-body)',
  fontWeight: 800,
  fontSize: 14.5,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  ...(full ? { width: '100%' } : { flex: 1 }),
})

export function Num({ n }: { n: number }) {
  return (
    <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--color-espresso)', color: 'var(--color-gold)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
      {n}
    </span>
  )
}

export function OrderList({ ids, names, highlight }: { ids: string[]; names: Map<string, string>; highlight?: (id: string) => ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {ids.map((id, i) => (
        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border-2)' }}>
          <Num n={i + 1} />
          <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{names.get(id) ?? 'Prédio'}</span>
          {highlight?.(id)}
        </div>
      ))}
    </div>
  )
}

export function SortRow({ id, index, name, extra }: { id: string; index: number; name: string; extra?: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 10px',
        borderRadius: 12,
        background: 'var(--color-surface)',
        border: `1.5px solid ${isDragging ? 'var(--color-gold)' : 'var(--color-border-2)'}`,
        boxShadow: isDragging ? 'var(--shadow-strong)' : 'none',
        position: 'relative',
        zIndex: isDragging ? 2 : 0,
      }}
    >
      <button type="button" {...attributes} {...listeners} aria-label={`Arrastar ${name}`} style={{ width: 32, height: 40, border: 'none', background: 'none', color: 'var(--color-text-ter)', cursor: 'grab', touchAction: 'none', display: 'grid', placeItems: 'center' }}>
        <Icon name="grip" size={20} stroke={3.2} aria-hidden="true" />
      </button>
      <Num n={index + 1} />
      <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{name}</span>
      {extra}
    </div>
  )
}
