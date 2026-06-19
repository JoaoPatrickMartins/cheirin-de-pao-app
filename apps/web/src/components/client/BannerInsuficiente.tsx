import { Icon } from '../brand/Icon'

interface BannerInsuficienteProps {
  saldo: number
  requerido: number
  onComprar: () => void
  onAjustar: (novaQtd: number) => void
  /** Ocultar o botão "Usar N" quando não faz sentido contextualmente (ex: HomeScreen) */
  hideAjustar?: boolean
}

export default function BannerInsuficiente({
  saldo,
  requerido,
  onComprar,
  onAjustar,
  hideAjustar = false,
}: BannerInsuficienteProps) {
  if (requerido <= saldo) return null

  return (
    <div
      style={{
        background: 'var(--color-gold-soft)',
        border: '1.5px solid var(--color-gold)',
        borderRadius: 16,
        padding: 13,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Icon name="alert" size={20} color="var(--color-accent)" />
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          Você tem <strong>{saldo}</strong> créditos e precisa de{' '}
          <strong>{requerido}</strong>. Compre mais ou ajuste a quantidade.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onComprar}
          style={{
            minHeight: 44,
            padding: '8px 16px',
            borderRadius: 'var(--radius-btn)',
            border: '1.5px solid var(--color-gold)',
            background: 'var(--color-gold)',
            color: 'var(--color-espresso)',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Comprar mais
        </button>
        {!hideAjustar && (
          <button
            onClick={() => onAjustar(saldo)}
            style={{
              minHeight: 44,
              padding: '8px 16px',
              borderRadius: 'var(--radius-btn)',
              border: '1.5px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Usar {saldo}
          </button>
        )}
      </div>
    </div>
  )
}
