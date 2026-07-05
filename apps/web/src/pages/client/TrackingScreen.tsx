import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useOrderTracking, TodayOrder } from '../../hooks/useOrderTracking'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { isPastCutoffForDelivery } from '../../lib/cutoff'
import { Icon, Ic } from '../../components/brand/Icon'
import { BreadMark } from '../../components/brand/BreadMark'
import { CancelOrderDialog } from '../../components/client/CancelOrderDialog'

interface HistoryOrder {
  id: string
  status: 'SCHEDULED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'
  quantity: number
  scheduledDate: string
  deliveryTime?: string
  slotId?: string
  type: 'SCHEDULED' | 'SINGLE'
}

// Casa um pedido ao slot do condomínio: por slotId (Etapa B) com fallback ao horário (legado).
function matchSlot(order: { slotId?: string; deliveryTime?: string }, slots: CondoSlot[]): CondoSlot | undefined {
  if (order.slotId) {
    const bySlot = slots.find((s) => (s.slotId ?? s.name) === order.slotId)
    if (bySlot) return bySlot
  }
  return order.deliveryTime ? slots.find((s) => s.time === order.deliveryTime) : undefined
}

interface CondoSlot {
  slotId?: string
  name: string
  label?: string
  emoji?: string
  time: string
  cutoffTime: string
  isActive: boolean
}

// Fallback de rótulos/emoji caso a API não traga label/emoji (slots legados)
const SLOT_LABEL: Record<string, string> = { manha: 'manhã', tarde: 'tarde' }
const SLOT_EMOJI: Record<string, string> = { manha: '☀️', tarde: '🌙' }

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
    desc: 'Pãezinhos quentinhos na sua porta.',
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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface PillProps {
  children: React.ReactNode
  tone: 'good' | 'neutral' | 'scheduled' | 'transit' | 'delivered' | 'cancelled'
  dot?: boolean
  iconName?: keyof typeof Ic
  ariaLive?: 'polite' | 'off'
}

function Pill({ children, tone, dot, iconName, ariaLive }: PillProps) {
  const toneStyles: Record<string, React.CSSProperties> = {
    // tons suaves usados na timeline ("agora")
    good: { background: 'var(--color-good-soft)', color: 'var(--color-good)' },
    neutral: { background: 'var(--color-surface-2)', color: 'var(--color-text-sec)' },
    // status do histórico — fundo claro + texto escuro da MESMA família de cor (estilo "agora")
    scheduled: { background: 'var(--color-surface-2)', color: 'var(--color-text-sec)' },
    transit: { background: 'var(--color-gold-soft)', color: 'var(--color-accent)' },
    delivered: { background: 'var(--color-good-soft)', color: 'var(--color-good)' },
    cancelled: { background: 'var(--color-surface-2)', color: 'var(--color-text-ter)' },
  }
  const fg = toneStyles[tone].color as string
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
            background: fg,
            flexShrink: 0,
          }}
        />
      )}
      {iconName && (
        <Icon name={iconName} size={13} color={fg} stroke={2.6} aria-hidden="true" />
      )}
      {children}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  if (status === 'OUT_FOR_DELIVERY') return <Pill tone="transit" dot>A caminho</Pill>
  if (status === 'DELIVERED') return <Pill tone="delivered" iconName="check">Entregue</Pill>
  if (status === 'CANCELLED') return <Pill tone="cancelled">Cancelado</Pill>
  return <Pill tone="scheduled" iconName="clock">Agendado</Pill>
}

// Rótulo acessível/curto do status para aria-label.
function statusLabel(status: string): string {
  if (status === 'DELIVERED') return 'Entregue'
  if (status === 'OUT_FOR_DELIVERY') return 'A caminho'
  if (status === 'CANCELLED') return 'Cancelado'
  return 'Agendado'
}

function HeroCard({
  order,
  isToday,
  slotLabel,
  displayTime,
}: {
  order: TodayOrder
  isToday: boolean
  slotLabel?: string
  displayTime?: string
}) {
  // Linha de slot + horário previsto. `displayTime` vem do slot ATUAL (dinâmico) quando o
  // slot é reconhecido; senão cai no snapshot do pedido. Avulsos sem slot caem em copy neutra.
  const slotTime = [slotLabel, displayTime ? `previsto ${displayTime}` : null]
    .filter(Boolean)
    .join(' · ')
  const subtitle = slotTime || (isToday ? 'Entrega no seu condomínio' : 'Sua próxima entrega')
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
        {subtitle}
      </p>
    </div>
  )
}

function Timeline({ order }: { order: TodayOrder }) {
  // Cumprimento da etapa "Entregue" conforme o horário do slot (manhã/tarde/noite).
  const hour = order.deliveryTime ? parseInt(order.deliveryTime.split(':')[0], 10) : null
  const greeting =
    hour === null ? 'Aproveite!' : hour < 12 ? 'Bom dia!' : hour < 18 ? 'Boa tarde!' : 'Boa noite!'

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
                {step.key === 'DELIVERED' ? `${step.desc} ${greeting}` : step.desc}
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
  const { updateCreditBalance } = useAuth()
  // fallbackToNext: mostra a próxima entrega agendada mesmo antes da meia-noite
  // (mesmo comportamento do card da Home).
  const { order, isToday } = useOrderTracking({ fallbackToNext: true })
  const [history, setHistory] = useState<HistoryOrder[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [slots, setSlots] = useState<CondoSlot[]>([])
  // Pedido único selecionado para o diálogo de cancelamento (null = fechado).
  const [cancelTarget, setCancelTarget] = useState<HistoryOrder | null>(null)

  useEffect(() => {
    // Slots do condomínio para resolver o nome real (manhã/tarde) pelo deliveryTime
    apiFetch('/client/condominium/slots')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: CondoSlot[]) => setSlots(Array.isArray(data) ? data : []))
      .catch(() => setSlots([]))
  }, [])

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

  // Pedidos cancelados aparecem com o pill "Cancelado" (não são mais escondidos).
  const visibleHistory = history

  // Nome do slot (manhã/tarde) cruzando o pedido (por slotId; fallback horário) com os slots
  const heroSlot = order ? matchSlot(order, slots) : undefined
  const slotLabel = heroSlot
    ? (heroSlot.label ?? SLOT_LABEL[heroSlot.name] ?? heroSlot.name).toLowerCase()
    : undefined
  // Horário exibido: do slot ATUAL (dinâmico) quando reconhecido; senão snapshot do pedido.
  const heroTime = heroSlot?.time ?? order?.deliveryTime

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
          onClick={() => { if (window.history.length > 1) { navigate(-1) } else { navigate('/client/home') } }}
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
        {order && <HeroCard order={order} isToday={isToday} slotLabel={slotLabel} displayTime={heroTime} />}
        {order && <Timeline order={order} />}

        {/* Card do entregador — só quando a entrega já saiu (sem telefone, Fase 6) */}
        {order && order.status === 'OUT_FOR_DELIVERY' && (
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
              const matched = matchSlot(o, slots)
              const slotEmoji = matched ? matched.emoji ?? SLOT_EMOJI[matched.name] ?? '' : ''
              const slotName2 = matched ? matched.label ?? SLOT_LABEL[matched.name] : undefined
              // Horário do slot ATUAL (dinâmico) quando reconhecido; senão o snapshot do pedido.
              const displayTime = matched?.time ?? o.deliveryTime
              // "☀️ Manhã · 06:00" — ou só o horário se o slot não for reconhecido
              const slotText = displayTime
                ? `${slotEmoji ? slotEmoji + ' ' : ''}${slotName2 ? cap(slotName2) + ' · ' : ''}${displayTime}`
                : null
              const typeLabel = o.type === 'SINGLE' ? 'Pedido único' : 'Agendamento'
              const qtyText = o.quantity === 1 ? '1 pão' : `${o.quantity} pães`
              // Pedido único ainda agendado pode ser cancelado pelo cliente até o corte.
              // Sem slot reconhecido, deixamos a decisão para o backend (autoritativo).
              const isCancelable = o.type === 'SINGLE' && o.status === 'SCHEDULED'
              const cutoffPassed =
                isCancelable &&
                !!matched &&
                isPastCutoffForDelivery(matched.time, matched.cutoffTime, o.scheduledDate)
              const canCancel = isCancelable && !cutoffPassed
              return (
                <div
                  key={o.id}
                  aria-label={`${dateLabel}, ${statusLabel(o.status)}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 14,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-2)',
                    borderRadius: 'var(--radius-card)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
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
                    <div style={{ flex: 1, minWidth: 0 }}>
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
                      {slotText && (
                        <p
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontWeight: 600,
                            fontSize: 13,
                            color: 'var(--color-text-sec)',
                            margin: '2px 0 0',
                          }}
                        >
                          {slotText}
                        </p>
                      )}
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 12,
                          color: 'var(--color-text-ter)',
                          margin: '1px 0 0',
                        }}
                      >
                        {typeLabel} · {qtyText}
                      </p>
                    </div>
                    <StatusPill status={o.status} />
                  </div>

                  {canCancel && (
                    <button
                      onClick={() => setCancelTarget(o)}
                      style={{
                        alignSelf: 'flex-start',
                        marginTop: 12,
                        padding: '7px 12px',
                        background: 'transparent',
                        color: 'var(--color-bad, #C2410C)',
                        border: '1.5px solid var(--color-bad, #C2410C)',
                        borderRadius: 'var(--radius-btn)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar pedido
                    </button>
                  )}
                  {cutoffPassed && (
                    <p
                      style={{
                        marginTop: 10,
                        fontFamily: 'var(--font-body)',
                        fontSize: 12,
                        color: 'var(--color-text-ter)',
                        lineHeight: 1.4,
                      }}
                    >
                      Cancelamento indisponível — passou do horário de corte deste pedido.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <CancelOrderDialog
        orderId={cancelTarget?.id ?? null}
        quantity={cancelTarget?.quantity ?? 0}
        isOpen={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onCancelled={(result) => {
          // Reflete o cancelamento na lista (pill vira "Cancelado") e atualiza o saldo de pães.
          setHistory((prev) =>
            prev.map((h) => (h.id === result.id ? { ...h, status: 'CANCELLED' } : h)),
          )
          updateCreditBalance(result.creditBalance)
          setCancelTarget(null)
        }}
      />
    </div>
  )
}
