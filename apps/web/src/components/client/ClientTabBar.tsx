import { useLocation, useNavigate } from 'react-router'
import { Icon, Ic } from '../brand/Icon'

interface TabItem {
  label: string
  icon?: keyof typeof Ic
  /** Usa o símbolo da marca (BreadMark) em vez de um ícone do set. */
  brand?: boolean
  path: string
}

const TABS: TabItem[] = [
  { label: 'Início',   icon: 'home',     path: '/client/home'     },
  { label: 'Agenda',   icon: 'calendar', path: '/client/agenda'   },
  { label: 'Pães',     brand: true,      path: '/client/creditos' },
  { label: 'Cestinha', icon: 'basket',   path: '/client/market'   },
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
            data-tour={`tab-${tab.path.split('/').pop()}`}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              minHeight: 44,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 1px',
            }}
          >
            {tab.brand ? (
              // Símbolo da marca (BreadMark) com viewBox recortado e centrado no conteúdo,
              // pra preencher e centralizar a caixa de 22px IGUAL aos ícones de linha
              // (sem wrapper/transform). viewBox = janela 84×84 centrada em (50, 52.6),
              // o centro visual do desenho. Paths idênticos ao BreadMark não-reduzido.
              <svg
                width={21}
                height={21}
                viewBox="8 10.6 84 84"
                fill="none"
                stroke={isActive ? 'var(--color-gold)' : 'var(--color-text-ter)'}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 80 C22 58 34 48 50 48 C66 48 78 58 78 80" strokeWidth={isActive ? 9 : 8} />
                <path d="M50 48 C45 39 55 34 50 24" strokeWidth={isActive ? 6.2 : 5.5} />
                <path d="M36 52 C32 45 39 41 36 34" strokeWidth={4.5} opacity={0.85} />
                <path d="M64 52 C60 45 67 41 64 34" strokeWidth={4.5} opacity={0.85} />
              </svg>
            ) : (
              <Icon
                name={tab.icon!}
                size={21}
                stroke={isActive ? 2.2 : 1.9}
                color={isActive ? 'var(--color-gold)' : 'var(--color-text-ter)'}
              />
            )}
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 10,
                fontWeight: isActive ? 700 : 600,
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-ter)',
                lineHeight: 1,
                letterSpacing: '0',
                whiteSpace: 'nowrap',
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
