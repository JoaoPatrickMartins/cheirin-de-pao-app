import { Icon } from '../brand/Icon'
import { useNotif } from '../../contexts/NotifContext'

/**
 * NotifBell — sino de notificações do admin com badge de não-lidas.
 *
 * Desacoplado da navegação: ao tocar, dispara o evento window `cdp:open-admin-notifications`,
 * ouvido pelo AdminLayout (que abre o inbox como overlay). Assim o AdminHead permanece
 * apresentacional e o sino funciona em qualquer aba.
 */
export function NotifBell() {
  const { unreadCount } = useNotif()
  const hasUnread = unreadCount > 0

  return (
    <button
      onClick={() => window.dispatchEvent(new Event('cdp:open-admin-notifications'))}
      aria-label={hasUnread ? `Notificações (${unreadCount} não lidas)` : 'Notificações'}
      style={{
        position: 'relative',
        width: 42,
        height: 42,
        borderRadius: 13,
        background: 'var(--color-surface-2)',
        border: 'none',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <Icon name="bell" size={20} color="var(--color-text)" />
      {hasUnread && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 8,
            background: 'var(--color-accent)',
            color: 'var(--color-app-bg)',
            fontFamily: 'var(--font-body)',
            fontSize: 10,
            fontWeight: 700,
            lineHeight: '16px',
            textAlign: 'center',
            border: '2px solid var(--color-app-bg)',
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
