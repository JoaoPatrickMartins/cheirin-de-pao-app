import { useEffect, useState } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { AdminHead } from '../../../components/admin/AdminHead'
import { Icon } from '../../../components/brand/Icon'

// ---------------------------------------------------------------------------
// Tipos (espelham GET /admin/supplier-orders/upcoming-days)
// ---------------------------------------------------------------------------

export interface DaySlot {
  slotId: string
  label: string
  emoji: string
  time: string
  cutoffTime: string
  cutoffAt: string
  deliveryDate: string
  /** Confirmados (o que será pedido). */
  breads: number
  /** Previstos pela agenda (ainda não materializados) — contexto. */
  projectedBreads: number
  deliveries: number
  riskCount: number
  generated: boolean
  pastCutoff: boolean
  hasOrders: boolean
}

export interface UpcomingDay {
  date: string
  slots: DaySlot[]
  totalBreads: number
  hasOrders: boolean
  allGenerated: boolean
  anyPending: boolean
}

interface Props {
  onOpenDay: (day: UpcomingDay) => void
  onOpenHistory: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Tone = 'gold' | 'good' | 'warn' | 'mut'

interface DayStatus {
  tone: Tone
  pill: string
  rail: boolean // rail colorido?
  partial: boolean // mostra barra de progresso?
  progress: number // 0..1
}

function slotColor(slotId: string): string {
  if (slotId === 'manha') return 'var(--color-gold)'
  if (slotId === 'tarde') return 'var(--color-accent)'
  return 'var(--color-text-sec)'
}

const TONE_RAIL: Record<Tone, string> = {
  gold: 'var(--color-gold)',
  good: 'var(--color-good)',
  warn: 'var(--color-warn)',
  mut: 'var(--color-border)',
}
const TONE_PILL_BG: Record<Tone, string> = {
  gold: 'var(--color-gold-soft)',
  good: 'var(--color-good-soft)',
  warn: '#F8E7DA',
  mut: 'var(--color-surface-2)',
}
const TONE_PILL_FG: Record<Tone, string> = {
  gold: '#8A6A00',
  good: 'var(--color-good)',
  warn: 'var(--color-warn)',
  mut: 'var(--color-text-sec)',
}

/** Deriva o estado visual de um dia a partir dos seus turnos (em "só confirmados"). */
function dayStatus(day: UpcomingDay): DayStatus {
  const withOrders = day.slots.filter((s) => s.hasOrders)
  if (withOrders.length === 0) {
    return { tone: 'mut', pill: 'Vazio', rail: false, partial: false, progress: 0 }
  }
  const generated = withOrders.filter((s) => s.generated)
  const confirmed = withOrders.reduce((a, s) => a + s.breads, 0)
  const generatedBreads = generated.reduce((a, s) => a + s.breads, 0)
  const risk = withOrders.reduce((a, s) => a + s.riskCount, 0)

  if (generated.length === withOrders.length) {
    return { tone: 'good', pill: 'Pronto', rail: true, partial: false, progress: 1 }
  }
  if (generated.length > 0) {
    return {
      tone: 'gold',
      pill: 'Parcial',
      rail: true,
      partial: true,
      progress: confirmed > 0 ? generatedBreads / confirmed : 0,
    }
  }
  if (risk > 0) {
    return { tone: 'warn', pill: 'Risco', rail: true, partial: false, progress: 0 }
  }
  if (confirmed > 0) {
    return { tone: 'gold', pill: 'Pendente', rail: true, partial: false, progress: 0 }
  }
  // Só previstos (nada confirmado ainda) — informativo, mas ainda em destaque (não dimmed).
  return { tone: 'gold', pill: 'Previsto', rail: true, partial: false, progress: 0 }
}

/** "YYYY-MM-DD" → Date ao meio-dia BRT (estável p/ formatação e diff). */
function parseDay(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00-03:00`)
}

function todayStrBRT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/** Rótulo amigável: "Hoje" / "Amanhã" / "Segunda-feira". */
function dayTitle(dateStr: string): string {
  const diff = Math.round((parseDay(dateStr).getTime() - parseDay(todayStrBRT()).getTime()) / 86_400_000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  const wd = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).format(parseDay(dateStr))
  return wd.charAt(0).toUpperCase() + wd.slice(1)
}

/** "28 jun" (curto) para a medalhão / subtítulos. */
function dayShort(dateStr: string): { wd: string; dn: string; mon: string } {
  const d = parseDay(dateStr)
  return {
    wd: new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).format(d).replace('.', ''),
    dn: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: 'America/Sao_Paulo' }).format(d),
    mon: new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' }).format(d).replace('.', ''),
  }
}

/** Tempo restante até `iso` formatado ("1h 58m" / "12min" / null se já passou). */
function remainingTo(iso: string): string | null {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return null
  const totalMin = Math.floor(diff / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}min`
}

/** Subtítulo desambiguado do dia/turno: "entrega <dia> · corte <quando>". */
function disambiguation(day: UpcomingDay): string {
  const open = day.slots.filter((s) => s.hasOrders && !s.generated && !s.pastCutoff)
  const ref = open[0] ?? day.slots.find((s) => s.hasOrders) ?? day.slots[0]
  if (!ref) return ''
  const rem = remainingTo(ref.cutoffAt)
  const cut = rem ? `corte ${ref.label.toLowerCase()} em ${rem}` : `corte ${ref.label.toLowerCase()} ${ref.cutoffTime}`
  return `entrega ${ref.label.toLowerCase()} · ${cut}`
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function DiasEmAberto({ onOpenDay, onOpenHistory }: Props) {
  const [days, setDays] = useState<UpcomingDay[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showEmpties, setShowEmpties] = useState(false)
  const [, setTick] = useState(0)

  async function load() {
    try {
      const res = await apiFetch('/admin/supplier-orders/upcoming-days?days=7')
      if (res.ok) {
        const data = (await res.json()) as { days: UpcomingDay[] }
        setDays(data.days)
      }
    } catch {
      // falha silenciosa
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  // Atualiza os countdowns ao vivo (20s)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 20_000)
    return () => clearInterval(id)
  }, [])

  // Corte mais urgente em aberto (para o hero): com pedidos, não gerado, corte à frente.
  const urgent = (() => {
    if (!days) return null
    let best: { day: UpcomingDay; slot: DaySlot } | null = null
    for (const day of days) {
      for (const slot of day.slots) {
        // Urgente só quando há CONFIRMADOS a pedir (gerar-direto faz sentido), corte à frente.
        if (slot.breads <= 0 || slot.generated || slot.pastCutoff) continue
        if (!best || slot.cutoffAt < best.slot.cutoffAt) best = { day, slot }
      }
    }
    return best
  })()

  async function gerarDiretoUrgent() {
    if (!urgent) return
    setGenerating(true)
    try {
      const res = await apiFetch('/admin/supplier-orders/quick', {
        method: 'POST',
        body: JSON.stringify({ slotId: urgent.slot.slotId, date: urgent.day.date }),
      })
      if (res.ok) await load()
    } catch {
      // falha silenciosa
    } finally {
      setGenerating(false)
    }
  }

  const actionableDays = (days ?? []).filter((d) => d.hasOrders)
  const emptyDays = (days ?? []).filter((d) => !d.hasOrders)

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <AdminHead
        sub="Próximos 7 dias"
        titulo="Pedidos"
        action={
          <button
            onClick={onOpenHistory}
            aria-label="Histórico de compras"
            title="Histórico de compras"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 13px',
              borderRadius: 999,
              border: '1px solid var(--color-border-2)',
              background: 'var(--color-surface)',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 12.5,
              color: 'var(--color-text)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <Icon name="clock" size={15} color="var(--color-accent)" stroke={2} />
            Histórico
          </button>
        }
      />

      <div style={{ flex: 1, padding: '0 20px 20px', overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '3px solid var(--color-border)',
                borderTopColor: 'var(--color-accent)',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        ) : (
          <>
            {/* Hero — sinal de urgência (escuro) quando há corte pendente; senão calmo */}
            {urgent ? (
              <UrgentHero
                day={urgent.day}
                slot={urgent.slot}
                generating={generating}
                onGerar={() => void gerarDiretoUrgent()}
                onAjustar={() => onOpenDay(urgent.day)}
              />
            ) : (
              <CalmHero hasAny={actionableDays.length > 0} />
            )}

            {/* Lista de dias acionáveis */}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.05em',
                color: 'var(--color-text-sec)',
                margin: '20px 2px 10px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              DIAS EM ABERTO
              <span style={{ color: 'var(--color-text-ter)', fontWeight: 700 }}>
                {actionableDays.length} {actionableDays.length === 1 ? 'dia' : 'dias'}
              </span>
            </p>

            {actionableDays.length === 0 ? (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13.5,
                  color: 'var(--color-text-ter)',
                  textAlign: 'center',
                  padding: '20px 0',
                  margin: 0,
                }}
              >
                Nenhum dia com pedidos nos próximos 7 dias.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {actionableDays.map((day) => (
                  <DayCard key={day.date} day={day} onOpen={() => onOpenDay(day)} />
                ))}
              </div>
            )}

            {/* Dias vazios colapsados */}
            {emptyDays.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => setShowEmpties((v) => !v)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '12px 16px',
                    background: 'transparent',
                    border: '1px dashed var(--color-border)',
                    borderRadius: 16,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: 'var(--color-surface-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="calendar" size={15} color="var(--color-text-ter)" stroke={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text-sec)', margin: 0 }}>
                      {emptyDays.length} {emptyDays.length === 1 ? 'dia sem agendamentos' : 'dias sem agendamentos'}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: '1px 0 0' }}>
                      {emptyDays.map((d) => `${dayShort(d.date).wd} ${dayShort(d.date).dn}`).join(' · ')}
                    </p>
                  </div>
                  <Icon name={showEmpties ? 'chevD' : 'chevR'} size={18} color="var(--color-text-ter)" stroke={2.2} />
                </button>

                {showEmpties && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 11 }}>
                    {emptyDays.map((day) => (
                      <DayCard key={day.date} day={day} onOpen={() => onOpenDay(day)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(227,172,63,.55)} 70%{box-shadow:0 0 0 8px rgba(227,172,63,0)} 100%{box-shadow:0 0 0 0 rgba(227,172,63,0)} }`}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function UrgentHero({
  day,
  slot,
  generating,
  onGerar,
  onAjustar,
}: {
  day: UpcomingDay
  slot: DaySlot
  generating: boolean
  onGerar: () => void
  onAjustar: () => void
}) {
  const rem = remainingTo(slot.cutoffAt)
  return (
    <div
      style={{
        borderRadius: 22,
        padding: 16,
        color: '#f6ead2',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg,#2a1a0b 0%,#1b1006 100%)',
        boxShadow: '0 14px 28px -16px rgba(43,26,12,.65)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -30,
          top: -30,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(227,172,63,.34),transparent 68%)',
        }}
      />
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-gold)', marginBottom: 10 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-gold)', animation: 'pulse 2s infinite' }} />
        Próximo corte
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, position: 'relative', zIndex: 2 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.12 }}>
            {slot.label} fecha em <span style={{ color: 'var(--color-gold)' }}>{rem ?? 'agora'}</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#cdb893', marginTop: 4, lineHeight: 1.4 }}>
            Entrega {dayTitle(day.date).toLowerCase()} {slot.label.toLowerCase()} · corte {slot.cutoffTime}
            {slot.projectedBreads > 0 ? ` · +${slot.projectedBreads} previstos` : ''}
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, textAlign: 'right', whiteSpace: 'nowrap' }}>
          {slot.breads}
          <span style={{ fontSize: 24, position: 'relative', top: -8, marginLeft: 2 }}>🥖</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 9, marginTop: 14, position: 'relative', zIndex: 2 }}>
        <button
          onClick={onGerar}
          disabled={generating}
          style={{
            flex: 1,
            border: 'none',
            borderRadius: 16,
            padding: 13,
            background: 'var(--color-gold)',
            color: '#2a1a07',
            fontFamily: 'var(--font-body)',
            fontWeight: 800,
            fontSize: 14.5,
            cursor: generating ? 'wait' : 'pointer',
            opacity: generating ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
          }}
        >
          <Icon name="spark" size={17} color="#2a1a07" stroke={2.2} />
          Gerar direto
        </button>
        <button
          onClick={onAjustar}
          style={{
            border: '1px solid rgba(246,234,210,0.28)',
            borderRadius: 16,
            padding: '13px 15px',
            background: 'transparent',
            color: '#f6ead2',
            fontFamily: 'var(--font-body)',
            fontWeight: 800,
            fontSize: 13.5,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Ajustar antes
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 11, paddingTop: 11, borderTop: '1px solid rgba(246,234,210,0.14)', fontSize: 11, color: '#cdb893', position: 'relative', zIndex: 2 }}>
        <Icon name="spark" size={13} color="#cdb893" stroke={2} />
        <span>
          Rede de segurança: gera sozinho às <b style={{ color: '#e8d4ad' }}>{slot.cutoffTime}</b> se ninguém agir.
        </span>
      </div>
    </div>
  )
}

function CalmHero({ hasAny }: { hasAny: boolean }) {
  return (
    <div
      style={{
        borderRadius: 22,
        padding: 16,
        background: 'var(--color-good-soft)',
        border: '1px solid var(--color-good)',
        display: 'flex',
        alignItems: 'center',
        gap: 13,
      }}
    >
      <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="check" size={22} color="var(--color-good)" stroke={2.4} />
      </div>
      <div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 800, color: 'var(--color-good)', margin: 0 }}>
          Nenhum corte pendente
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-sec)', margin: '2px 0 0' }}>
          {hasAny ? 'Os pedidos em aberto já estão gerados.' : 'Sem pedidos para os próximos dias.'}
        </p>
      </div>
    </div>
  )
}

function DayCard({ day, onOpen }: { day: UpcomingDay; onOpen: () => void }) {
  const st = dayStatus(day)
  const { wd, dn } = dayShort(day.date)
  const diff = Math.round((parseDay(day.date).getTime() - parseDay(todayStrBRT()).getTime()) / 86_400_000)
  const highlight = diff <= 1 // hoje/amanhã destacam o medalhão
  const orderedSlots = day.slots.filter((s) => s.hasOrders)
  const risk = orderedSlots.reduce((a, s) => a + s.riskCount, 0)
  const projectedTotal = orderedSlots.reduce((a, s) => a + s.projectedBreads, 0)
  // Risco a D+2 ou mais é estimativa (saldo é point-in-time).
  const riskEstimated = diff >= 2
  // Número grande = confirmados; se ainda não há confirmado, mostra os previstos.
  const bigNumber = day.totalBreads > 0 ? day.totalBreads : projectedTotal
  const caption =
    day.totalBreads > 0 && projectedTotal > 0
      ? `+${projectedTotal} prev.`
      : day.totalBreads === 0 && projectedTotal > 0
        ? 'previsto'
        : ''

  return (
    <button
      onClick={onOpen}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 18,
        padding: '13px 13px 13px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        boxShadow: st.tone === 'mut' ? 'none' : 'var(--shadow-soft)',
        opacity: st.tone === 'mut' ? 0.66 : 1,
      }}
      aria-label={`Abrir compra de ${dayTitle(day.date)}`}
    >
      {/* Rail de status (único portador de cor de status) */}
      {st.rail && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: TONE_RAIL[st.tone] }} />}

      {/* Medalhão — destaque temporal (hoje/amanhã), senão neutro */}
      <div
        style={{
          width: 50,
          height: 54,
          borderRadius: 14,
          background: highlight ? 'var(--color-gold-soft)' : 'var(--color-surface-2)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-sec)' }}>{wd}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--color-text)' }}>{dn}</span>
      </div>

      {/* Corpo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {dayTitle(day.date)}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '0 0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {orderedSlots.length > 0 ? disambiguation(day) : 'sem agendamentos'}
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {orderedSlots.map((s) => (
            <span
              key={s.slotId}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 99,
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-sec)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                whiteSpace: 'nowrap',
              }}
            >
              <i style={{ width: 7, height: 7, borderRadius: 2, background: slotColor(s.slotId), display: 'inline-block' }} />
              {s.label} {s.breads || s.projectedBreads}
              {s.generated && <span style={{ color: 'var(--color-good)', fontWeight: 900 }}>✓</span>}
            </span>
          ))}
          {risk > 0 && (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 99,
                background: '#F8E7DA',
                color: 'var(--color-warn)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon name="alert" size={11} color="var(--color-warn)" stroke={2.2} />
              {riskEstimated ? `~${risk} risco est.` : `${risk} sem crédito`}
            </span>
          )}
        </div>
        {st.partial && (
          <div style={{ width: '100%', height: 4, borderRadius: 9, background: 'var(--color-surface-2)', overflow: 'hidden', marginTop: 7 }}>
            <div style={{ height: '100%', width: `${Math.round(st.progress * 100)}%`, background: 'var(--color-gold)' }} />
          </div>
        )}
      </div>

      {/* Direita: total + pill + chevron */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0, alignSelf: 'flex-start', paddingTop: 2 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: st.tone === 'mut' ? 'var(--color-text-ter)' : 'var(--color-text)' }}>
          {bigNumber}{st.tone !== 'mut' ? ' 🥖' : ''}
        </span>
        {caption && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, fontWeight: 700, color: 'var(--color-accent)', lineHeight: 1 }}>
            {caption}
          </span>
        )}
        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 99, background: TONE_PILL_BG[st.tone], color: TONE_PILL_FG[st.tone] }}>
          {st.pill}
        </span>
      </div>
      <Icon name="chevR" size={18} color="var(--color-text-ter)" stroke={2.2} />
    </button>
  )
}
