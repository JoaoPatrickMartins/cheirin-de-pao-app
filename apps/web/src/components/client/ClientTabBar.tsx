import { useLocation, useNavigate } from 'react-router'
import { Icon, Ic } from '../brand/Icon'

interface TabItem {
  label: string
  icon: keyof typeof Ic
  path: string
}

const TABS: TabItem[] = [
  { label: 'Início',   icon: 'home',     path: '/client/home'     },
  { label: 'Agenda',   icon: 'calendar', path: '/client/agenda'   },
  { label: 'Créditos', icon: 'coin',     path: '/client/creditos' },
  { label: 'Pedidos',  icon: 'bag',      path: '/client/pedidos'  },
  { label: 'Perfil',   icon: 'user',     path: '/client/perfil'   },
]

export function ClientTabBar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav
      role="navigation"
      aria-label="Navegação principal"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 56,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border-2)',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      {TABS.map((tab) => {
        const isActive = location.pathname.startsWith(tab.path)
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            data-active={isActive ? 'true' : 'false'}
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
              padding: '4px 0',
            }}
          >
            <Icon
              name={tab.icon}
              size={22}
              stroke={isActive ? 2.2 : 1.9}
              color={isActive ? 'var(--color-gold)' : 'var(--color-text-ter)'}
            />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 10.5,
                fontWeight: isActive ? 700 : 600,
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-ter)',
                lineHeight: 1,
                letterSpacing: '0.01em',
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
