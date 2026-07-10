import { useLocation } from 'react-router'
import { Icon } from '../../components/brand/Icon'
import type { Ic } from '../../components/brand/Icon'

type PlaceholderIcon = 'calendar' | 'bag'

function detectIcon(pathname: string): PlaceholderIcon {
  if (pathname.includes('agenda')) return 'calendar'
  return 'bag'
}

function detectTitle(pathname: string): string {
  if (pathname.includes('agenda')) return 'Agenda'
  if (pathname.includes('pedidos')) return 'Pedidos'
  return 'Em breve'
}

export function PlaceholderScreen() {
  const location = useLocation()
  const icon: keyof typeof Ic = detectIcon(location.pathname)
  const title = detectTitle(location.pathname)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
        padding: 32,
        textAlign: 'center',
      }}
    >
      <Icon
        name={icon}
        size={48}
        stroke={1.5}
        color="var(--color-text-ter)"
      />
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 20,
          color: 'var(--color-text-sec)',
          margin: '16px 0 8px',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--color-text-ter)',
          lineHeight: 1.5,
          margin: 0,
          maxWidth: 260,
        }}
      >
        Em breve — disponível na próxima atualização
      </p>
    </div>
  )
}
