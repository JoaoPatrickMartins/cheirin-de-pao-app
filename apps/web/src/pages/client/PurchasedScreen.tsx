import { useLocation, useNavigate } from 'react-router'
import { Icon } from '../../components/brand/Icon'

export function PurchasedScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { quantity?: number } | null
  const quantity = state?.quantity ?? 0

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        gap: 20,
      }}
    >
      {/* Animated check icon */}
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: '30%',
          background: 'var(--color-good-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'scaleIn 250ms ease-out both',
        }}
      >
        <style>{`@keyframes scaleIn { from { transform: scale(0.8) } to { transform: scale(1) } }`}</style>
        <Icon name="check" size={48} color="var(--color-good)" stroke={2.4} />
      </div>

      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 26,
            color: 'var(--color-text)',
            letterSpacing: '-0.03em',
            margin: 0,
          }}
        >
          Créditos na conta!
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            color: 'var(--color-text-sec)',
            margin: 0,
          }}
        >
          +{quantity} pães adicionados. Agora é só deixar a agenda no jeito.
        </p>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={() => navigate('/client/agenda')}
          style={{
            width: '100%',
            minHeight: 52,
            borderRadius: 'var(--radius-btn)',
            border: 'none',
            background: 'var(--color-accent)',
            color: 'var(--color-primary-btn-text)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Icon name="calendar" size={20} color="var(--color-primary-btn-text)" />
          Montar minha agenda
        </button>
        <button
          onClick={() => navigate('/client/home')}
          style={{
            width: '100%',
            minHeight: 52,
            borderRadius: 'var(--radius-btn)',
            border: '1.5px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Voltar ao início
        </button>
      </div>
    </div>
  )
}
