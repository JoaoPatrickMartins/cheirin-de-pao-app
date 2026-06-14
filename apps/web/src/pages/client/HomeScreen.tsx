import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { CreditBalanceCard } from '../../components/client/CreditBalanceCard'
import { Icon } from '../../components/brand/Icon'

function getGreeting(): string {
  const hours = new Date().getHours()
  if (hours < 12) return 'Bom dia'
  if (hours < 18) return 'Boa tarde'
  return 'Boa noite'
}

interface QuickAction {
  label: string
  icon: keyof typeof import('../../components/brand/Icon').Ic
  path: string
}

export function HomeScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const firstName = user?.name?.split(' ')[0] ?? 'você'
  const greeting = getGreeting()

  const quickActions: QuickAction[] = [
    { label: 'Comprar créditos', icon: 'coin',     path: '/client/creditos'        },
    { label: 'Minha agenda',     icon: 'calendar', path: '/client/agenda'          },
    { label: 'Histórico',        icon: 'clock',    path: '/client/creditos/extrato' },
    { label: 'Configurações',    icon: 'settings', path: '/client/settings'        },
  ]

  return (
    <div
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Greeting */}
      <div style={{ paddingTop: 8 }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-ter)',
            margin: '0 0 4px',
            letterSpacing: '0.01em',
          }}
        >
          Condomínio
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 22,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          {greeting}, {firstName}
        </h1>
      </div>

      {/* Credit Balance Card */}
      <CreditBalanceCard
        creditBalance={user?.creditBalance ?? 0}
        isLoading={false}
      />

      {/* Today Delivery Placeholder */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          padding: '16px',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color-text-ter)',
            letterSpacing: '0.04em',
            margin: '0 0 8px',
            textTransform: 'uppercase' as const,
          }}
        >
          ENTREGA DE HOJE
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--color-text-sec)',
            margin: 0,
          }}
        >
          Nenhuma entrega agendada
        </p>
      </div>

      {/* Quick Actions */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          padding: '16px',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color-text-ter)',
            letterSpacing: '0.04em',
            margin: '0 0 14px',
            textTransform: 'uppercase' as const,
          }}
        >
          AÇÕES RÁPIDAS
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}
        >
          {quickActions.map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '8px 4px',
                minHeight: 44,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'var(--color-surface-2)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name={action.icon} size={20} color="var(--color-accent)" stroke={2} />
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--color-text-sec)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Next Days Placeholder */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          padding: '16px',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--color-text-ter)',
              letterSpacing: '0.04em',
              margin: 0,
              textTransform: 'uppercase' as const,
            }}
          >
            PRÓXIMAS ENTREGAS
          </p>
          <button
            onClick={() => navigate('/client/agenda')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-accent)',
              padding: 0,
            }}
          >
            Editar agenda
          </button>
        </div>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--color-text-sec)',
            margin: 0,
          }}
        >
          Configure sua agenda para ver as próximas entregas
        </p>
      </div>
    </div>
  )
}
