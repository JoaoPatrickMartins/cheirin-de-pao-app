import { useNavigate } from 'react-router'
import { Icon } from '../brand/Icon'
import { useAutoRecharge } from '../../hooks/useAutoRecharge'

/**
 * Banner de status da compra automática (read-only fora da tela de configuração).
 * - Ativada: card de destaque com selo verde + combo, tocável para gerenciar.
 * - Desativada: CTA discreto para ativar.
 * `variant="hero"` dá mais peso visual (usado na Agenda).
 */
export function AutoRechargeBanner({ variant = 'inline' }: { variant?: 'inline' | 'hero' }) {
  const navigate = useNavigate()
  const { status, loading } = useAutoRecharge()
  if (loading || !status) return null

  const go = () => navigate('/client/creditos/recorrente')

  if (status.active) {
    return (
      <button
        onClick={go}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          textAlign: 'left',
          background: 'var(--color-good-soft)',
          border: '1.5px solid var(--color-good)',
          borderRadius: 'var(--radius-card)',
          padding: '14px 16px',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'var(--color-good)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="check" size={20} color="#fff" />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)' }}>
            Compra automática ativada
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-sec)' }}>
            Recarregamos sozinho quando faltar saldo{status.comboName ? ` · ${status.comboName}` : ''}
          </span>
        </span>
        <Icon name="chevR" size={18} color="var(--color-good)" />
      </button>
    )
  }

  // Desativada — CTA para ativar
  const hero = variant === 'hero'
  return (
    <button
      onClick={go}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        background: hero ? 'var(--color-surface)' : 'transparent',
        border: hero ? '1.5px solid var(--color-accent)' : '1.5px dashed var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: hero ? '16px' : '13px 14px',
        cursor: 'pointer',
        boxShadow: hero ? 'var(--shadow-soft)' : 'none',
      }}
    >
      <span
        style={{
          width: hero ? 40 : 34,
          height: hero ? 40 : 34,
          borderRadius: 12,
          background: 'var(--color-accent-soft, rgba(194,65,12,0.10))',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="repeat" size={hero ? 22 : 18} color="var(--color-accent)" />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: hero ? 15 : 14, color: 'var(--color-text)' }}>
          Ativar compra automática
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-sec)' }}>
          Nunca fique sem pãezinhos — recarrega sozinho, sem CVV
        </span>
      </span>
      <Icon name="chevR" size={18} color="var(--color-accent)" />
    </button>
  )
}
