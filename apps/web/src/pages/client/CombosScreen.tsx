// CombosScreen — combos + compra personalizada
// Full implementation in plan 03-05
export function CombosScreen() {
  return (
    <div
      style={{
        padding: '20px',
        minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
        background: 'var(--color-app-bg)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 21,
          color: 'var(--color-text)',
          letterSpacing: '-0.02em',
        }}
      >
        Créditos
      </h1>
    </div>
  )
}
