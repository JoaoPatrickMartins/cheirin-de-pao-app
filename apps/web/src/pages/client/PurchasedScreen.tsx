// PurchasedScreen — success screen after payment
// Full implementation in plan 03-05
export function PurchasedScreen() {
  return (
    <div
      style={{
        padding: '20px',
        minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 26,
          color: 'var(--color-text)',
          letterSpacing: '-0.03em',
        }}
      >
        Créditos na conta!
      </h1>
    </div>
  )
}
