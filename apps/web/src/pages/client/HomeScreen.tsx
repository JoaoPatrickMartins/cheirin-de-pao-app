import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { motion, MotionConfig, type Variants } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { CreditBalanceCard } from '../../components/client/CreditBalanceCard'
import { Icon, Ic } from '../../components/brand/Icon'
import { BreadMark } from '../../components/brand/BreadMark'
import { useOrderTracking, type TodayOrder } from '../../hooks/useOrderTracking'
import { useNotif } from '../../contexts/NotifContext'
import { useSchedule } from '../../hooks/useSchedule'
import { useCreditBalanceSync } from '../../hooks/useCreditBalanceSync'
import { useAutoRecharge } from '../../hooks/useAutoRecharge'
import { apiFetch } from '../../lib/apiFetch'

type IconName = keyof typeof Ic

const SLOT_LABEL: Record<string, string> = { manha: 'manhã', tarde: 'tarde' }

// Mapa de índice do dia da semana (getDay()) para chave de WeeklyQty
const DAY_KEY_MAP: Record<number, keyof ReturnType<typeof useSchedule>['weeklyQty']> = {
  0: 'dom',
  1: 'seg',
  2: 'ter',
  3: 'qua',
  4: 'qui',
  5: 'sex',
  6: 'sab',
}

// Abreviações exibidas nos cards de próximas entregas
const DAY_ABBR: Record<string, string> = {
  seg: 'Seg',
  ter: 'Ter',
  qua: 'Qua',
  qui: 'Qui',
  sex: 'Sex',
  sab: 'Sáb',
  dom: 'Dom',
}

function getGreeting(): string {
  const hours = new Date().getHours()
  if (hours < 12) return 'Bom dia'
  if (hours < 18) return 'Boa tarde'
  return 'Boa noite'
}

// "Seg 22" a partir da data ISO de uma entrega futura
function formatDeliveryDay(iso: string): string {
  const d = new Date(iso)
  const key = DAY_KEY_MAP[d.getDay()]
  return `${DAY_ABBR[key]} ${d.getDate()}`
}

// Extrai "7:15" de um horário de entrega ("07:15", "07:15:00" ou ISO). Null se não houver.
function formatEta(value?: string): string | null {
  if (!value) return null
  const m = value.match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  return `${parseInt(m[1], 10)}:${m[2]}`
}

// ============================================================
// Orquestração de entrada (framer-motion).
// containerV: agrupa e escalona filhos; itemV: revela cada bloco.
// ============================================================
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]

const containerV: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

const itemV: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
}

// ---------- Pill (tons neutral / gold / good) ----------
function Pill({ tone = 'neutral', children, style }: { tone?: 'neutral' | 'gold' | 'good'; children: ReactNode; style?: CSSProperties }) {
  const map = {
    neutral: { bg: 'var(--color-surface-2)', c: 'var(--color-text-sec)' },
    gold: { bg: 'var(--color-gold-soft)', c: 'var(--color-accent)' },
    good: { bg: 'var(--color-good-soft)', c: 'var(--color-good)' },
  } as const
  const m = map[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 999,
        background: m.bg,
        color: m.c,
        fontFamily: 'var(--font-body)',
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: '0.01em',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

// ---------- Saudação + avatar + sino ----------
function Greet({
  greeting,
  name,
  addressLine,
  unreadCount,
  onBell,
}: {
  greeting: string
  name: string
  addressLine: string
  unreadCount: number
  onBell: () => void
}) {
  return (
    <motion.div variants={itemV} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 20px 14px' }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          background: 'var(--color-espresso)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <BreadMark size={28} color="#E3AC3F" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', fontWeight: 600 }}>
          {greeting}, {name}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 17,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {addressLine}
        </div>
      </div>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onBell}
        aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : 'Notificações'}
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          borderRadius: 12,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-2)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <span className={unreadCount > 0 ? 'cdp-wiggle' : undefined}>
          <Icon name="bell" size={20} color="var(--color-text)" />
        </span>
        {unreadCount > 0 && (
          <span
            className="cdp-bell-dot"
            style={{ position: 'absolute', top: 9, right: 9, width: 7, height: 7, borderRadius: '50%', background: 'var(--color-gold)' }}
          />
        )}
      </motion.button>
    </motion.div>
  )
}

// ---------- Entrega de hoje (3 estados + próxima + vazio) ----------
function TodayDeliveryCard({ order, isToday, onOpen }: { order: TodayOrder | null; isToday: boolean; onOpen: () => void }) {
  const baseCard: CSSProperties = {
    borderRadius: 'var(--radius-card)',
    overflow: 'hidden',
    border: '1px solid var(--color-border-2)',
    boxShadow: 'var(--shadow-soft)',
    cursor: 'pointer',
  }

  if (!order) {
    return (
      <motion.div
        variants={itemV}
        whileTap={{ scale: 0.985 }}
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpen()}
        aria-label="Ver entregas"
        style={{ ...baseCard, background: 'var(--color-surface)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 13 }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 13,
            background: 'var(--color-surface-2)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="calendar" size={22} color="var(--color-accent)" />
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11.5,
              fontWeight: 700,
              color: 'var(--color-text-ter)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
            }}
          >
            ENTREGA DE HOJE
          </div>
          <div
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--color-text)', marginTop: 2, letterSpacing: '-0.01em' }}
          >
            Nenhuma entrega agendada
          </div>
        </div>
      </motion.div>
    )
  }

  const { status } = order
  const live = status === 'OUT_FOR_DELIVERY'
  const delivered = status === 'DELIVERED'
  // Default seguro: qualquer estado não-final (SCHEDULED, SEPARATED, NOT_DELIVERED…) é
  // tratado como "agendado", NUNCA como "entregue" — espelha o StatusPill do histórico.
  const label = !isToday ? 'PRÓXIMA ENTREGA' : live ? 'SAINDO DO FORNO' : delivered ? 'ENTREGUE' : 'AGENDADO'
  const iconName: IconName = live ? 'truck' : delivered ? 'check' : 'calendar'
  const qtyText = order.quantity === 1 ? '1 pão' : `${order.quantity} pães`
  const titlePrefix = isToday ? 'Entrega de hoje' : `Entrega ${formatDeliveryDay(order.scheduledDate)}`
  const eta = formatEta(order.deliveryTime)

  return (
    <motion.div
      variants={itemV}
      whileTap={{ scale: 0.985 }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      aria-label="Ver entrega de hoje"
      style={baseCard}
    >
      {/* Topo espresso */}
      <div
        style={{
          background: 'var(--color-espresso)',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="cdp-float" style={{ position: 'absolute', top: -40, right: -20, opacity: 0.13, pointerEvents: 'none' }}>
          <BreadMark size={140} color="#E3AC3F" />
        </div>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 13,
            background: 'rgba(227,172,63,0.16)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <Icon name={iconName} size={24} color="#E3AC3F" />
        </div>
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: '#E3AC3F', fontWeight: 700, letterSpacing: '0.06em' }}>{label}</div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 18,
              color: '#FAF5EC',
              marginTop: 2,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {titlePrefix} · {qtyText}
          </div>
        </div>
      </div>

      {/* Rodapé branco: ETA + status + chevron */}
      <div
        style={{
          background: 'var(--color-surface)',
          padding: '13px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Icon name="clock" size={17} color="var(--color-accent)" />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13.5,
              color: 'var(--color-text-sec)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {delivered ? (
              'Entregue'
            ) : eta ? (
              <>
                Chega até <b style={{ color: 'var(--color-text)' }}>{eta}</b>
              </>
            ) : (
              'Horário a confirmar'
            )}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {delivered ? (
            <Pill tone="good">
              <Icon name="check" size={13} color="var(--color-good)" stroke={2.6} />
              Entregue
            </Pill>
          ) : live ? (
            <Pill tone="gold">
              <span
                className="cdp-live-dot"
                style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--color-accent)', flexShrink: 0 }}
              />
              A caminho
            </Pill>
          ) : (
            <Pill tone="neutral">
              <Icon name="clock" size={13} color="var(--color-text-sec)" stroke={2.6} />
              Agendado
            </Pill>
          )}
          <Icon name="chevR" size={17} color="var(--color-text-ter)" />
        </div>
      </div>
    </motion.div>
  )
}

// ---------- Ações rápidas (3 cards) ----------
function QuickActions({ onGo }: { onGo: (path: string) => void }) {
  const items: Array<{ ic: IconName; label: string; sub: string; to: string }> = [
    { ic: 'calendar', label: 'Agenda', sub: 'Semanal', to: '/client/agenda' },
    { ic: 'bag', label: 'Avulso', sub: 'Pedir hoje', to: '/client/creditos?tab=avulso' },
    { ic: 'clock', label: 'Histórico', sub: 'Pedidos', to: '/client/pedidos' },
  ]
  return (
    <motion.div variants={containerV} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
      {items.map((it) => (
        <motion.button
          key={it.to}
          variants={itemV}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 26 }}
          onClick={() => onGo(it.to)}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-soft)',
            padding: 13,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 7,
            textAlign: 'center',
            minHeight: 44,
          }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--color-surface-2)', display: 'grid', placeItems: 'center' }}>
            <Icon name={it.ic} size={20} color="var(--color-accent)" stroke={2} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>{it.label}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, color: 'var(--color-text-ter)', marginTop: 1 }}>{it.sub}</div>
          </div>
        </motion.button>
      ))}
    </motion.div>
  )
}

interface NextDay {
  abbr: string
  dayNum: number
  qty: number
  key: string
  isToday: boolean
}

// ---------- Próximas entregas (faixa de dias, dados reais) ----------
function NextDays({ days, loading, hasSchedule, onEdit }: { days: NextDay[]; loading: boolean; hasSchedule: boolean; onEdit: () => void }) {
  return (
    <motion.div variants={containerV}>
      <motion.div variants={itemV} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '4px 2px 10px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
          Próximas entregas
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onEdit}
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
        </motion.button>
      </motion.div>

      {loading ? (
        <div style={{ display: 'flex', gap: 10, overflow: 'hidden' }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="cdp-shimmer" style={{ flexShrink: 0, width: 60, height: 82, borderRadius: 16 }} />
          ))}
        </div>
      ) : !hasSchedule ? (
        <motion.p variants={itemV} style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-sec)', margin: '2px 2px 0' }}>
          Configure sua agenda para ver as próximas entregas
        </motion.p>
      ) : (
        <div style={{ position: 'relative' }}>
          <motion.div
            variants={containerV}
            className="cdp-carousel"
            style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}
          >
            {days.map((d) => {
              const active = d.qty > 0
              const today = d.isToday
              const highlight = today || active
              return (
                <motion.div key={d.key + d.dayNum} variants={itemV} style={{ flexShrink: 0, width: 60, scrollSnapAlign: 'start' }}>
                  <div
                    style={{
                      position: 'relative',
                      textAlign: 'center',
                      padding: '12px 0',
                      borderRadius: 16,
                      background: highlight ? 'var(--color-surface)' : 'transparent',
                      border: today
                        ? '2px solid var(--color-gold)'
                        : `1.5px solid ${active ? 'var(--color-border-2)' : 'var(--color-border)'}`,
                      opacity: highlight ? 1 : 0.5,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 11.5,
                        color: today ? 'var(--color-accent)' : 'var(--color-text-ter)',
                        fontWeight: today ? 700 : 600,
                      }}
                    >
                      {today ? 'Hoje' : d.abbr}
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--color-text)', margin: '2px 0' }}>
                      {d.dayNum}
                    </div>
                    {active ? (
                      <Pill tone="gold" style={{ padding: '3px 8px', fontSize: 10.5, gap: 3 }}>
                        <span>{d.qty}</span>
                        <span style={{ fontSize: 10, lineHeight: 1 }} role="img" aria-label="pães">
                          🥖
                        </span>
                      </Pill>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, color: 'var(--color-text-ter)' }}>folga</span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
          {/* Dica de rolagem — fade sutil na borda direita quando há overflow */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 8,
              right: 0,
              width: 28,
              pointerEvents: 'none',
              background: 'linear-gradient(90deg, transparent, var(--color-app-bg))',
            }}
          />
        </div>
      )}
    </motion.div>
  )
}

export function HomeScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  // fallbackToNext: quando não há entrega hoje, mostra a próxima entrega futura
  const { order, isToday } = useOrderTracking({ fallbackToNext: true })
  const { unreadCount } = useNotif()
  // Slots cuja PRÓXIMA entrega já está fechada (corte passou) — por slot do condomínio
  const [closedSlots, setClosedSlots] = useState<Array<{ name: string; label?: string; deliveryWhen: string }>>([])

  // Mantém o saldo sincronizado com o servidor (refresh de página + troca de aba)
  useCreditBalanceSync()

  const creditBalance = user?.creditBalance ?? 0

  // Dados reais de agendamento para NextDays (GET /schedules/me via useSchedule).
  // dailyQty soma todos os slots (multi-slot) ou usa weeklyQty (single-slot).
  const { dailyQty, isLoading: scheduleLoading } = useSchedule(creditBalance)

  // Status da recarga automática — quando ativa, o saldo zerado não é risco (o sistema recarrega).
  const { status: autoRecharge, loading: autoRechargeLoading } = useAutoRecharge()

  // Semana inteira (7 dias) ancorada em HOJE (BRT) — inclui folgas; hoje recebe destaque dourado
  const nextDays: NextDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const key = DAY_KEY_MAP[d.getDay()]
    return {
      abbr: DAY_ABBR[key],
      dayNum: d.getDate(),
      qty: dailyQty?.[key] ?? 0,
      key,
      isToday: i === 0,
    }
  })

  const hasSchedule = Object.values(dailyQty).some((v) => v > 0)

  // "Rende ~N dias" pelo ritmo real: média diária = consumo semanal / 7.
  const weeklyTotal = Object.values(dailyQty).reduce((acc, v) => acc + (v || 0), 0)
  const daysEstimate = weeklyTotal > 0 ? Math.max(1, Math.floor(creditBalance / (weeklyTotal / 7))) : undefined

  useEffect(() => {
    // Status de corte por slot do condomínio do cliente (autenticado)
    apiFetch('/settings/cutoff-status')
      .then((res) => (res.ok ? res.json() : { slots: [] }))
      .then((data: { slots?: Array<{ name: string; label?: string; locked: boolean; deliveryWhen: string }> }) => {
        setClosedSlots(
          (data.slots ?? [])
            .filter((s) => s.locked)
            .map((s) => ({ name: s.name, label: s.label, deliveryWhen: s.deliveryWhen })),
        )
      })
      .catch(() => {
        // Falha silenciosa — não exibe banner em caso de erro de rede
        setClosedSlots([])
      })
  }, [])

  const firstName = user?.name?.split(' ')[0] ?? 'você'
  const greeting = getGreeting()
  const addressLine = user?.condominiumName
    ? `${user.condominiumName}${user.apartment ? ` · ${user.apartment}` : ''}`
    : 'Bem-vindo de volta'

  const showRiskBanner =
    hasSchedule && creditBalance === 0 && !autoRechargeLoading && !autoRecharge?.active

  return (
    <MotionConfig reducedMotion="user">
      <motion.div variants={containerV} initial="hidden" animate="show" style={{ paddingBottom: 24 }}>
        {/* Saudação + sino */}
        <Greet
          greeting={greeting}
          name={firstName}
          addressLine={addressLine}
          unreadCount={unreadCount}
          onBell={() => navigate('/client/notificacoes')}
        />

        <motion.div variants={containerV} style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Aviso leve de prazo — a próxima entrega do slot já fechou */}
          {closedSlots.length > 0 && (
            <motion.div
              variants={itemV}
              style={{
                background: 'var(--color-surface-2)',
                border: '1.5px solid var(--color-accent)',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                gap: 11,
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: 'var(--color-surface)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                <Icon name="clock" size={17} color="var(--color-gold)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 14.5,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Eita, foi por pouquin!
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: 'var(--color-text-sec)',
                    lineHeight: 1.4,
                  }}
                >
                  {`${closedSlots
                    .map((s) => `A ${(s.label ?? SLOT_LABEL[s.name] ?? s.name).toLowerCase()} de ${s.deliveryWhen} já fechou.`)
                    .join(' ')} Os próximos dias seguem tudo certin pra agendar! 🥖`}
                </span>
              </div>
            </motion.div>
          )}

          {/* Card de saldo */}
          <motion.div variants={itemV}>
            <CreditBalanceCard creditBalance={creditBalance} isLoading={false} daysEstimate={daysEstimate} />
          </motion.div>

          {/* Entrega de hoje */}
          <TodayDeliveryCard order={order} isToday={isToday} onOpen={() => navigate('/client/pedidos')} />

          {/* Aviso de risco — agenda ativa, saldo zerado e SEM recarga automática */}
          {showRiskBanner && (
            <motion.div
              variants={itemV}
              style={{
                background: 'var(--color-gold-soft)',
                border: '1.5px solid var(--color-gold)',
                borderRadius: 16,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Icon name="alert" size={20} color="var(--color-accent)" />
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    color: 'var(--color-text)',
                    margin: 0,
                    lineHeight: 1.45,
                  }}
                >
                  Sua agenda está ativa, mas você está <strong>sem créditos</strong>. Adicione créditos para não perder as próximas entregas. 🥖
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/client/creditos')}
                style={{
                  alignSelf: 'flex-start',
                  minHeight: 44,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-btn)',
                  border: 'none',
                  background: 'var(--color-espresso)',
                  color: '#FAF5EC',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Comprar créditos
              </motion.button>
            </motion.div>
          )}

          {/* Ações rápidas */}
          <QuickActions onGo={navigate} />

          {/* Próximas entregas */}
          <NextDays
            days={nextDays}
            loading={scheduleLoading}
            hasSchedule={hasSchedule}
            onEdit={() => navigate('/client/agenda')}
          />
        </motion.div>
      </motion.div>
    </MotionConfig>
  )
}
