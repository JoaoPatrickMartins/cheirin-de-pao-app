import { useNavigate } from 'react-router'
import { Icon } from '../brand/Icon'
import { useAutoRecharge } from '../../hooks/useAutoRecharge'

/**
 * Banner slim de compra automática (read-only fora da tela de configuração) —
 * mesmo padrão visual do BannerCobertura: ícone + texto + chevron.
 * - Ativada: verde (good), selo de status.
 * - Desativada: neutro (surface), CTA para ativar.
 * Tocar leva à tela de configurar/desativar.
 */
export function AutoRechargeBanner() {
  const navigate = useNavigate()
  const { status, loading } = useAutoRecharge()
  if (loading || !status) return null

  const go = () => navigate('/client/creditos/recorrente')
  const active = status.active

  return (
    <div
      onClick={go}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') go()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '14px 16px',
        background: active ? 'var(--color-good-soft)' : 'var(--color-surface)',
        border: active ? '1.5px solid var(--color-good)' : '1px solid var(--color-border-2)',
        borderRadius: 16,
        cursor: 'pointer',
      }}
    >
      <Icon name={active ? 'check' : 'repeat'} size={19} color={active ? 'var(--color-good)' : 'var(--color-accent)'} />
      <p
        style={{
          flex: 1,
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 600,
          color: active ? 'var(--color-text)' : 'var(--color-text-sec)',
          lineHeight: 1.45,
          margin: 0,
        }}
      >
        {active ? (
          <>
            Compra automática <strong>ativada</strong>
            {status.comboName ? ` · ${status.comboName}` : ''}
          </>
        ) : (
          <>
            Ative a <strong>compra automática</strong> pra nunca ficar sem pãezinhos
          </>
        )}
      </p>
      <Icon name="chevR" size={18} color={active ? 'var(--color-good)' : 'var(--color-text-ter)'} />
    </div>
  )
}
