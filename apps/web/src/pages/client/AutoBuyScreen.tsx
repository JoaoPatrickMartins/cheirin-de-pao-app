// AutoBuyScreen — compra recorrente automática configuration
// Full implementation in plan 03-05
export function AutoBuyScreen() {
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
        Compra automática
      </h1>
    </div>
  )
}
