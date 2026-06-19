import { useState } from 'react'
import { Icon, Ic } from '../brand/Icon'
import { useAuth } from '../../hooks/useAuth'

type AdminTab = 'painel' | 'pedido' | 'entregas' | 'clientes' | 'gestao'

interface TabItem {
  key: AdminTab
  label: string
  icon: keyof typeof Ic
}

const TABS: TabItem[] = [
  { key: 'painel',   label: 'Painel',   icon: 'trend'    },
  { key: 'pedido',   label: 'Pedido',   icon: 'factory'  },
  { key: 'entregas', label: 'Entregas', icon: 'truck'    },
  { key: 'clientes', label: 'Clientes', icon: 'users'    },
  { key: 'gestao',   label: 'Gestão',   icon: 'settings' },
]

export function AdminBottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}) {
  const { logout } = useAuth()
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)

  return (
    <>
      <nav
        role="navigation"
        aria-label="Navegação administrativa"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border-2)',
          display: 'flex',
          alignItems: 'stretch',
          padding: '8px 6px calc(8px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              style={{
                flex: 1,
                minHeight: 44,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '5px 0',
              }}
            >
              <Icon
                name={tab.icon}
                size={22}
                stroke={isActive ? 2.3 : 2}
                color={isActive ? 'var(--color-accent)' : 'var(--color-text-ter)'}
              />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? 'var(--color-accent)' : 'var(--color-text-ter)',
                  lineHeight: 1,
                }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}

        {/* Botão Sair — fora do array TABS (Pitfall 6: não adicionar 'logout' ao AdminTab) */}
        <button
          onClick={() => setShowLogoutDialog(true)}
          aria-label="Sair"
          style={{
            flex: 1,
            minHeight: 44,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '5px 0',
          }}
        >
          <Icon name="logout" size={22} stroke={2} color="var(--color-text-ter)" />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--color-text-ter)',
              lineHeight: 1,
            }}
          >
            Sair
          </span>
        </button>
      </nav>

      {/* Dialog de confirmação de logout (D-09) */}
      {showLogoutDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-logout-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 24px',
          }}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 20,
              padding: '28px 24px',
              width: '100%',
              maxWidth: 360,
            }}
          >
            <h2
              id="dialog-logout-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 19,
                color: 'var(--color-text)',
                margin: '0 0 8px',
              }}
            >
              Sair da conta?
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--color-text-sec)',
                margin: '0 0 24px',
              }}
            >
              Você será redirecionado para a tela de login.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowLogoutDialog(false)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 999,
                  border: '1.5px solid var(--color-border)',
                  background: 'none',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: 15,
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                }}
              >
                Continuar na conta
              </button>
              <button
                onClick={logout}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 999,
                  border: 'none',
                  background: 'var(--color-espresso)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: 15,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
