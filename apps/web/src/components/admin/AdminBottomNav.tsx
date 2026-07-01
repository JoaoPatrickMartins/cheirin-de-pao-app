import { Icon, Ic } from '../brand/Icon'

type AdminTab = 'painel' | 'pedido' | 'separacao' | 'entregas' | 'clientes' | 'gestao'

interface TabItem {
  key: AdminTab
  label: string
  icon: keyof typeof Ic
}

const TABS: TabItem[] = [
  { key: 'painel',    label: 'Painel',    icon: 'trend'    },
  { key: 'pedido',    label: 'Pedidos',   icon: 'factory'  },
  { key: 'separacao', label: 'Separação', icon: 'list'     },
  { key: 'entregas',  label: 'Entregas',  icon: 'truck'    },
  { key: 'clientes',  label: 'Clientes',  icon: 'users'    },
  { key: 'gestao',    label: 'Gestão',    icon: 'settings' },
]

export function AdminBottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}) {
  return (
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
      </nav>
  )
}
