/**
 * PushNudge — aviso leve e dispensável na Home para ativar notificações.
 *
 * Aparece só quando o push é suportado e ainda não foi decidido (`status === 'default'`).
 * Uma vez dispensado, fica oculto (persistido em localStorage) — o usuário ainda pode ativar
 * pelo Perfil. Estilo espelha o banner de aviso de corte da Home.
 */
import { useState } from 'react'
import { Icon } from '../brand/Icon'
import { usePushOptIn } from '../../hooks/usePushOptIn'

const DISMISS_KEY = 'cdp:push-nudge-dismissed'

export function PushNudge() {
  const { status, enable, busy } = usePushOptIn()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  if (dismissed || status !== 'default') return null

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  return (
    <div
      style={{
        background: 'var(--color-surface-2)',
        border: '1.5px solid var(--color-accent)',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        gap: 11,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: 'var(--color-surface)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <Icon name="bell" size={17} color="var(--color-gold)" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14.5,
            fontWeight: 700,
            color: 'var(--color-text)',
            letterSpacing: '-0.01em',
          }}
        >
          Ative as notificações
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--color-text-sec)',
            lineHeight: 1.4,
          }}
        >
          Acompanhe suas entregas e avisos de crédito direto no seu celular.
        </span>
        <button
          onClick={enable}
          disabled={busy}
          style={{
            alignSelf: 'flex-start',
            marginTop: 4,
            minHeight: 36,
            padding: '7px 14px',
            borderRadius: 'var(--radius-btn)',
            border: 'none',
            background: 'var(--color-espresso)',
            color: '#FAF5EC',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 12.5,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Ativando…' : 'Ativar notificações'}
        </button>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dispensar"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          flexShrink: 0,
          lineHeight: 0,
        }}
      >
        <Icon name="x" size={16} color="var(--color-text-ter)" />
      </button>
    </div>
  )
}
