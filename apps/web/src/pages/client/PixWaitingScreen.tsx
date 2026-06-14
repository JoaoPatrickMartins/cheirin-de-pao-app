// PixWaitingScreen — QR code + polling
// Full implementation in plan 03-05
export function PixWaitingScreen() {
  return (
    <div
      style={{
        padding: '20px',
        minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
        background: 'var(--color-app-bg)',
      }}
    >
      <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-sec)' }}>
        Aguardando pagamento Pix...
      </p>
    </div>
  )
}
