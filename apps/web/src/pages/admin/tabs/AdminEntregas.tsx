import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { AdminHead } from '../../../components/admin/AdminHead'
import { SegmentedControl } from '../../../components/admin/SegmentedControl'
import { ProgressBar } from '../../../components/admin/ProgressBar'
import {
  DeliveryDivisionCard,
  type Assignment,
  type CondoItem,
} from '../../../components/admin/DeliveryDivisionCard'
import { Icon } from '../../../components/brand/Icon'
import { OrderDetailSheet, STATUS_META, type LedgerRow } from '../../../components/admin/OrderDetailSheet'
import { resolveDefaultSlot, nowMinutesLocal, slotTabLabel, type SlotOption } from '../../../lib/slots'

type Segment = 'hoje' | 'historico'

interface DivisionSuggestionItem {
  courierId: string
  courierName: string
  condominiums: CondoItem[]
  total: number
}

interface DeliveryStatus {
  condominiumId: string
  condominiumName: string
  scheduled: number
  delivered: number
  orderIds: string[]
}

const TABS: Array<{ key: Segment; label: string }> = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'historico', label: 'Histórico' },
]

// Filtros de status do histórico
type HistFilter = 'todos' | 'DELIVERED' | 'NOT_DELIVERED' | 'CANCELLED' | 'parados'
const HIST_FILTERS: Array<{ key: HistFilter; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'DELIVERED', label: 'Entregue' },
  { key: 'NOT_DELIVERED', label: 'Não entregue' },
  { key: 'CANCELLED', label: 'Cancelado' },
  { key: 'parados', label: 'Parados' },
]

function matchSearch(r: LedgerRow, q: string) {
  return r.clientName.toLowerCase().includes(q) || r.apartment.toLowerCase().includes(q)
}

function formatDateLong(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch {
    return dateStr
  }
}

function formatDateShort() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

export function AdminEntregas() {
  const [segment, setSegment] = useState<Segment>('hoje')

  // Turno (pipeline por slot)
  const [slots, setSlots] = useState<SlotOption[]>([])
  const [slotId, setSlotId] = useState<string>('')

  // Hoje
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus[]>([])
  const [isLoadingHoje, setIsLoadingHoje] = useState(true)
  const [isApproved, setIsApproved] = useState(false)
  const [isApproving, setIsApproving] = useState(false)

  // Próximos / Histórico (ledger)
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [isLoadingLedger, setIsLoadingLedger] = useState(false)
  const [histFilter, setHistFilter] = useState<HistFilter>('todos')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<LedgerRow | null>(null)

  // Carrega os turnos e define o padrão (automático pelo horário de corte)
  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch('/admin/settings/slots')
        if (res.ok) {
          const data = (await res.json()) as { slots: SlotOption[] }
          setSlots(data.slots)
          if (data.slots.length > 0) setSlotId(resolveDefaultSlot(data.slots, nowMinutesLocal()))
        }
      } catch {
        /* silencioso */
      }
    })()
  }, [])

  useEffect(() => {
    if (segment === 'hoje') void fetchHojeData()
    else void fetchHistorico()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, slotId])

  // Progresso em (quase) tempo real: depois de aprovada a divisão, atualiza
  // "agendadas vs realizadas" sozinho (polling + ao voltar o foco) conforme o
  // entregador confirma. Só roda quando aprovado — antes disso não há o que
  // acompanhar e evitamos sobrescrever ajustes manuais da divisão.
  useEffect(() => {
    if (segment !== 'hoje' || !isApproved) return
    const tick = () => void fetchHojeData({ silent: true })
    const id = setInterval(tick, 20000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, slotId, isApproved])

  // Refetch do histórico ao mudar filtro/busca (com debounce simples na busca)
  useEffect(() => {
    if (segment !== 'historico') return
    const t = setTimeout(() => void fetchHistorico(), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histFilter, search])

  // `silent` evita piscar o spinner em refreshes de fundo (polling/foco).
  async function fetchHojeData(opts?: { silent?: boolean }) {
    if (!opts?.silent) setIsLoadingHoje(true)
    try {
      const qs = slotId ? `?slotId=${slotId}` : ''
      const divRes = await apiFetch(`/admin/orders/division-suggestion${qs}`)
      if (divRes.ok) {
        const divData = (await divRes.json()) as { approved: boolean; assignments: DivisionSuggestionItem[] }
        const items = divData.assignments ?? []
        setAssignments(items.map((i) => ({ courierId: i.courierId, courierName: i.courierName, condos: i.condominiums ?? [] })))
        // A aprovação é derivada do servidor → o badge sobrevive a reload/saída de tela.
        setIsApproved(Boolean(divData.approved))
      }
      const statusRes = await apiFetch(`/admin/orders/delivery-status${qs}`)
      if (statusRes.ok) setDeliveryStatus((await statusRes.json()) as DeliveryStatus[])
    } catch {
      /* silencioso */
    } finally {
      if (!opts?.silent) setIsLoadingHoje(false)
    }
  }

  async function fetchHistorico() {
    setIsLoadingLedger(true)
    try {
      if (histFilter === 'parados') {
        const res = await apiFetch('/admin/orders/stuck')
        if (res.ok) {
          const data = (await res.json()) as { rows: LedgerRow[] }
          const q = search.trim().toLowerCase()
          setRows(q ? data.rows.filter((r) => matchSearch(r, q)) : data.rows)
        }
        return
      }
      const status = histFilter === 'todos' ? 'DELIVERED,NOT_DELIVERED,CANCELLED' : histFilter
      const params: Record<string, string> = { status, limit: '100' }
      if (search.trim()) params.q = search.trim()
      const res = await apiFetch(`/admin/orders?${new URLSearchParams(params).toString()}`)
      if (res.ok) {
        const data = (await res.json()) as { rows: LedgerRow[] }
        setRows(data.rows)
      }
    } catch {
      /* silencioso */
    } finally {
      setIsLoadingLedger(false)
    }
  }

  async function handleApprove() {
    setIsApproving(true)
    try {
      // Monta os grupos entregador → pedidos a partir da divisão atual (já com eventuais
      // ajustes manuais via drag-and-drop). O backend despacha SEPARATED → OUT_FOR_DELIVERY.
      const payload = assignments
        .filter((a) => a.condos.length > 0)
        .map((a) => {
          const condoIds = a.condos.map((c) => c.condominiumId)
          const orderIds = deliveryStatus
            .filter((ds) => condoIds.includes(ds.condominiumId))
            .flatMap((ds) => ds.orderIds)
          return { courierId: a.courierId, orderIds }
        })
        .filter((g) => g.orderIds.length > 0)
      if (payload.length === 0) return
      const res = await apiFetch('/admin/orders/approve-division', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: slotId || undefined, assignments: payload }),
      })
      if (!res.ok) throw new Error('falha')
      // Recarrega para refletir o estado persistido (approved=true + divisão real).
      await fetchHojeData({ silent: true })
    } finally {
      setIsApproving(false)
    }
  }

  // Recarrega a aba atual após uma ação no detalhe (não entregue / estorno)
  const refreshCurrent = useCallback(() => {
    void fetchHistorico()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histFilter, search])

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
      <AdminHead sub={`Controle do dia · ${formatDateShort()}`} titulo="Entregas" />

      <div style={{ padding: '0 20px' }}>
        <div style={{ marginBottom: 16 }}>
          <SegmentedControl<Segment> tabs={TABS} value={segment} onChange={setSegment} />
        </div>

        {/* Seletor de turno — pipeline por turno (só na operação do dia) */}
        {segment === 'hoje' && slots.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <SegmentedControl<string>
              tabs={slots.map((s) => ({ key: s.slotId, label: slotTabLabel(s) }))}
              value={slotId}
              onChange={setSlotId}
            />
          </div>
        )}

        {segment === 'hoje' && <HojeView {...{ isLoadingHoje, assignments, setAssignments, handleApprove, isApproved, isApproving, deliveryStatus }} />}
        {segment === 'historico' && (
          <>
            <SearchInput value={search} onChange={setSearch} />
            <FilterChips value={histFilter} onChange={setHistFilter} />
            <LedgerView
              rows={rows}
              loading={isLoadingLedger}
              emptyText={histFilter === 'parados' ? 'Nenhum pedido parado 🎉' : 'Nenhum pedido encontrado.'}
              onSelect={setSelected}
            />
          </>
        )}
      </div>

      {selected && (
        <OrderDetailSheet
          row={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null)
            refreshCurrent()
          }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Hoje ───────────────────────────────────────────────────────────────────────
function HojeView({
  isLoadingHoje,
  assignments,
  setAssignments,
  handleApprove,
  isApproved,
  isApproving,
  deliveryStatus,
}: {
  isLoadingHoje: boolean
  assignments: Assignment[]
  setAssignments: (a: Assignment[]) => void
  handleApprove: () => Promise<void>
  isApproved: boolean
  isApproving: boolean
  deliveryStatus: DeliveryStatus[]
}) {
  if (isLoadingHoje) return <Centered><Spinner /></Centered>

  if (assignments.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
          Aguardando a separação
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)', margin: 0, lineHeight: 1.5 }}>
          A divisão entre entregadores fica disponível após os pedidos serem separados e concluídos na aba Separação.
        </p>
      </div>
    )
  }

  // Condomínios totalmente entregues — travados ao reabrir a divisão.
  const lockedCondoIds = new Set(
    deliveryStatus.filter((d) => d.scheduled > 0 && d.delivered >= d.scheduled).map((d) => d.condominiumId),
  )

  return (
    <>
      <DeliveryDivisionCard
        assignments={assignments}
        onAssignmentsChange={setAssignments}
        onApprove={handleApprove}
        isApproved={isApproved}
        isApproving={isApproving}
        lockedCondoIds={lockedCondoIds}
      />
      {deliveryStatus.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', letterSpacing: '0.04em', margin: '0 0 10px' }}>
            AGENDADAS VS REALIZADAS
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {deliveryStatus.map((item) => {
              const isComplete = item.delivered >= item.scheduled && item.scheduled > 0
              return (
                <div key={item.condominiumId} style={{ background: 'var(--color-surface)', borderRadius: 18, padding: 15, border: '1px solid var(--color-border-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>{item.condominiumName}</span>
                    {isComplete ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99, background: 'var(--color-good-soft)', color: 'var(--color-good)', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700 }}>
                        <Icon name="check" size={13} color="var(--color-good)" stroke={2.6} aria-hidden="true" /> Completo
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 99, background: 'var(--color-gold-soft)', color: '#8A6A00', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700 }}>
                        {item.delivered}/{item.scheduled}
                      </span>
                    )}
                  </div>
                  <ProgressBar value={item.delivered} max={item.scheduled} color={isComplete ? 'var(--color-good)' : 'var(--color-gold)'} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

// ── Ledger (Próximos / Histórico) ───────────────────────────────────────────────

// Botão de um pedido na lista. `showDate=false` quando a data já está no cabeçalho do grupo.
function LedgerRowButton({ r, showDate = true, onSelect }: { r: LedgerRow; showDate?: boolean; onSelect: (r: LedgerRow) => void }) {
  const meta = STATUS_META[r.status] ?? { label: r.status, color: 'var(--color-text-ter)', soft: 'var(--color-surface-2)' }
  return (
    <button
      onClick={() => onSelect(r)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--color-surface)',
        borderRadius: 16,
        padding: 13,
        border: '1px solid var(--color-border-2)',
        textAlign: 'left',
        width: '100%',
        cursor: 'pointer',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {r.clientName}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
          {r.condominiumName} · {r.block ? `Bl ${r.block} ` : ''}Apto {r.apartment || '—'}{showDate ? ` · ${formatDateLong(r.scheduledDate)}` : ''}
        </p>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
        {r.quantity}
        <span style={{ fontSize: 13 }}>🥖</span>
      </span>
      <span style={{ padding: '3px 8px', borderRadius: 99, background: meta.soft, color: meta.color, fontFamily: 'var(--font-body)', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
        {meta.label}
      </span>
    </button>
  )
}

function LedgerView({ rows, loading, emptyText, onSelect }: { rows: LedgerRow[]; loading: boolean; emptyText: string; onSelect: (r: LedgerRow) => void }) {
  if (loading) return <Centered><Spinner /></Centered>
  if (rows.length === 0) {
    return <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)', textAlign: 'center', padding: '40px 0' }}>{emptyText}</p>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <LedgerRowButton key={r.orderId} r={r} onSelect={onSelect} />
      ))}
    </div>
  )
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <Icon name="user" size={16} color="var(--color-text-ter)" stroke={2} />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar por cliente ou apartamento"
        style={{
          width: '100%',
          minHeight: 42,
          borderRadius: 12,
          border: '1px solid var(--color-border-2)',
          background: 'var(--color-surface)',
          padding: '0 12px 0 36px',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--color-text)',
        }}
      />
    </div>
  )
}

function FilterChips({ value, onChange }: { value: HistFilter; onChange: (v: HistFilter) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 4 }}>
      {HIST_FILTERS.map((f) => {
        const active = value === f.key
        return (
          <button
            key={f.key}
            onClick={() => onChange(f.key)}
            style={{
              flexShrink: 0,
              padding: '6px 13px',
              borderRadius: 999,
              border: active ? 'none' : '1.5px solid var(--color-border)',
              background: active ? 'var(--color-espresso)' : 'none',
              color: active ? '#fff' : 'var(--color-text)',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>{children}</div>
}
function Spinner() {
  return <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', animation: 'spin 0.8s linear infinite' }} />
}
