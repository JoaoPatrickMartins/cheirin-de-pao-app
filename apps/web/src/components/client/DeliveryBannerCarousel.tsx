/**
 * DeliveryBannerCarousel — banner de entrega da Home como carrossel.
 *
 * Topo espresso FIXO (contexto da entrega) + rodapé branco que ALTERNA entre dois slides:
 *   - "corte"   → horários de corte por slot (aparece ~5s, entra primeiro)
 *   - "entrega" → ETA + status da entrega    (aparece ~10s)
 *
 * Regras:
 *   - Com entrega (hoje ou próxima) e slots de corte → rotaciona corte → entrega → loop.
 *   - Sem entrega agendada → SÓ o slide de corte, estático (cabeçalho vira contexto de corte).
 *   - Sem entrega E sem slots → card simples "Nenhuma entrega agendada" (fallback).
 *   - Pausa ao tocar/passar o mouse; dots trocam de slide manualmente.
 *
 * Reduced-motion: `MotionConfig reducedMotion="user"` (na HomeScreen) + a regra global de
 * prefers-reduced-motion zeram deslizes/transições — o conteúdo ainda alterna, sem movimento.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { Icon, Ic } from '../brand/Icon'
import { BreadMark } from '../brand/BreadMark'
import type { TodayOrder } from '../../hooks/useOrderTracking'
import type { CutoffSlot } from '../../hooks/useCutoffStatus'

type IconName = keyof typeof Ic
type SlideKey = 'corte' | 'entrega'

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]

// Duração de apresentação de cada slide. Corte é um lembrete rápido; entrega é a info principal.
const SLIDE_MS: Record<SlideKey, number> = { corte: 5000, entrega: 10000 }

const DAY_KEY_MAP: Record<number, string> = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' }
const DAY_ABBR: Record<string, string> = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom' }

// "Seg 22" a partir da data ISO de uma entrega futura
function formatDeliveryDay(iso: string): string {
  const d = new Date(iso)
  const key = DAY_KEY_MAP[d.getDay()]
  return `${DAY_ABBR[key]} ${d.getDate()}`
}

// "07:15" → "7:15" (horário de chegada). Null se não houver.
function formatEta(value?: string): string | null {
  if (!value) return null
  const m = value.match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  return `${parseInt(m[1], 10)}:${m[2]}`
}

// "22:00" → "22h" ; "06:30" → "6:30" (compacto para os chips de corte)
export function formatSlotTime(hhmm: string): string {
  const m = hhmm?.match(/(\d{1,2}):(\d{2})/)
  if (!m) return hhmm ?? ''
  const h = parseInt(m[1], 10)
  return m[2] === '00' ? `${h}h` : `${h}:${m[2]}`
}

// Entra na orquestração de entrada da Home (stagger) — mesmas chaves que o itemV da HomeScreen.
const itemV: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
}

// Cross-dissolve com deslize horizontal sutil entre os slides do rodapé.
const slideV: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 20 : -20 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE_OUT } },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -20 : 20, transition: { duration: 0.28, ease: 'easeIn' } }),
}

// ---------- Pill (tons neutral / gold / good) — espelha o da HomeScreen ----------
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

const legendStyle: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-text-ter)',
  margin: '7px 0 0',
  lineHeight: 1.35,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

// ---------- Slide: horários de corte ----------
function CutoffSlide({ slots }: { slots: CutoffSlot[] }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Icon name="scissors" size={16} color="var(--color-accent)" />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--color-accent)',
              letterSpacing: '0.06em',
            }}
          >
            CORTE
          </span>
        </div>
        {slots.map((s) => (
          <span
            key={s.slotId ?? s.name}
            title={s.locked ? `Corte de ${s.label} já passou` : undefined}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13.5,
              color: 'var(--color-text-sec)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              opacity: s.locked ? 0.42 : 1,
            }}
          >
            {s.label} <b style={{ color: 'var(--color-text)', fontWeight: 700 }}>{formatSlotTime(s.cutoffTime)}</b>
            <span style={{ color: 'var(--color-text-ter)' }}> › {formatSlotTime(s.time)}</span>
          </span>
        ))}
      </div>
      <p style={legendStyle}>Peça até o horário de corte para a próxima entrega.</p>
    </div>
  )
}

// ---------- Slide: ETA + status da entrega ----------
function DeliverySlide({ order }: { order: TodayOrder }) {
  const { status } = order
  const live = status === 'OUT_FOR_DELIVERY'
  const delivered = status === 'DELIVERED'
  const eta = formatEta(order.deliveryTime)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
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
        <div style={{ flexShrink: 0 }}>
          {delivered ? (
            <Pill tone="good">
              <Icon name="check" size={13} color="var(--color-good)" stroke={2.6} />
              Entregue
            </Pill>
          ) : live ? (
            <Pill tone="gold">
              <span className="cdp-live-dot" style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--color-accent)', flexShrink: 0 }} />
              A caminho
            </Pill>
          ) : (
            <Pill tone="neutral">
              <Icon name="clock" size={13} color="var(--color-text-sec)" stroke={2.6} />
              Agendado
            </Pill>
          )}
        </div>
      </div>
      <p style={legendStyle}>Sai quentinho do forno, direto pra sua porta.</p>
    </div>
  )
}

// ---------- Pagination dots ----------
function Dots({ slides, activeIdx, onSelect }: { slides: SlideKey[]; activeIdx: number; onSelect: (i: number) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
      {slides.map((s, i) => {
        const active = i === activeIdx
        return (
          <button
            key={s}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSelect(i)
            }}
            aria-label={s === 'corte' ? 'Ver horários de corte' : 'Ver entrega'}
            aria-current={active}
            style={{
              width: active ? 18 : 6,
              height: 6,
              borderRadius: 999,
              background: active ? 'var(--color-gold)' : 'var(--color-border-2)',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              transition: 'width 0.3s ease, background 0.3s ease',
            }}
          />
        )
      })}
    </div>
  )
}

export function DeliveryBannerCarousel({
  order,
  isToday,
  slots,
  onOpenDelivery,
  onOpenCutoff,
}: {
  order: TodayOrder | null
  isToday: boolean
  slots: CutoffSlot[]
  onOpenDelivery: () => void
  onOpenCutoff: () => void
}) {
  const hasDelivery = !!order
  const hasSlots = slots.length > 0

  // Composição dos slides pelo estado atual.
  const carouselSlides: SlideKey[] =
    hasDelivery && hasSlots ? ['corte', 'entrega'] : hasDelivery ? ['entrega'] : hasSlots ? ['corte'] : []

  const count = carouselSlides.length
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const [paused, setPaused] = useState(false)

  const idx = count > 0 ? index % count : 0
  const active = carouselSlides[idx]

  // Auto-rotação: só com 2+ slides e sem pausa. Duração depende do slide ativo.
  useEffect(() => {
    if (count < 2 || paused) return
    const t = setTimeout(() => {
      setDir(1)
      setIndex((i) => i + 1)
    }, SLIDE_MS[active])
    return () => clearTimeout(t)
  }, [idx, active, count, paused])

  const goTo = (target: number) => {
    setDir(target > idx ? 1 : -1)
    setIndex(target)
  }

  const baseCard: CSSProperties = {
    borderRadius: 'var(--radius-card)',
    overflow: 'hidden',
    border: '1px solid var(--color-border-2)',
    boxShadow: 'var(--shadow-soft)',
    cursor: 'pointer',
  }

  // Fallback: sem entrega E sem slots → card simples (condo sem slots ativos).
  if (count === 0) {
    return (
      <motion.div
        variants={itemV}
        whileTap={{ scale: 0.985 }}
        onClick={onOpenDelivery}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpenDelivery()}
        aria-label="Ver entregas"
        data-tour="entrega-hoje"
        style={{ ...baseCard, background: 'var(--color-surface)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 13 }}
      >
        <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--color-surface-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="calendar" size={22} color="var(--color-accent)" />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-ter)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            ENTREGA DE HOJE
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--color-text)', marginTop: 2, letterSpacing: '-0.01em' }}>
            Nenhuma entrega agendada
          </div>
        </div>
      </motion.div>
    )
  }

  // ----- Cabeçalho espresso (fixo): contexto de entrega ou, sem entrega, de corte -----
  let headerLabel: string
  let headerIcon: IconName
  let headerTitle: string
  if (order) {
    const { status } = order
    const live = status === 'OUT_FOR_DELIVERY'
    const delivered = status === 'DELIVERED'
    headerLabel = !isToday ? 'PRÓXIMA ENTREGA' : live ? 'SAINDO DO FORNO' : delivered ? 'ENTREGUE' : 'AGENDADO'
    headerIcon = live ? 'truck' : delivered ? 'check' : 'calendar'
    const qtyText = order.quantity === 1 ? '1 pão' : `${order.quantity} pães`
    const titlePrefix = isToday ? 'Entrega de hoje' : `Entrega ${formatDeliveryDay(order.scheduledDate)}`
    headerTitle = `${titlePrefix} · ${qtyText}`
  } else {
    headerLabel = 'FIQUE DE OLHO NO CORTE'
    headerIcon = 'scissors'
    headerTitle = 'Garanta sua próxima fornada'
  }

  const handleOpen = () => (active === 'corte' ? onOpenCutoff() : onOpenDelivery())

  return (
    <motion.div
      variants={itemV}
      whileTap={{ scale: 0.985 }}
      onClick={handleOpen}
      // Só o card navega no Enter — Enter num dot focado ativa o dot, não a navegação.
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget === e.target && handleOpen()}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      role="button"
      tabIndex={0}
      aria-label="Entrega e horários de corte"
      aria-roledescription="carrossel"
      data-tour="entrega-hoje"
      style={baseCard}
    >
      {/* Topo espresso (fixo) */}
      <div style={{ background: 'var(--color-espresso)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 13, position: 'relative', overflow: 'hidden' }}>
        <div className="cdp-float" style={{ position: 'absolute', top: -40, right: -20, opacity: 0.13, pointerEvents: 'none' }}>
          <BreadMark size={140} color="#E3AC3F" />
        </div>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(227,172,63,0.16)', display: 'grid', placeItems: 'center', flexShrink: 0, position: 'relative' }}>
          <Icon name={headerIcon} size={24} color="#E3AC3F" />
        </div>
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: '#E3AC3F', fontWeight: 700, letterSpacing: '0.06em' }}>{headerLabel}</div>
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
            {headerTitle}
          </div>
        </div>
      </div>

      {/* Rodapé branco: carrossel corte ⇄ entrega + dots */}
      <div style={{ background: 'var(--color-surface)', padding: '13px 18px 12px' }}>
        <div style={{ position: 'relative', minHeight: 52 }}>
          <AnimatePresence initial={false} custom={dir}>
            <motion.div
              key={active}
              custom={dir}
              variants={slideV}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
            >
              {active === 'corte' ? <CutoffSlide slots={slots} /> : order ? <DeliverySlide order={order} /> : null}
            </motion.div>
          </AnimatePresence>
        </div>

        {count > 1 && <Dots slides={carouselSlides} activeIdx={idx} onSelect={goTo} />}
      </div>
    </motion.div>
  )
}
