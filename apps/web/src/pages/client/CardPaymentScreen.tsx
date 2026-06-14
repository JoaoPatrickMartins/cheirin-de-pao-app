// CardPaymentScreen — Mercado Pago Bricks
// Full implementation in plan 03-05
export function CardPaymentScreen() {
  return (
    <div
      style={{
        padding: '20px',
        minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
        background: 'var(--color-app-bg)',
      }}
    >
      <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-sec)' }}>
        Pagamento com cartão
      </p>
    </div>
  )
}
