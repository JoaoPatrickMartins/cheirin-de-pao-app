interface StepperInlineProps {
  min: number
  max: number
  value: number
  onChange: (v: number) => void
  /** Exibe o emoji de pão 🥖 ao lado da quantidade (quando > 0). Opt-in. */
  showUnit?: boolean
}

export default function StepperInline({ min, max, value, onChange, showUnit = false }: StepperInlineProps) {
  const atMin = value <= min
  const atMax = value >= max

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 34,
    height: 34,
    minHeight: 34,
    borderRadius: 11,
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--color-espresso)',
    flexShrink: 0,
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        aria-label="diminuir"
        disabled={atMin}
        style={btnStyle(atMin)}
        onClick={() => { if (!atMin) onChange(value - 1) }}
      >
        −
      </button>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        minWidth: showUnit ? 46 : 24,
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 800,
          color: value > 0 ? 'var(--color-accent)' : 'var(--color-text-ter)',
        }}>
          {value}
        </span>
        {showUnit && value > 0 && (
          <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>🥖</span>
        )}
      </span>
      <button
        aria-label="aumentar"
        disabled={atMax}
        style={btnStyle(atMax)}
        onClick={() => { if (!atMax) onChange(value + 1) }}
      >
        +
      </button>
    </div>
  )
}
