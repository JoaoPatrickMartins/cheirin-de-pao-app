import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'
import { useNotif } from '../../contexts/NotifContext'

interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
  actionRoute?: string
}

type Tone = 'good' | 'gold' | 'neutral'

function getTone(type: string): Tone {
  if (['DELIVERY_EVE', 'DELIVERY_DONE', 'OUT_FOR_DELIVERY'].includes(type)) return 'good'
  if (['LOW_CREDIT'].includes(type)) return 'gold'
  return 'neutral'
}

function getIcon(type: string) {
  if (type === 'DELIVERY_EVE') return 'bell'
  if (type === 'DELIVERY_DONE') return 'check'
  if (type === 'OUT_FOR_DELIVERY') return 'truck'
  if (type === 'LOW_CREDIT') return 'alert'
  return 'repeat'
}

const TONE_ICON_STYLES: Record<Tone, { icon: string; bg: string }> = {
  good: { icon: 'var(--color-good)', bg: 'var(--color-good-soft)' },
  gold: { icon: 'var(--color-accent)', bg: 'var(--color-gold-soft)' },
  neutral: { icon: 'var(--color-text-sec)', bg: 'var(--color-surface-2)' },
}

const CTA_CONFIG: Record<string, { label: string; path: string }> = {
  LOW_CREDIT:       { label: 'Comprar créditos', path: '/client/creditos' },
  DELIVERY_DONE:    { label: 'Ver pedido',        path: '/client/pedidos' },
  DELIVERY_EVE:     { label: 'Ver pedido',        path: '/client/pedidos' },
  OUT_FOR_DELIVERY: { label: 'Acompanhar',        path: '/client/pedidos' },
  RECONFIGURE:      { label: 'Ajustar agenda',    path: '/client/agenda'  },
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffH = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffH < 1) return 'agora'
  if (diffH < 24) return `${diffH}h atrás`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d atrás`
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date)
}

export function NotificationsScreen() {
  const navigate = useNavigate()
  const { refresh } = useNotif()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRead, setIsRead] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/notifications/me')
        if (res.ok) {
          setNotifications((await res.json()) as AppNotification[])
        }
      } catch {
        // mantém lista vazia
      } finally {
        setIsLoading(false)
      }

      apiFetch('/notifications/read-all', { method: 'PATCH' })
        .then(() => { setIsRead(true); refresh() })
        .catch(() => {})
    }
    void load()
  }, [refresh])

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
        background: 'var(--color-app-bg)',
      }}
    >
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 20px 14px',
          gap: 12,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--color-surface-2)',
            border: 'none',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={20} />
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 21,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Notificações
        </h1>
      </div>

      <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLoading && (
          <>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                style={{ height: 80, borderRadius: 'var(--radius-card)', background: 'var(--color-surface-2)' }}
              />
            ))}
          </>
        )}

        {!isLoading && notifications.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <Icon name="bell" size={48} color="var(--color-text-ter)" />
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 16,
                color: 'var(--color-text-sec)',
                margin: '12px 0 6px',
              }}
            >
              Tudo tranquilo por aqui
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--color-text-ter)',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              As notificações sobre suas entregas e créditos aparecem aqui.
            </p>
          </div>
        )}

        {!isLoading &&
          notifications.map((n) => {
            const tone = getTone(n.type)
            const iconName = getIcon(n.type)
            const { icon: iconColor, bg: iconBg } = TONE_ICON_STYLES[tone]
            const cta = CTA_CONFIG[n.type]
            const read = isRead || n.isRead

            return (
              <div
                key={n.id}
                aria-label={`${n.title}: ${n.body}`}
                style={{
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-card)',
                  padding: 15,
                  border: read
                    ? '1px solid var(--color-border-2)'
                    : '1.5px solid var(--color-accent)',
                  display: 'flex',
                  gap: 13,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: iconBg,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={iconName as 'bell'} size={20} color={iconColor} />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 700,
                        fontSize: 14.5,
                        color: 'var(--color-text)',
                        margin: 0,
                        lineHeight: 1.25,
                      }}
                    >
                      {n.title}
                    </p>
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--color-text-ter)',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {formatTimestamp(n.createdAt)}
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13,
                      color: 'var(--color-text-sec)',
                      margin: '3px 0 0',
                      lineHeight: 1.45,
                    }}
                  >
                    {n.body}
                  </p>
                  {cta && (
                    <button
                      onClick={() => navigate(cta.path)}
                      style={{
                        marginTop: 10,
                        borderRadius: 11,
                        padding: '8px 14px',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 700,
                        fontSize: 13,
                        border: 'none',
                        cursor: 'pointer',
                        background: tone === 'gold' ? 'var(--color-gold)' : 'var(--color-surface-2)',
                        color: tone === 'gold' ? 'var(--color-app-bg)' : 'var(--color-text)',
                      }}
                    >
                      {cta.label}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
