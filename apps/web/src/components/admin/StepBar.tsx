const STEP_LABELS = ['Conferir', 'Ajustar', 'Dividir', 'Pronto'] as const

interface StepBarProps {
  step: 0 | 1 | 2 | 3
  onStepClick: (i: number) => void
}

export function StepBar({ step, onStepClick }: StepBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: '0 20px 14px',
      }}
    >
      {STEP_LABELS.map((label, i) => {
        const isActiveOrDone = i <= step
        const isClickable = i < step

        return (
          <div
            key={label}
            style={{
              flex: 1,
              textAlign: 'center',
              cursor: isClickable ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (isClickable) onStepClick(i)
            }}
            role={isClickable ? 'button' : undefined}
            aria-label={isClickable ? `Voltar para ${label}` : undefined}
          >
            {/* Barra de preenchimento */}
            <div
              style={{
                height: 4,
                borderRadius: 99,
                marginBottom: 6,
                background: isActiveOrDone ? '#E3AC3F' : 'var(--color-border)',
              }}
            />

            {/* Label do step */}
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                fontWeight: 700,
                color: isActiveOrDone ? 'var(--color-accent)' : 'var(--color-text-ter)',
                lineHeight: 1.2,
              }}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
