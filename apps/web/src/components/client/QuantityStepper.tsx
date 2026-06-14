interface QuantityStepperProps {
  min: number
  max: number
  value: number
  onChange: (v: number) => void
}

export default function QuantityStepper({ min, max, value, onChange }: QuantityStepperProps) {
  const atMin = value <= min
  const atMax = value >= max

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 48,
    height: 48,
    minHeight: 44,
    borderRadius: 16,
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--color-espresso)',
    flexShrink: 0,
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <button
        aria-label="diminuir"
        disabled={atMin}
        style={btnStyle(atMin)}
        onClick={() => { if (!atMin) onChange(value - 1) }}
      >
        −
      </button>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 56,
        fontWeight: 800,
        color: 'var(--color-accent)',
        lineHeight: 1,
        minWidth: 64,
        textAlign: 'center',
      }}>
        {value}
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
