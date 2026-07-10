/**
 * Badge da bandeira do cartão — mesmo visual usado em SavedCardItem.
 * `brand` é o id do payment method do Mercado Pago (visa, master, elo, amex...).
 * Retorna null quando a bandeira ainda não foi detectada.
 */
export function CardBrandBadge({ brand }: { brand: string | null }) {
  const b = (brand ?? '').toLowerCase()

  if (!b) return null

  if (b === 'visa') {
    return <Label color="#1A1F71">VISA</Label>
  }

  if (b === 'master' || b === 'mastercard') {
    return (
      <svg width="32" height="20" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="10" fill="#EB001B" />
        <circle cx="22" cy="10" r="10" fill="#F79E1B" opacity="0.9" />
      </svg>
    )
  }

  if (b === 'elo') return <Label color="var(--color-text)">ELO</Label>
  if (b === 'amex') return <Label color="#2E77BC">AMEX</Label>
  if (b === 'hipercard') return <Label color="#B3131B">HIPER</Label>

  return <Label color="var(--color-text)">{b.slice(0, 6).toUpperCase()}</Label>
}

function Label({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: 12,
        color,
        background: 'var(--color-surface-2)',
        borderRadius: 4,
        padding: '3px 7px',
        letterSpacing: '0.02em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
