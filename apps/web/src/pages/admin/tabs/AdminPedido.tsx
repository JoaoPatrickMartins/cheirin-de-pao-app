import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { AdminHead } from '../../../components/admin/AdminHead'
import { StepBar } from '../../../components/admin/StepBar'
import { Icon } from '../../../components/brand/Icon'
import StepperInline from '../../../components/client/StepperInline'
import { CondominiumOrderDetail } from '../../../components/admin/CondominiumOrderDetail'
import { SupplierOrderHistory } from '../../../components/admin/SupplierOrderHistory'

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
  time: string
  cutoffTime: string
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

/** Minutos desde a meia-noite BRT (agora). */
function brtNowMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(new Date())
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

function hhmmToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * Próximo corte do dia: o slot com cutoffTime mais cedo ainda à frente do horário atual (BRT).
 * Retorna o tempo restante formatado e o label do slot — ou status encerrado se todos passaram.
 */
function nextCutoff(slots: SlotCutoff[] | null): { open: boolean; label?: string; remaining?: string } {
  if (!slots || slots.length === 0) return { open: true }
  const now = brtNowMinutes()
  const upcoming = slots
    .map((s) => ({ label: s.label, min: hhmmToMin(s.cutoffTime) }))
    .filter((s) => s.min > now)
    .sort((a, b) => a.min - b.min)
  if (upcoming.length === 0) return { open: false }
  const diff = upcoming[0].min - now
  const h = Math.floor(diff / 60)
  const m = diff % 60
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
          background: 'var(--color-accent)',
          color: '#fff',
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
        {ctaIcon && <Icon name={ctaIcon} size={18} color="#fff" stroke={2.1} />}
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

export function AdminPedido() {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [showHistory, setShowHistory] = useState(false)
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [draftRes, slotsRes, statusRes] = await Promise.all([
          apiFetch('/admin/supplier-orders/draft'),
          apiFetch('/admin/settings/slots'),
          apiFetch('/admin/supplier-orders/generated-status'),
        ])
        if (draftRes.ok) {
          setDraftData((await draftRes.json()) as CondoDraft[])
        }
        if (slotsRes.ok) {
          const data = (await slotsRes.json()) as { slots: SlotCutoff[] }
          setSlots(data.slots)
        }
        if (statusRes.ok) {
          setGenerated((await statusRes.json()) as { generated: boolean; orderId: string; totalQuantity: number })
        }
      } catch {
        // falha silenciosa
      } finally {
        setIsLoading(false)
      }
    }
    void fetchData()
  }, [])

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
        body: JSON.stringify({ items }),
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

  // Drill-down em tela cheia — detalhamento por cliente do condomínio selecionado
  if (detailCondoId) {
    return (
      <CondominiumOrderDetail condominiumId={detailCondoId} onBack={() => setDetailCondoId(null)} />
    )
  }

  // Histórico de compras (pedidos ao fornecedor finalizados) — tela cheia
  if (showHistory) {
    return <SupplierOrderHistory onBack={() => setShowHistory(false)} />
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <AdminHead
        sub={`Para amanhã · ${tomorrowLabel}`}
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
                {/* Selo: pedido de amanhã já gerado */}
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
                        Pedido de amanhã já gerado{generated.totalQuantity ? ` · ${generated.totalQuantity} pães` : ''}
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

                {/* Resumo (KPIs + split de turno + risco) + busca */}
                {draftData && draftData.length > 0 && (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 9,
                        marginBottom: 14,
                      }}
                    >
                      {[
                        { v: summary.confirmed, k: 'confirmados', c: 'var(--color-text)' },
                        { v: summary.projected, k: 'previstos', c: 'var(--color-accent)' },
                        { v: summary.deliveries, k: 'entregas', c: 'var(--color-text)' },
                      ].map((kpi) => (
                        <div
                          key={kpi.k}
                          style={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-2)',
                            borderRadius: 14,
                            padding: '11px 12px',
                          }}
                        >
                          <div
                            style={{
                              fontFamily: 'var(--font-display)',
                              fontSize: 20,
                              fontWeight: 800,
                              letterSpacing: '-0.02em',
                              fontVariantNumeric: 'tabular-nums',
                              lineHeight: 1,
                              color: kpi.c,
                            }}
                          >
                            {kpi.v}
                          </div>
                          <div
                            style={{
                              fontFamily: 'var(--font-body)',
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: 'var(--color-text-ter)',
                              marginTop: 3,
                            }}
                          >
                            {kpi.k}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Barra de split por turno */}
                    {summary.slotTotal > 0 && (
                      <>
                        <div
                          style={{
                            display: 'flex',
                            height: 8,
                            borderRadius: 9,
                            overflow: 'hidden',
                            margin: '0 2px 8px',
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
                        <div
                          style={{
                            display: 'flex',
                            gap: 16,
                            justifyContent: 'center',
                            flexWrap: 'wrap',
                            margin: '0 0 14px',
                            fontFamily: 'var(--font-body)',
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--color-text-sec)',
                          }}
                        >
                          {summary.slotList.map((s) => (
                            <span key={s.slotId}>
                              <i
                                style={{
                                  display: 'inline-block',
                                  width: 9,
                                  height: 9,
                                  borderRadius: 3,
                                  background: slotColor(s.slotId),
                                  marginRight: 5,
                                  verticalAlign: -1,
                                }}
                              />
                              {s.label} {s.breads}
                            </span>
                          ))}
                          {summary.risk > 0 && (
                            <span style={{ color: 'var(--color-accent)' }}>
                              <i
                                style={{
                                  display: 'inline-block',
                                  width: 9,
                                  height: 9,
                                  borderRadius: 3,
                                  background: 'var(--color-accent)',
                                  marginRight: 5,
                                  verticalAlign: -1,
                                }}
                              />
                              {summary.risk} em risco
                            </span>
                          )}
                        </div>
                      </>
                    )}

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
                              {condo.totalBreads}
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
            <Footer
              label=""
              totalLabel="Total necessário"
              totalValue={draftTotal}
              ctaLabel={generated?.generated ? 'Ver no histórico de compras' : 'Encerrar corte e gerar pedido'}
              ctaIcon={generated?.generated ? 'check' : 'scissors'}
              onCta={generated?.generated ? () => setShowHistory(true) : goToStep1}
            />
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
                background: 'var(--color-accent)',
                color: '#fff',
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
              <Icon name="check" size={18} color="#fff" stroke={2.1} />
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
