import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { AdminHead } from '../../../components/admin/AdminHead'
import { StepBar } from '../../../components/admin/StepBar'
import { Icon } from '../../../components/brand/Icon'
import StepperInline from '../../../components/client/StepperInline'
import { CondominiumOrderDetail } from '../../../components/admin/CondominiumOrderDetail'
import { SupplierOrderHistory } from '../../../components/admin/SupplierOrderHistory'
import { SegmentedControl } from '../../../components/admin/SegmentedControl'
import { slotTabLabel } from '../../../lib/slots'
import { cutoffInstantForDelivery } from '../../../lib/cutoff'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface SlotBreakdown {
  slotId: string
  label: string
  breads: number
  deliveries: number
}

interface CondoDraft {
  condominiumId: string
  name: string
  deliveryCount: number
  totalBreads: number
  projectedBreads: number
  projectedDeliveries: number
  bySlot: SlotBreakdown[]
  riskCount: number
}

interface Supplier {
  id: string
  name: string
  pricePerUnit: number
  isPrincipal: boolean
}

interface SlotCutoff {
  slotId: string
  label: string
  emoji?: string
  time: string
  cutoffTime: string
  deliveryDate?: string // ISO — data de entrega do turno (Regra A)
  cutoffAt?: string // ISO — instante absoluto do corte (vem de upcoming-days)
  pastCutoff?: boolean // corte já passou (vem de upcoming-days)
  hasOrders?: boolean // há pedidos (materializados + previstos) neste turno
  generated?: boolean // compra deste turno já finalizada
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTomorrowLabel(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: 'America/Sao_Paulo' }).format(tomorrow)
  const mes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }).format(tomorrow)
  return `${dia} ${mes}`
}

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}

/** Cor do turno: manhã = dourado, tarde = âmbar; demais alternam. */
export function slotColor(slotId: string): string {
  if (slotId === 'manha') return 'var(--gold)'
  if (slotId === 'tarde') return 'var(--accent)'
  return 'var(--text-sec)'
}

/**
 * Instante absoluto (ms) do corte de um slot, considerando a DATA de entrega — não só a
 * hora-do-dia. Usa `cutoffAt` quando o backend já o forneceu (upcoming-days); senão deriva de
 * `deliveryDate` + `time` + `cutoffTime` (slots-status). `null` quando falta informação.
 */
function slotCutoffMs(s: SlotCutoff): number | null {
  if (s.cutoffAt) {
    const t = new Date(s.cutoffAt).getTime()
    return Number.isNaN(t) ? null : t
  }
  if (s.deliveryDate && s.time && s.cutoffTime) {
    return cutoffInstantForDelivery(s.time, s.cutoffTime, s.deliveryDate.slice(0, 10)).getTime()
  }
  return null
}

/**
 * Próximo corte: o slot cujo INSTANTE de corte (absoluto, já ligado à data de entrega) ainda está
 * à frente de `now`. Retorna o tempo restante formatado e o label — ou status encerrado se todos
 * passaram. Compara instantes absolutos (não a hora-do-dia), então um dia futuro não aparece como
 * "Encerrado" só porque o horário do corte já passou no relógio de hoje.
 */
export function nextCutoff(
  slots: SlotCutoff[] | null,
  now: Date = new Date(),
): { open: boolean; label?: string; remaining?: string } {
  if (!slots || slots.length === 0) return { open: true }
  const nowMs = now.getTime()
  const instants = slots
    .map((s) => ({ label: s.label, at: slotCutoffMs(s) }))
    .filter((s): s is { label: string; at: number } => s.at != null)
  if (instants.length === 0) return { open: true } // sem info de corte → assume aberto
  const upcoming = instants.filter((s) => s.at > nowMs).sort((a, b) => a.at - b.at)
  if (upcoming.length === 0) return { open: false }
  const diffMin = Math.floor((upcoming[0].at - nowMs) / 60_000)
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  const remaining = h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}min`
  return { open: true, label: upcoming[0].label, remaining }
}

// ---------------------------------------------------------------------------
// Sub-componente: Spinner inline
// ---------------------------------------------------------------------------

function Spinner() {
  return (
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
  )
}

// ---------------------------------------------------------------------------
// Sub-componente: Rodapé fixo
// ---------------------------------------------------------------------------

interface FooterProps {
  label: string
  totalLabel: string
  totalValue: string | number
  ctaLabel: string
  ctaIcon?: 'scissors' | 'check'
  onCta: () => void
  isLoading?: boolean
}

function Footer({ label, totalLabel, totalValue, ctaLabel, ctaIcon, onCta, isLoading }: FooterProps) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        background: 'var(--color-app-bg)',
        borderTop: '1px solid var(--color-border-2)',
        padding: '12px 20px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13.5,
            fontWeight: 700,
            color: 'var(--color-text-sec)',
          }}
        >
          {totalLabel}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
          }}
        >
          {typeof totalValue === 'number' ? `${totalValue} pães` : totalValue}
        </span>
      </div>

      <button
        onClick={onCta}
        disabled={!!isLoading}
        style={{
          width: '100%',
          padding: '14px 20px',
          borderRadius: 16,
          border: 'none',
          background: 'var(--color-espresso)',
          color: '#FAF5EC',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 700,
          cursor: isLoading ? 'wait' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: 44,
        }}
        aria-label={ctaLabel}
      >
        {ctaIcon && <Icon name={ctaIcon} size={18} color="#FAF5EC" stroke={2.1} />}
        {ctaLabel}
      </button>
      {label && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            color: 'var(--color-text-ter)',
            textAlign: 'center',
            margin: '6px 0 0',
          }}
        >
          {label}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Turno padrão da aba Compra: o PRÓXIMO corte que tem pedido e ainda não foi finalizado.
 * `slots` vem do backend já ordenado pelo próximo corte (data de entrega + horário).
 * Fallbacks: primeiro com pedido; senão o primeiro da lista.
 */
function smartDefaultSlot(slots: SlotCutoff[]): string {
  const pending = slots.find((s) => s.hasOrders && !s.generated)
  if (pending) return pending.slotId
  const withOrders = slots.find((s) => s.hasOrders)
  if (withOrders) return withOrders.slotId
  return slots[0]?.slotId ?? ''
}

/** Data ISO → "27 de junho" (BRT). */
function formatIsoDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  } catch {
    return iso
  }
}

/** Coluna de estatística do card de resumo (mesmo padrão da tela interna do condomínio). */
function Stat({ label, value, color, bread }: { label: string; value: number; color: string; bread?: boolean }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '0 4px' }}>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 21,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          color,
        }}
      >
        {value}{bread ? ' 🥖' : ''}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-ter)',
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  )
}

/** Divisória vertical entre estatísticas. */
function Divider() {
  return <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-border-2)', margin: '1px 0' }} />
}

interface AdminPedidoProps {
  /** Data de entrega alvo (YYYY-MM-DD). Quando presente, a tela é escopada a este dia. */
  deliveryDate?: string
  /** Slots daquele dia (de upcoming-days). Evita refetch de slots-status no modo dia. */
  daySlots?: SlotCutoff[]
  /** Subtítulo desambiguado do header (ex.: "Entrega sáb de manhã · corte sex 22:00"). */
  daySubtitle?: string
  /** Volta para a lista de dias. Quando presente, mostra a seta e esconde o botão Histórico. */
  onBack?: () => void
}

export function AdminPedido({ deliveryDate, daySlots, daySubtitle, onBack }: AdminPedidoProps = {}) {
  const dayMode = !!deliveryDate
  const dateQuery = deliveryDate ? `&date=${deliveryDate}` : ''
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [showHistory, setShowHistory] = useState(false)
  const [slotId, setSlotId] = useState<string>('')
  const [generated, setGenerated] = useState<{ generated: boolean; orderId: string; totalQuantity: number } | null>(null)

  // Dados do draft
  const [draftData, setDraftData] = useState<CondoDraft[] | null>(null)
  const [slots, setSlots] = useState<SlotCutoff[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Drill-down: condomínio selecionado para detalhamento por cliente
  const [detailCondoId, setDetailCondoId] = useState<string | null>(null)

  // Busca de condomínio (step 0)
  const [query, setQuery] = useState('')

  // Tick para atualizar a contagem regressiva do corte (a cada 30s)
  const [, setTick] = useState(0)

  // Step 1 — quantidades ajustadas
  const [adjustedQts, setAdjustedQts] = useState<Record<string, number>>({})

  // Step 2 — fornecedores e divisão
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null)
  const [split, setSplit] = useState<{ p: number; r: number }>({ p: 0, r: 0 })
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false)

  // Step 2 -> 3 — confirmar pedido
  const [isCreating, setIsCreating] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)

  // Step 3 — download
  const [isDownloading, setIsDownloading] = useState<'pdf' | 'excel' | null>(null)

  // ---------------------------------------------------------------------------
  // Busca inicial: draft + cutoff
  // ---------------------------------------------------------------------------

  // Mount: no modo dia usa os slots recebidos; senão carrega o estado dos turnos (Regra A)
  // e abre no PRÓXIMO corte com pedido (não finalizado).
  useEffect(() => {
    // Modo dia: slots já vêm de upcoming-days — sem refetch de slots-status.
    if (dayMode && daySlots) {
      setSlots(daySlots)
      if (daySlots.length > 0) setSlotId(smartDefaultSlot(daySlots))
      else setIsLoading(false)
      return
    }
    void (async () => {
      try {
        const res = await apiFetch('/admin/supplier-orders/slots-status')
        if (res.ok) {
          const data = (await res.json()) as { slots: SlotCutoff[] }
          setSlots(data.slots)
          if (data.slots.length > 0) {
            setSlotId(smartDefaultSlot(data.slots))
            return // o efeito [slotId] cuida de carregar a prévia + status
          }
        }
      } catch {
        // falha silenciosa
      }
      setIsLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Troca de turno: recarrega a prévia + status APENAS daquele turno (pipeline por slot).
  useEffect(() => {
    if (!slotId) return
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      try {
        const [draftRes, statusRes] = await Promise.all([
          apiFetch(`/admin/supplier-orders/draft?slotId=${slotId}${dateQuery}`),
          apiFetch(`/admin/supplier-orders/generated-status?slotId=${slotId}${dateQuery}`),
        ])
        if (cancelled) return
        if (draftRes.ok) setDraftData((await draftRes.json()) as CondoDraft[])
        if (statusRes.ok) {
          setGenerated((await statusRes.json()) as { generated: boolean; orderId: string; totalQuantity: number })
        }
      } catch {
        // falha silenciosa
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slotId])

  // Atualiza a contagem regressiva do corte a cada 30s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // ---------------------------------------------------------------------------
  // Totais derivados
  // ---------------------------------------------------------------------------

  const draftTotal = draftData ? draftData.reduce((sum, c) => sum + c.totalBreads, 0) : 0

  // Resumo global (KPIs + split de turno) — derivado do draft enriquecido
  const summary = (() => {
    const condos = draftData ?? []
    const confirmed = condos.reduce((s, c) => s + c.totalBreads, 0)
    const projected = condos.reduce((s, c) => s + c.projectedBreads, 0)
    const deliveries = condos.reduce((s, c) => s + c.deliveryCount + c.projectedDeliveries, 0)
    const risk = condos.reduce((s, c) => s + c.riskCount, 0)
    const bySlot = new Map<string, { slotId: string; label: string; breads: number }>()
    for (const c of condos) {
      for (const b of c.bySlot) {
        const cur = bySlot.get(b.slotId) ?? { slotId: b.slotId, label: b.label, breads: 0 }
        cur.breads += b.breads
        bySlot.set(b.slotId, cur)
      }
    }
    const slotList = [...bySlot.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
    return {
      confirmed,
      projected,
      deliveries,
      risk,
      condoCount: condos.length,
      slotList,
      slotTotal: slotList.reduce((s, x) => s + x.breads, 0),
    }
  })()

  const cutoff = nextCutoff(slots)

  // Total que o "Gerar direto" vai pedir = SÓ CONFIRMADOS (previstos não entram no pedido).
  const expectedTotal = summary.confirmed

  // Lista filtrada pela busca
  const filteredCondos = (draftData ?? []).filter((c) =>
    query.trim() ? c.name.toLowerCase().includes(query.trim().toLowerCase()) : true,
  )

  const adjustedTotal = draftData
    ? draftData.reduce((sum, c) => sum + (adjustedQts[c.condominiumId] ?? c.totalBreads), 0)
    : 0

  const principal = suppliers?.find((s) => s.isPrincipal) ?? null
  const reserva = suppliers?.find((s) => !s.isPrincipal) ?? null

  const splitTotal = split.p + split.r

  // ---------------------------------------------------------------------------
  // Handlers de navegação
  // ---------------------------------------------------------------------------

  function goToStep1() {
    // Inicializa adjustedQts com valores do draft
    if (draftData) {
      const initial: Record<string, number> = {}
      draftData.forEach((c) => { initial[c.condominiumId] = c.totalBreads })
      setAdjustedQts(initial)
    }
    setStep(1)
  }

  async function goToStep2() {
    setIsLoadingSuppliers(true)
    try {
      const res = await apiFetch('/admin/suppliers')
      if (res.ok) {
        const data = (await res.json()) as Supplier[]
        setSuppliers(data)
        // divisão inicial: 75/25 quando há fornecedor reserva; senão o principal leva tudo
        const hasReserva = data.some((s) => !s.isPrincipal)
        const p = hasReserva ? Math.round(adjustedTotal * 0.75) : adjustedTotal
        const r = adjustedTotal - p
        setSplit({ p, r })
      }
    } catch {
      // falha silenciosa — manter step 1
    } finally {
      setIsLoadingSuppliers(false)
    }
    setStep(2)
  }

  async function finalizarPedido() {
    // Reserva é opcional — basta ter o fornecedor principal (ex.: só 1 padaria cadastrada)
    if (!principal) return
    // Validar que pelo menos um tem quantidade > 0
    if (split.p === 0 && split.r === 0) return

    setIsCreating(true)
    try {
      const items = [
        { supplierId: principal.id, quantity: split.p },
        ...(reserva ? [{ supplierId: reserva.id, quantity: split.r }] : []),
      ].filter((item) => item.quantity > 0)

      const res = await apiFetch('/admin/supplier-orders', {
        method: 'POST',
        body: JSON.stringify({ items, slotId, ...(deliveryDate ? { date: deliveryDate } : {}) }),
      })
      if (res.ok) {
        const data = (await res.json()) as { id: string }
        setOrderId(data.id)
        setGenerated({ generated: true, orderId: data.id, totalQuantity: splitTotal })
        setStep(3)
      }
    } catch {
      // falha silenciosa
    } finally {
      setIsCreating(false)
    }
  }

  /**
   * gerarDireto — "Gerar direto" (1 toque): cria o pedido com a quantidade esperada e o
   * split padrão no backend, pulando os passos Ajustar/Dividir. Vai direto pro Pronto.
   */
  async function gerarDireto() {
    setIsCreating(true)
    try {
      const res = await apiFetch('/admin/supplier-orders/quick', {
        method: 'POST',
        body: JSON.stringify({ slotId, ...(deliveryDate ? { date: deliveryDate } : {}) }),
      })
      if (res.ok) {
        const data = (await res.json()) as { id: string }
        setOrderId(data.id)
        setGenerated({ generated: true, orderId: data.id, totalQuantity: expectedTotal })
        setStep(3)
      }
    } catch {
      // falha silenciosa
    } finally {
      setIsCreating(false)
    }
  }

  async function downloadFile(type: 'pdf' | 'excel') {
    if (!orderId) return
    setIsDownloading(type)
    try {
      const endpoint = type === 'pdf'
        ? `/admin/supplier-orders/${orderId}/pdf`
        : `/admin/supplier-orders/${orderId}/excel`
      const res = await apiFetch(endpoint)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = type === 'pdf' ? 'pedido.pdf' : 'pedido.xlsx'
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // falha silenciosa
    } finally {
      setIsDownloading(null)
    }
  }

  function resetToStart() {
    setStep(0)
    setOrderId(null)
    setAdjustedQts({})
    setSplit({ p: 0, r: 0 })
    setSuppliers(null)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const tomorrowLabel = getTomorrowLabel()
  const selectedSlot = slots?.find((s) => s.slotId === slotId)
  const turnoLabel = selectedSlot?.label ?? ''
  // Data de entrega do turno selecionado (Regra A): Manhã = amanhã, Tarde = hoje, etc.
  const deliveryDateLabel = selectedSlot?.deliveryDate ? formatIsoDate(selectedSlot.deliveryDate) : tomorrowLabel

  // Drill-down em tela cheia — detalhamento por cliente do condomínio selecionado
  if (detailCondoId) {
    return (
      <CondominiumOrderDetail
        condominiumId={detailCondoId}
        slotId={slotId}
        date={deliveryDate}
        onBack={() => setDetailCondoId(null)}
      />
    )
  }

  // Histórico de compras (pedidos ao fornecedor finalizados) — tela cheia
  if (showHistory) {
    return <SupplierOrderHistory onBack={() => setShowHistory(false)} />
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {dayMode ? (
        // Modo dia: header com seta de voltar e data desambiguada (sem botão Histórico).
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 20px 14px' }}>
          <button
            onClick={onBack}
            aria-label="Voltar para os dias"
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              background: 'var(--color-surface-2)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Icon name="chevL" size={20} color="var(--color-text)" stroke={2.2} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11.5,
                fontWeight: 700,
                color: 'var(--color-text-ter)',
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {daySubtitle ?? (turnoLabel ? `Turno ${turnoLabel} · ${deliveryDateLabel}` : deliveryDateLabel)}
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--color-text)',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Compra
            </h1>
          </div>
        </div>
      ) : (
        <AdminHead
          sub={turnoLabel ? `Turno ${turnoLabel} · ${deliveryDateLabel}` : `Pedido ao fornecedor · ${deliveryDateLabel}`}
          titulo="Compra"
          action={
            <button
              onClick={() => setShowHistory(true)}
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
      )}

      <StepBar step={step} onStepClick={(i) => setStep(i as 0 | 1 | 2 | 3)} />

      {/* -------------------------------------------------------------------- */}
      {/* Step 0 — Conferir                                                     */}
      {/* -------------------------------------------------------------------- */}
      {step === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, padding: '0 20px', overflowY: 'auto' }}>
            {isLoading ? (
              <Spinner />
            ) : (
              <>
                {/* Selo: pedido do turno já gerado */}
                {generated?.generated && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: 'var(--color-good-soft)',
                      border: '1px solid var(--color-good)',
                      borderRadius: 16,
                      padding: 14,
                      marginBottom: 16,
                    }}
                  >
                    <Icon name="check" size={20} color="var(--color-good)" stroke={2.4} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 700, color: 'var(--color-good)', margin: 0 }}>
                        Pedido {turnoLabel ? `da ${turnoLabel}` : 'do turno'} já gerado{generated.totalQuantity ? ` · ${generated.totalQuantity} pães` : ''}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-sec)', margin: '2px 0 0' }}>
                        Os pedidos já estão liberados na Separação.
                      </p>
                    </div>
                    <button
                      onClick={() => setGenerated(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-text-sec)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}
                    >
                      Gerar de novo
                    </button>
                  </div>
                )}

                {/* Faixa: rede de segurança (geração automática no corte) — só no modo dia */}
                {dayMode && !generated?.generated && cutoff.open && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'var(--color-gold-soft)',
                      border: '1px solid rgba(227,172,63,0.4)',
                      borderRadius: 14,
                      padding: '11px 13px',
                      marginBottom: 16,
                    }}
                  >
                    <Icon name="spark" size={16} color="var(--color-accent)" stroke={2} />
                    <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 12, color: '#6b531c', lineHeight: 1.4 }}>
                      Sem ação, o pedido é gerado <b style={{ color: '#5a4413' }}>automaticamente 1h após o corte</b> com o split padrão. Você tem esse tempo para gerar agora ou ajustar.
                    </p>
                  </div>
                )}

                {/* Card de horário de corte */}
                <div
                  style={{
                    background: 'var(--color-surface)',
                    borderRadius: 18,
                    padding: 16,
                    border: '1px solid var(--color-border-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'var(--color-gold-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: 'var(--color-accent)',
                    }}
                  >
                    <Icon name="scissors" size={22} color="var(--color-accent)" stroke={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                        margin: '0 0 2px',
                      }}
                    >
                      Horários de corte
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 12,
                        color: 'var(--color-text-ter)',
                        margin: 0,
                      }}
                    >
                      {slots && slots.length > 0
                        ? slots.map((s) => `${s.label} ${s.cutoffTime}`).join(' · ')
                        : 'Após o corte, pedidos do dia são bloqueados'}
                    </p>
                    {cutoff.open && cutoff.remaining && (
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: 'var(--color-accent)',
                          margin: '3px 0 0',
                        }}
                      >
                        Fecha em {cutoff.remaining} · corte {cutoff.label}
                      </p>
                    )}
                  </div>
                  {/* Pill Aberto/Encerrado — derivado do horário atual (BRT) */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 10px',
                      borderRadius: 99,
                      background: cutoff.open ? 'var(--color-good-soft)' : 'var(--color-surface-2)',
                      color: cutoff.open ? 'var(--color-good)' : 'var(--color-text-sec)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {cutoff.open ? 'Aberto' : 'Encerrado'}
                  </span>
                </div>

                {/* Seletor de turno — abre no próximo corte com pedido; fica abaixo do card de corte */}
                {slots && slots.length > 1 && (
                  <div style={{ marginBottom: 16 }}>
                    <SegmentedControl<string>
                      tabs={slots.map((s) => ({ key: s.slotId, label: slotTabLabel(s) }))}
                      value={slotId}
                      onChange={setSlotId}
                    />
                  </div>
                )}

                {/* Resumo (KPIs + split de turno + risco) + busca */}
                {draftData && draftData.length > 0 && (
                  <>
                    {/* Resumo coeso: confirmados / previstos / entregas + split de turno */}
                    <div
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-2)',
                        borderRadius: 16,
                        padding: '13px 8px 6px',
                        boxShadow: 'var(--shadow-soft)',
                        marginBottom: 14,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'stretch' }}>
                        <Stat label="Confirmados" value={summary.confirmed} color="var(--color-text)" bread />
                        <Divider />
                        <Stat label="Previstos" value={summary.projected} color="var(--color-accent)" bread />
                        <Divider />
                        <Stat label="Entregas" value={summary.deliveries} color="var(--color-text)" />
                      </div>

                      {summary.slotTotal > 0 && (
                        <div style={{ borderTop: '1px solid var(--color-border-2)', margin: '10px 6px 0', paddingTop: 11 }}>
                          {summary.slotList.length > 1 && (
                            <div
                              style={{
                                display: 'flex',
                                height: 7,
                                borderRadius: 8,
                                overflow: 'hidden',
                                marginBottom: 9,
                                boxShadow: 'inset 0 0 0 1px var(--color-border-2)',
                              }}
                            >
                              {summary.slotList.map((s) => (
                                <div
                                  key={s.slotId}
                                  style={{
                                    width: `${(s.breads / summary.slotTotal) * 100}%`,
                                    background: slotColor(s.slotId),
                                  }}
                                />
                              ))}
                            </div>
                          )}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'center',
                              gap: 16,
                              flexWrap: 'wrap',
                              fontFamily: 'var(--font-body)',
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: 'var(--color-text-sec)',
                            }}
                          >
                            {summary.slotList.map((s) => (
                              <span key={s.slotId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <i style={{ width: 9, height: 9, borderRadius: 3, background: slotColor(s.slotId) }} />
                                {s.label}
                                <strong style={{ color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
                                  {s.breads}
                                </strong>
                              </span>
                            ))}
                            {summary.risk > 0 && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-accent)' }}>
                                <i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--color-accent)' }} />
                                em risco
                                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{summary.risk}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Busca de condomínio */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-2)',
                        borderRadius: 14,
                        padding: '10px 13px',
                        marginBottom: 14,
                      }}
                    >
                      <Icon name="search" size={16} color="var(--color-text-ter)" stroke={2} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar condomínio…"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          outline: 'none',
                          fontFamily: 'var(--font-body)',
                          fontSize: 13.5,
                          color: 'var(--color-text)',
                          width: '100%',
                        }}
                      />
                    </div>
                  </>
                )}

                {/* Label de seção */}
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: 'var(--color-text-sec)',
                    letterSpacing: '0.04em',
                    margin: '4px 2px 9px',
                  }}
                >
                  CONSOLIDADO POR CONDOMÍNIO
                </p>

                {/* Lista de condomínios */}
                {!draftData || draftData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 18,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                        margin: '0 0 8px',
                      }}
                    >
                      Sem pedidos hoje
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 14,
                        color: 'var(--color-text-sec)',
                        margin: 0,
                      }}
                    >
                      Nenhum cliente agendou entrega para amanhã.
                    </p>
                  </div>
                ) : filteredCondos.length === 0 ? (
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
                    Nenhum condomínio encontrado para “{query}”.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredCondos.map((condo) => (
                      <button
                        key={condo.condominiumId}
                        onClick={() => setDetailCondoId(condo.condominiumId)}
                        style={{
                          background: 'var(--color-surface)',
                          borderRadius: 16,
                          padding: 14,
                          border: '1px solid var(--color-border-2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          width: '100%',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-body)',
                        }}
                        aria-label={`Ver detalhes de ${condo.name}`}
                      >
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                            background: 'var(--color-surface-2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            color: 'var(--color-accent)',
                          }}
                        >
                          <Icon name="building" size={20} color="var(--color-accent)" stroke={2} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontFamily: 'var(--font-body)',
                              fontSize: 14.5,
                              fontWeight: 700,
                              color: 'var(--color-text)',
                              margin: '0 0 4px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {condo.name}
                          </p>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {condo.bySlot.map((s) => (
                              <span
                                key={s.slotId}
                                style={{
                                  fontFamily: 'var(--font-body)',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 99,
                                  background: 'var(--color-surface-2)',
                                  color: 'var(--color-text-sec)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <i
                                  style={{
                                    display: 'inline-block',
                                    width: 7,
                                    height: 7,
                                    borderRadius: 2,
                                    background: slotColor(s.slotId),
                                    marginRight: 5,
                                    verticalAlign: 0,
                                  }}
                                />
                                {s.label} {s.breads}
                              </span>
                            ))}
                            {condo.riskCount > 0 && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  fontFamily: 'var(--font-body)',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 99,
                                  background: 'var(--color-gold-soft)',
                                  color: 'var(--color-accent)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <Icon name="alert" size={11} color="var(--color-accent)" stroke={2.2} />
                                {condo.riskCount} risco
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span
                              style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 18,
                                fontWeight: 800,
                                fontVariantNumeric: 'tabular-nums',
                                color: 'var(--color-text)',
                              }}
                            >
                              {condo.totalBreads} 🥖
                            </span>
                            {condo.projectedBreads > 0 && (
                              <span
                                style={{
                                  fontFamily: 'var(--font-body)',
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  color: 'var(--color-accent)',
                                }}
                              >
                                +{condo.projectedBreads} prev.
                              </span>
                            )}
                          </div>
                          <Icon name="chevR" size={18} color="var(--color-text-ter)" stroke={2.2} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {!isLoading && draftData && draftData.length > 0 && (
            generated?.generated ? (
              <Footer
                label=""
                totalLabel="Total necessário"
                totalValue={draftTotal}
                ctaLabel="Ver no histórico de compras"
                ctaIcon="check"
                onCta={() => setShowHistory(true)}
              />
            ) : (
              // Não gerado: Gerar direto (1 toque) + Ajustar antes (fluxo manual completo).
              <div
                style={{
                  position: 'sticky',
                  bottom: 0,
                  background: 'var(--color-app-bg)',
                  borderTop: '1px solid var(--color-border-2)',
                  padding: '12px 20px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 11 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-sec)' }}>
                    Total a pedir
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
                    {expectedTotal} pães
                  </span>
                </div>
                <button
                  onClick={() => void gerarDireto()}
                  disabled={isCreating || expectedTotal === 0}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: 16,
                    border: 'none',
                    background: 'var(--color-espresso)',
                    color: '#FAF5EC',
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: isCreating ? 'wait' : 'pointer',
                    opacity: isCreating || expectedTotal === 0 ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    minHeight: 44,
                  }}
                >
                  <Icon name="spark" size={18} color="#FAF5EC" stroke={2.1} />
                  Gerar direto{expectedTotal > 0 ? ` · ${expectedTotal} 🥖` : ''}
                </button>
                <button
                  onClick={goToStep1}
                  disabled={isLoadingSuppliers}
                  style={{
                    width: '100%',
                    marginTop: 9,
                    padding: '12px',
                    borderRadius: 16,
                    border: '1.5px solid var(--color-border)',
                    background: 'transparent',
                    color: 'var(--color-text-sec)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    minHeight: 44,
                  }}
                >
                  Ajustar antes de gerar (fluxo completo)
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Step 1 — Ajustar                                                      */}
      {/* -------------------------------------------------------------------- */}
      {step === 1 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, padding: '0 20px', overflowY: 'auto' }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13.5,
                color: 'var(--color-text-sec)',
                lineHeight: 1.5,
                marginBottom: 16,
                marginTop: 0,
              }}
            >
              Ajuste as quantidades antes de fechar — margem de segurança, arredondamento, etc.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(draftData ?? []).map((condo) => (
                <div
                  key={condo.condominiumId}
                  style={{
                    background: 'var(--color-surface)',
                    borderRadius: 16,
                    padding: 14,
                    border: '1px solid var(--color-border-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                        margin: '0 0 2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {condo.name}
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 11.5,
                        color: 'var(--color-text-ter)',
                        margin: 0,
                      }}
                    >
                      base {condo.totalBreads} pães
                    </p>
                  </div>
                  <StepperInline
                    value={adjustedQts[condo.condominiumId] ?? condo.totalBreads}
                    min={0}
                    max={400}
                    onChange={(v) =>
                      setAdjustedQts((prev) => ({ ...prev, [condo.condominiumId]: v }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <Footer
            label=""
            totalLabel="Total ajustado"
            totalValue={adjustedTotal}
            ctaLabel="Escolher fornecedores"
            onCta={goToStep2}
            isLoading={isLoadingSuppliers}
          />
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Step 2 — Dividir                                                      */}
      {/* -------------------------------------------------------------------- */}
      {step === 2 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, padding: '0 20px', overflowY: 'auto' }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13.5,
                color: 'var(--color-text-sec)',
                lineHeight: 1.5,
                marginBottom: 16,
                marginTop: 0,
              }}
            >
              Comece pelo fornecedor principal e divida o restante se quiser.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Card Fornecedor Principal */}
              {principal && (
                <div
                  style={{
                    background: 'var(--color-surface)',
                    borderRadius: 18,
                    border: '1px solid var(--color-border-2)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 14px 12px',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 11,
                        background: 'var(--color-surface-2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="factory" size={20} color="var(--color-accent)" stroke={2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 14.5,
                          fontWeight: 700,
                          color: 'var(--color-text)',
                          margin: '0 0 2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {principal.name}
                      </p>
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 12,
                          color: 'var(--color-text-ter)',
                          margin: 0,
                        }}
                      >
                        {formatCurrency(principal.pricePerUnit)}/pão
                      </p>
                    </div>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 99,
                        background: 'var(--color-gold-soft)',
                        color: '#8A6A00',
                        fontFamily: 'var(--font-body)',
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      Principal
                    </span>
                  </div>
                  {/* Body */}
                  <div
                    style={{
                      borderTop: '1px solid var(--color-border-2)',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <StepperInline
                      value={split.p}
                      min={0}
                      max={adjustedTotal}
                      onChange={(v) => setSplit({ p: v, r: reserva ? adjustedTotal - v : 0 })}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 16,
                        fontWeight: 800,
                        color: 'var(--color-text)',
                      }}
                    >
                      {formatCurrency(split.p * principal.pricePerUnit)}
                    </span>
                  </div>
                </div>
              )}

              {/* Card Fornecedor Reserva */}
              {reserva && (
                <div
                  style={{
                    background: 'var(--color-surface)',
                    borderRadius: 18,
                    border: '1px solid var(--color-border-2)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 14px 12px',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 11,
                        background: 'var(--color-surface-2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="factory" size={20} color="var(--color-text-sec)" stroke={2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 14.5,
                          fontWeight: 700,
                          color: 'var(--color-text)',
                          margin: '0 0 2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {reserva.name}
                      </p>
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 12,
                          color: 'var(--color-text-ter)',
                          margin: 0,
                        }}
                      >
                        {formatCurrency(reserva.pricePerUnit)}/pão
                      </p>
                    </div>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 99,
                        background: 'var(--color-surface-2)',
                        color: 'var(--color-text-sec)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      Reserva
                    </span>
                  </div>
                  {/* Body */}
                  <div
                    style={{
                      borderTop: '1px solid var(--color-border-2)',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <StepperInline
                      value={split.r}
                      min={0}
                      max={adjustedTotal}
                      onChange={(v) => setSplit({ p: adjustedTotal - v, r: v })}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 16,
                        fontWeight: 800,
                        color: 'var(--color-text)',
                      }}
                    >
                      {formatCurrency(split.r * reserva.pricePerUnit)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              position: 'sticky',
              bottom: 0,
              background: 'var(--color-app-bg)',
              borderTop: '1px solid var(--color-border-2)',
              padding: '12px 20px 16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: 'var(--color-text-sec)',
                }}
              >
                {splitTotal} pães
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-text)',
                }}
              >
                {formatCurrency(
                  split.p * (principal?.pricePerUnit ?? 0) +
                  split.r * (reserva?.pricePerUnit ?? 0)
                )}
              </span>
            </div>
            <button
              onClick={() => void finalizarPedido()}
              disabled={isCreating || (split.p === 0 && split.r === 0)}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 16,
                border: 'none',
                background: 'var(--color-espresso)',
                color: '#FAF5EC',
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                fontWeight: 700,
                cursor: isCreating ? 'wait' : 'pointer',
                opacity: isCreating || (split.p === 0 && split.r === 0) ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 44,
              }}
            >
              <Icon name="check" size={18} color="#FAF5EC" stroke={2.1} />
              Finalizar pedido
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Step 3 — Pronto                                                       */}
      {/* -------------------------------------------------------------------- */}
      {step === 3 && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
          {/* Ícone de sucesso */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '28%',
              background: 'var(--color-good-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '24px auto 14px',
            }}
          >
            <Icon name="check" size={36} color="var(--color-good)" stroke={2.6} />
          </div>

          {/* Título e subtítulo */}
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--color-text)',
              textAlign: 'center',
              margin: '0 0 6px',
            }}
          >
            Pedido gerado
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13.5,
              color: 'var(--color-text-sec)',
              textAlign: 'center',
              margin: '0 0 24px',
            }}
          >
            Salvo no histórico · {formatDate(new Date())}
          </p>

          {/* Card de resumo */}
          {principal && reserva && (
            <div
              style={{
                background: 'var(--color-surface)',
                borderRadius: 18,
                border: '1px solid var(--color-border-2)',
                padding: 16,
                marginBottom: 16,
              }}
            >
              {/* Linha fornecedor principal */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--color-border-2)',
                }}
              >
                <div>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      margin: 0,
                    }}
                  >
                    {principal.name}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      color: 'var(--color-text-ter)',
                      margin: 0,
                    }}
                  >
                    {split.p} pães × {formatCurrency(principal.pricePerUnit)}
                  </p>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                  }}
                >
                  {formatCurrency(split.p * principal.pricePerUnit)}
                </span>
              </div>

              {/* Linha fornecedor reserva */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 12,
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--color-border-2)',
                }}
              >
                <div>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      margin: 0,
                    }}
                  >
                    {reserva.name}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      color: 'var(--color-text-ter)',
                      margin: 0,
                    }}
                  >
                    {split.r} pães × {formatCurrency(reserva.pricePerUnit)}
                  </p>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                  }}
                >
                  {formatCurrency(split.r * reserva.pricePerUnit)}
                </span>
              </div>

              {/* Total */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 12,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--color-text-sec)',
                  }}
                >
                  Total do pedido
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 20,
                    fontWeight: 800,
                    color: 'var(--color-accent)',
                  }}
                >
                  {formatCurrency(
                    split.p * principal.pricePerUnit +
                    split.r * reserva.pricePerUnit
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Botões de download */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button
              onClick={() => void downloadFile('pdf')}
              disabled={isDownloading === 'pdf'}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 14,
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 700,
                cursor: isDownloading === 'pdf' ? 'wait' : 'pointer',
                opacity: isDownloading === 'pdf' ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 44,
              }}
            >
              <Icon name="download" size={17} color="var(--color-text)" stroke={2} />
              PDF
            </button>
            <button
              onClick={() => void downloadFile('excel')}
              disabled={isDownloading === 'excel'}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 14,
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 700,
                cursor: isDownloading === 'excel' ? 'wait' : 'pointer',
                opacity: isDownloading === 'excel' ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 44,
              }}
            >
              <Icon name="download" size={17} color="var(--color-text)" stroke={2} />
              Excel
            </button>
          </div>

          {/* Botão voltar ao início */}
          <button
            onClick={resetToStart}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 14,
              border: '1.5px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-sec)',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            Voltar ao início
          </button>
        </div>
      )}

      {/* CSS para spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
