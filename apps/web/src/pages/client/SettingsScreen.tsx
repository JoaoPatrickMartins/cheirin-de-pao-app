import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { useAutoRecharge } from '../../hooks/useAutoRecharge'
import { usePushOptIn } from '../../hooks/usePushOptIn'
import { ProfileAvatar } from '../../components/client/ProfileAvatar'
import { ProfileMenuRow } from '../../components/client/ProfileMenuRow'
import { resetOnboarding } from '../../lib/onboarding'

// Suporte via WhatsApp — número configurável por env (dígitos com DDI, ex.: 5511999998888).
// Placeholder até o número oficial ser definido (defina VITE_SUPPORT_WHATSAPP no .env).
const SUPPORT_WHATSAPP = ((import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) ?? '5599999999999').replace(/\D/g, '')
const SUPPORT_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('Olá! Preciso de ajuda com o Cheirin de Pão.')}`

export function SettingsScreen() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { status: autoRecharge } = useAutoRecharge()

  // Re-dispara o fluxo de primeiro acesso (telas + tour).
  function replayOnboarding() {
    if (!user) return
    resetOnboarding(user.id)
    navigate('/client/home')
    window.dispatchEvent(new Event('cdp:replay-onboarding'))
  }
  // Abre a conversa de suporte no WhatsApp.
  function openSupport() {
    window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer')
  }

  const autoRechargeDesc = autoRecharge
    ? autoRecharge.active
      ? `Ativada${autoRecharge.comboName ? ` · ${autoRecharge.comboName}` : ''}`
      : 'Desativada'
    : 'Recarregue sozinho quando faltar saldo'

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          paddingTop: 'calc(6px + env(safe-area-inset-top))',
          padding: '6px 20px 14px',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 21,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          Perfil
        </h1>
      </div>

      {/* Scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: 80 }}>
        {/* Header card do perfil */}
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-card)',
            padding: 20,
            boxShadow: 'var(--shadow-soft)',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <ProfileAvatar name={user?.name} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-text)',
                margin: '0 0 2px',
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.name ?? 'Minha conta'}
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13.5,
                color: 'var(--color-text-sec)',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.email ?? user?.phone ?? 'Bem-vindo'}
            </p>
          </div>
        </div>

        {/* Conta */}
        <SectionLabel>Conta</SectionLabel>
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-card)',
            padding: '6px 16px',
            boxShadow: 'var(--shadow-soft)',
            marginBottom: 20,
          }}
        >
          <ProfileMenuRow
            icon="user"
            label="Minha conta"
            description="Dados pessoais, contato e endereço"
            onClick={() => navigate('/client/perfil/conta')}
          />
          <div style={{ height: 1, background: 'var(--color-border-2)', margin: '0 4px' }} />
          <ProfileMenuRow
            icon="card"
            label="Meus cartões"
            description="Cartões salvos para suas compras"
            onClick={() => navigate('/client/perfil/cartoes')}
          />
          <div style={{ height: 1, background: 'var(--color-border-2)', margin: '0 4px' }} />
          <ProfileMenuRow
            icon="repeat"
            label="Compra automática"
            description={autoRechargeDesc}
            badge={autoRecharge?.active ? 'Ativada' : undefined}
            onClick={() => navigate('/client/creditos/recorrente')}
          />
          <div style={{ height: 1, background: 'var(--color-border-2)', margin: '0 4px' }} />
          <ProfileMenuRow
            icon="pin"
            label="Meu gancho"
            description="Status e reposição do gancho de porta"
            onClick={() => navigate('/client/perfil/gancho')}
          />
        </div>

        {/* Notificações */}
        <SectionLabel>Notificações</SectionLabel>
        <NotificationsSetting />

        {/* Ajuda */}
        <SectionLabel>Ajuda</SectionLabel>
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-card)',
            padding: '6px 16px',
            boxShadow: 'var(--shadow-soft)',
            marginBottom: 20,
          }}
        >
          <ProfileMenuRow
            icon="phone"
            label="Falar com o suporte"
            description="Tire dúvidas e peça ajuda"
            badge="WhatsApp"
            onClick={openSupport}
          />
          <div style={{ height: 1, background: 'var(--color-border-2)', margin: '0 4px' }} />
          <ProfileMenuRow
            icon="refresh"
            label="Rever tutorial"
            description="Ver as boas-vindas e o tour do app de novo"
            onClick={replayOnboarding}
          />
        </div>

        {/* Conta */}
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-card)',
            padding: '6px 16px',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <ProfileMenuRow icon="logout" label="Sair" onClick={() => logout()} danger />
        </div>
      </div>
    </div>
  )
}

/** Controle de notificações push — reflete o estado da permissão e faz o opt-in por gesto. */
function NotificationsSetting() {
  const { status, busy, enable, disable } = usePushOptIn()
  const [showHelp, setShowHelp] = useState(false)
  const toggleHelp = () => setShowHelp((v) => !v)

  let description: string
  let badge: string | undefined
  let onClick: () => void

  switch (status) {
    case 'granted':
      description = 'Ativadas neste aparelho'
      badge = 'Ativadas'
      onClick = toggleHelp
      break
    case 'denied':
      description = 'Bloqueadas — toque para reativar'
      badge = 'Bloqueadas'
      onClick = toggleHelp
      break
    case 'ios-install':
      description = 'Instale o app na tela inicial para ativar'
      onClick = toggleHelp
      break
    case 'unsupported':
      description = 'Não suportado neste navegador'
      onClick = () => {}
      break
    case 'loading':
      description = 'Verificando…'
      onClick = () => {}
      break
    default: // 'default' — suportado e ainda não decidido
      description = 'Receba avisos de entrega e créditos'
      onClick = () => void enable()
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-card)',
        padding: '6px 16px',
        boxShadow: 'var(--shadow-soft)',
        marginBottom: 20,
      }}
    >
      <ProfileMenuRow
        icon="bell"
        label="Notificações"
        description={busy ? 'Aguarde…' : description}
        badge={badge}
        onClick={onClick}
      />
      {showHelp && (status === 'denied' || status === 'ios-install' || status === 'granted') && (
        <div style={{ padding: '0 4px 12px' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              color: 'var(--color-text-sec)',
              lineHeight: 1.5,
              margin: '0 0 8px',
            }}
          >
            {status === 'denied' &&
              'As notificações estão bloqueadas para este site. Toque no cadeado ao lado do endereço → Notificações → Permitir e recarregue a página.'}
            {status === 'ios-install' &&
              'No iPhone/iPad: toque em Compartilhar → "Adicionar à Tela de Início". Depois abra o app pelo ícone criado e ative as notificações por aqui.'}
            {status === 'granted' && 'Você receberá avisos no seu aparelho mesmo com o app fechado.'}
          </p>
          {status === 'granted' && (
            <button
              onClick={() => void disable()}
              disabled={busy}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: busy ? 'default' : 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: 700,
                color: '#C0392B',
              }}
            >
              Desativar notificações
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Rótulo de seção do hub de Perfil (pequeno, maiúsculo, discreto). */
function SectionLabel({ children }: { children: string }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--color-text-ter)',
        margin: '4px 6px 8px',
      }}
    >
      {children}
    </p>
  )
}
