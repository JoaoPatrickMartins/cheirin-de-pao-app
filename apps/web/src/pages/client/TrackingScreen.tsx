import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useOrderTracking, TodayOrder } from '../../hooks/useOrderTracking'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'
import { BreadMark } from '../../components/brand/BreadMark'

interface HistoryOrder {
  id: string
  status: 'SCHEDULED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'
  quantity: number
  scheduledDate: string
  type: 'SCHEDULED' | 'SINGLE'
}

const STATUSES = ['SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const

type StepKey = typeof STATUSES[number]

const STEPS: { key: StepKey; label: string; desc: string }[] = [
  {
    key: 'SCHEDULED',
    label: 'Agendado',
    desc: 'Pedido confirmado e créditos reservados',
  },
  {
    key: 'OUT_FOR_DELIVERY',
    label: 'Saiu para entrega',
    desc: 'O entregador está a caminho do seu condomínio',
  },
  {
    key: 'DELIVERED',
    label: 'Entregue',
    desc: 'Pãezinhos na sua porta. Bom dia!',
  },
]

function getStepState(stepKey: StepKey, orderStatus: string): 'done' | 'cur' | 'future' {
  const statusIndex = STATUSES.indexOf(orderStatus as StepKey)
  const stepIndex = STATUSES.indexOf(stepKey)
  if (stepIndex < statusIndex) return 'done'
  if (stepIndex === statusIndex) return 'cur'
  return 'future'
}

function formatHeroDate(dateStr: string): string {
  const date = new Date(dateStr)
  const dayName = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
  const dayNum = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
  const monthShort = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  })
    .format(date)
    .replace('.', '')
  return `${dayName.toUpperCase()} · ${dayNum} ${monthShort.toUpperCase()}`
}

function formatQty(qty: number): string {
  return qty === 1 ? '1 pãozinho' : `${qty} pãezinhos`
}

function formatHistoryDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(dateStr))
}

function formatHistoryTime(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(dateStr))
}

interface PillProps {
  children: React.ReactNode
  tone: 'good' | 'neutral'
  dot?: boolean
  ariaLive?: 'polite' | 'off'
}

function Pill({ children, tone, dot, ariaLive }: PillProps) {
  const toneStyles: Record<string, React.CSSProperties> = {
    good: { background: 'var(--color-good-soft)', color: 'var(--color-good)' },
    neutral: { background: 'var(--color-surface-2)', color: 'var(--color-text-sec)' },
  }
  return (
    <div
      aria-live={ariaLive}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 99,
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 11.5,
        ...toneStyles[tone],
      }}
    >
      {dot && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--color-good)',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  if (status === 'OUT_FOR_DELIVERY') return <Pill tone="good" dot>A caminho</Pill>
  if (status === 'DELIVERED') return <Pill tone="neutral">Entregue</Pill>
  return <Pill tone="neutral">Agendado</Pill>
}

function HeroCard({ order }: { order: TodayOrder }) {
  return (
    <div
      style={{
        background: 'var(--color-espresso)',
        borderRadius: 'var(--radius-card)',
        padding: 20,
        overflow: 'hidden',
        position: 'relative',
        marginBottom: 18,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -36,
          right: -20,
          opacity: 0.13,
          pointerEvents: 'none',
        }}
      >
        <BreadMark size={150} color="#E3AC3F" />
      </div>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11.5,
          fontWeight: 700,
          color: '#E3AC3F',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          margin: '0 0 6px',
        }}
      >
        {formatHeroDate(order.scheduledDate)}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 30,
          color: '#FAF5EC',
          letterSpacing: '-0.02em',
          margin: 0,
          lineHeight: 1.0,
        }}
      >
        {formatQty(order.quantity)}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: '#C7B595',
          margin: '4px 0 0',
        }}
      >
        Entrega no seu condomínio
      </p>
    </div>
  )
}

function Timeline({ order }: { order: TodayOrder }) {
  return (
    <div role="list" style={{ paddingLeft: 6, position: 'relative', marginBottom: 18 }}>
      {STEPS.map((step, i) => {
        const state = getStepState(step.key, order.status)
        const isLast = i === STEPS.length - 1
        const prevDone = i > 0 && getStepState(STEPS[i - 1].key, order.status) === 'done'

        return (
          <div
            key={step.key}
            role="listitem"
            style={{ display: 'flex', gap: 16, paddingBottom: isLast ? 0 : 26 }}
          >
            {/* Coluna esquerda: círculo + linha */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 99,
                  background: state !== 'future' ? 'var(--color-accent)' : 'var(--color-surface)',
                  border: `2px solid ${state !== 'future' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  display: 'grid',
                  placeItems: 'center',
                  zIndex: 1,
                  flexShrink: 0,
                }}
              >
                {state === 'done' && (
                  <Icon name="check" size={18} color="var(--color-app-bg)" stroke={2.6} aria-hidden="true" />
                )}
                {state === 'cur' && (
                  <div
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: '50%',
                      background: '#FBF3E4',
                    }}
                  />
                )}
                {state === 'future' && (
                  <div
                    style={{ width: 11, height: 11, borderRadius: '50%', background: 'transparent' }}
                  />
                )}
              </div>
              {!isLast && (
                <div
                  style={{
                    width: 2.5,
                    flex: 1,
                    minHeight: 38,
                    margin: '2px 0',
                    background: prevDone ? 'var(--color-accent)' : 'var(--color-border)',
                  }}
                />
              )}
            </div>

            {/* Coluna direita: texto */}
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 16.5,
                    letterSpacing: '-0.01em',
                    color: state !== 'future' ? 'var(--color-text)' : 'var(--color-text-ter)',
                  }}
                >
                  {step.label}
                </span>
                {state === 'cur' && (
                  <Pill tone="good" dot ariaLive="polite">
                    agora
                  </Pill>
                )}
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  color: 'var(--color-text-sec)',
                  margin: '4px 0 0',
                  lineHeight: 1.45,
                }}
              >
                {step.desc}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TrackingScreen() {
  const navigate = useNavigate()
  const { order } = useOrderTracking()
  const [history, setHistory] = useState<HistoryOrder[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await apiFetch('/orders/history?days=30')
        if (res.ok) {
          setHistory((await res.json()) as HistoryOrder[])
        }
      } catch {
        // mantém lista vazia
      } finally {
        setIsLoadingHistory(false)
      }
    }
    void fetchHistory()
  }, [])

  const visibleHistory = history.filter((o) => o.status !== 'CANCELLED')

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
            width: 38,
            height: 38,
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
          Sua entrega
        </h1>
      </div>

      <div style={{ padding: '0 20px 24px' }}>
        {order && <HeroCard order={order} />}
        {order && <Timeline order={order} />}

        {/* Card do entregador — placeholder estático (Fase 6) */}
        {order && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              padding: '14px 16px',
              background: 'var(--color-surface)',
              borderRadius: 16,
              border: '1px solid var(--color-border-2)',
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 99,
                background: 'var(--color-surface-2)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="user" size={22} color="var(--color-accent)" />
            </div>
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--color-text-ter)',
                  margin: '0 0 2px',
                }}
              >
                Seu entregador
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  margin: 0,
                }}
              >
                A definir
              </p>
            </div>
            <button
              aria-label="Ligar para o entregador"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'var(--color-gold-soft)',
                border: 'none',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                padding: 2,
              }}
            >
              <Icon name="phone" size={19} color="var(--color-accent)" />
            </button>
          </div>
        )}

        {/* Histórico */}
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: '18px 0 10px',
          }}
        >
          Histórico
        </h2>

        {isLoadingHistory && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                style={{ height: 64, borderRadius: 'var(--radius-card)', background: 'var(--color-surface-2)' }}
              />
            ))}
          </div>
        )}

        {!isLoadingHistory && visibleHistory.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 32 }}>
            <Icon name="clock" size={48} color="var(--color-text-ter)" />
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 16,
                color: 'var(--color-text-sec)',
                margin: '12px 0 6px',
              }}
            >
              Nenhuma entrega ainda
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
              Seus pedidos dos últimos 30 dias aparecem aqui. Configure sua agenda para começar.
            </p>
          </div>
        )}

        {!isLoadingHistory && visibleHistory.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleHistory.map((o) => {
              const dateLabel = formatHistoryDate(o.scheduledDate)
              const timeLabel = formatHistoryTime(o.scheduledDate)
              const typeLabel = o.type === 'SINGLE' ? 'Pedido único' : 'Agendamento'
              return (
                <div
                  key={o.id}
                  aria-label={`${dateLabel}, ${o.status === 'DELIVERED' ? 'Entregue' : o.status === 'OUT_FOR_DELIVERY' ? 'A caminho' : 'Agendado'}`}
                  style={{
                    display: 'flex',
                    gap: 13,
                    padding: 14,
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-card)',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 13,
                      background: 'var(--color-surface-2)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon
                      name={o.type === 'SINGLE' ? 'bag' : 'calendar'}
                      size={21}
                      color="var(--color-accent)"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 700,
                        fontSize: 14.5,
                        color: 'var(--color-text)',
                        margin: 0,
                      }}
                    >
                      {dateLabel}
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 12.5,
                        color: 'var(--color-text-ter)',
                        margin: '1px 0 0',
                      }}
                    >
                      {typeLabel} · {timeLabel} · {o.quantity} pães
                    </p>
                  </div>
                  <StatusPill status={o.status} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
