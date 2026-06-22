import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { useAutoRecharge } from '../../hooks/useAutoRecharge'
import { ProfileAvatar } from '../../components/client/ProfileAvatar'
import { ProfileMenuRow } from '../../components/client/ProfileMenuRow'

export function SettingsScreen() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { status: autoRecharge } = useAutoRecharge()

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

        {/* Menu */}
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
