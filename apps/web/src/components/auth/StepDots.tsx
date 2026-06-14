interface StepDotsProps {
  currentStep: number
  totalSteps?: number
}

/**
 * 5-dot progress indicator for the registration stepper.
 * Active dot: width 24px, height 8px, --color-accent, radius 99px
 * Inactive dot: 8px × 8px, --color-border, radius 99px
 * Transition: width + background 0.25s ease
 * Gap: 8px between dots
 */
export function StepDots({ currentStep, totalSteps = 5 }: StepDotsProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
        padding: '4px 0 16px',
      }}
    >
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          style={{
            width: currentStep === i ? 24 : 8,
            height: 8,
            borderRadius: 99,
            background:
              currentStep === i ? 'var(--color-accent)' : 'var(--color-border)',
            transition: 'width 0.25s ease, background 0.25s ease',
          }}
        />
      ))}
    </div>
  )
}
