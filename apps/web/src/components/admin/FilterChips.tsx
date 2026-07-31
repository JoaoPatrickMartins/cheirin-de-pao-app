import { useDragScroll } from '../../hooks/useDragScroll'

interface Chip<T extends string> {
  key: T
  label: string
}

interface FilterChipsProps<T extends string> {
  chips: Chip<T>[]
  value: T
  onChange: (v: T) => void
  /** Rótulo do grupo para leitores de tela (ex.: "Filtrar Cestinhas por situação"). */
  ariaLabel: string
}

/**
 * FilterChips — nível 2: recorta o conteúdo da seção atual (situação, tipo, período).
 *
 * Fica deliberadamente mais leve que o SectionTabs: chip baixo, sem borda quando inativo (só um
 * fundo bege) e preenchido de espresso quando ativo. Antes era uma pílula vazada com borda accent
 * — a mesma receita das seções, o que fazia as duas fileiras se confundirem. Selecionado por
 * preenchimento em vez de borda também deixa óbvio, num relance, qual recorte está em vigor.
 */
export function FilterChips<T extends string>({ chips, value, onChange, ariaLabel }: FilterChipsProps<T>) {
  const { ref, handlers } = useDragScroll()

  return (
    <div
      ref={ref}
      {...handlers}
      role="group"
      aria-label={ariaLabel}
      className="cdp-chips"
      style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 12, cursor: 'grab' }}
    >
      {chips.map((c) => {
        const active = value === c.key
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            aria-pressed={active}
            style={{
              flexShrink: 0,
              minHeight: 30,
              padding: '0 12px',
              borderRadius: 999,
              border: 'none',
              background: active ? 'var(--color-espresso)' : 'var(--color-surface-2)',
              color: active ? 'var(--color-primary-btn-text)' : 'var(--color-text-sec)',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 12.5,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
