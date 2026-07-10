// SwitchToggle — interruptor reutilizável (ativar/desativar, on/off) do admin.
// Visual alinhado ao toggle de promoção dos combos.

interface SwitchToggleProps {
  on: boolean
  onChange: () => void
  disabled?: boolean
  'aria-label'?: string
}

export function SwitchToggle({ on, onChange, disabled = false, ...rest }: SwitchToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={rest['aria-label']}
      onClick={onChange}
      disabled={disabled}
      style={{
        width: 44,
        height: 26,
        borderRadius: 99,
        border: 'none',
        background: on ? 'var(--color-gold)' : 'var(--color-border)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'background 0.2s ease',
        flexShrink: 0,
        padding: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}
