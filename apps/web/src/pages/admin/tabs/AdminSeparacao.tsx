import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { AdminHead } from '../../../components/admin/AdminHead'
import { ProgressBar } from '../../../components/admin/ProgressBar'
import { SegmentedControl } from '../../../components/admin/SegmentedControl'
import { Icon } from '../../../components/brand/Icon'
import { SeparationCouponSheet, type CouponData } from '../../../components/admin/SeparationCoupon'
import { resolveDefaultSlot, nowMinutesLocal, slotTabLabel, type SlotOption } from '../../../lib/slots'

type DateMode = 'hoje' | 'amanha'

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Tipos (espelham GET /admin/separation/board) ──────────────────────────────
interface BoardOrder {
  orderId: string
  userId: string
  name: string
  block: string
  apartment: string
  quantity: number
  slotId: string
  slotLabel: string
  type: string
  status: string
  separated: boolean
}
interface BoardSlot {
  slotId: string
  slotLabel: string
  totalDeliveries: number
  separatedDeliveries: number
  totalBreads: number
  separatedBreads: number
  concluded: boolean
  orders: BoardOrder[]
}
interface BoardCondo {
  condominiumId: string
  name: string
  totalDeliveries: number
  separatedDeliveries: number
  totalBreads: number
  separatedBreads: number
  slots: BoardSlot[]
}
interface Board {
  date: string
  totalDeliveries: number
  separatedDeliveries: number
  totalBreads: number
  separatedBreads: number
  condominiums: BoardCondo[]
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

const shortCode = (orderId: string) => orderId.slice(-4).toUpperCase()

const countSep = (orders: BoardOrder[]) => orders.filter((o) => o.separated).length

// Rótulo dos filtros (Dia / Turno) — largura fixa pra alinhar os controles à direita.
const FILTER_LABEL_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  width: 64,
  flexShrink: 0,
  fontFamily: 'var(--font-body)',
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--color-text-sec)',
}

export function AdminSeparacao() {
  const [board, setBoard] = useState<Board | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [coupons, setCoupons] = useState<CouponData[]>([])
  const [dateMode, setDateMode] = useState<DateMode>('hoje')
  const [slots, setSlots] = useState<SlotOption[]>([])
  const [slotId, setSlotId] = useState<string>('')

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

  const fetchBoard = useCallback(async () => {
    setIsLoading(true)
    try {
      const d = new Date()
      if (dateMode === 'amanha') d.setDate(d.getDate() + 1)
      const slotQs = slotId ? `&slotId=${slotId}` : ''
      const res = await apiFetch(`/admin/separation/board?date=${localDateStr(d)}${slotQs}`)
      if (res.ok) setBoard((await res.json()) as Board)
    } catch {
      // falha silenciosa — mantém estado anterior
    } finally {
      setIsLoading(false)
    }
  }, [dateMode, slotId])

  useEffect(() => {
    void fetchBoard()
  }, [fetchBoard])

  // Dispara a impressão quando há cupons na fila; limpa ao terminar.
  useEffect(() => {
    if (coupons.length === 0) return
    const t = setTimeout(() => window.print(), 60)
    const clear = () => setCoupons([])
    window.addEventListener('afterprint', clear)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', clear)
    }
  }, [coupons])

  const dateLabel = board ? formatDateLabel(board.date) : ''
  const turnoLabel = slots.find((s) => s.slotId === slotId)?.label ?? ''
  const dayLabel = dateMode === 'hoje' ? 'hoje' : 'amanhã'

  function toCoupons(orders: BoardOrder[], condoName: string): CouponData[] {
    return orders.map((o) => ({
      orderId: o.orderId,
      code: shortCode(o.orderId),
      clientName: o.name,
      condominiumName: condoName,
      block: o.block,
      apartment: o.apartment,
      quantity: o.quantity,
      slotLabel: o.slotLabel,
      dateLabel,
    }))
  }

  // Toggle otimista de um pedido
  async function toggleOrder(condoId: string, slotId: string, order: BoardOrder) {
    const next = !order.separated
    setBoard((prev) => patchOrder(prev, condoId, slotId, order.orderId, next))
    try {
      const res = await apiFetch(`/admin/separation/orders/${order.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ separated: next }),
      })
      if (!res.ok) throw new Error('falha')
    } catch {
      // reverte em caso de erro
      setBoard((prev) => patchOrder(prev, condoId, slotId, order.orderId, order.separated))
    }
  }

  async function concludeSlot(condoId: string, slotId: string) {
    if (!board) return
    setBusyKey(`${condoId}:${slotId}`)
    try {
      const res = await apiFetch('/admin/separation/conclude', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condominiumId: condoId, slotId, date: board.date }),
      })
      if (res.ok) await fetchBoard()
    } finally {
      setBusyKey(null)
    }
  }

  async function concludeCondo(condo: BoardCondo) {
    if (!board) return
    setBusyKey(`condo:${condo.condominiumId}`)
    try {
      for (const slot of condo.slots) {
        if (slot.concluded) continue
        await apiFetch('/admin/separation/conclude', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ condominiumId: condo.condominiumId, slotId: slot.slotId, date: board.date }),
        })
      }
      await fetchBoard()
    } finally {
      setBusyKey(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const isEmpty = !board || board.condominiums.length === 0

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
      <AdminHead
        sub={`Recebimento e conferência · ${dateLabel || (dateMode === 'hoje' ? 'Hoje' : 'Amanhã')}`}
        titulo="Separação"
      />

      <div style={{ padding: '0 20px' }}>
        {/* Filtros rotulados — o rótulo (ícone + nome) deixa claro o que cada controle faz */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={FILTER_LABEL_STYLE}>
              <Icon name="calendar" size={15} stroke={2} color="var(--color-text-ter)" aria-hidden="true" />
              Dia
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SegmentedControl<DateMode>
                tabs={[
                  { key: 'hoje', label: 'Hoje' },
                  { key: 'amanha', label: 'Amanhã' },
                ]}
                value={dateMode}
                onChange={setDateMode}
              />
            </div>
          </div>

          {slots.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={FILTER_LABEL_STYLE}>
                <Icon name="clock" size={15} stroke={2} color="var(--color-text-ter)" aria-hidden="true" />
                Turno
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SegmentedControl<string>
                  tabs={slots.map((s) => ({ key: s.slotId, label: slotTabLabel(s) }))}
                  value={slotId}
                  onChange={setSlotId}
                />
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <Spinner />
          </div>
        ) : isEmpty ? (
          <div style={{ textAlign: 'center', padding: '52px 24px' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: 'var(--color-surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Icon name="list" size={30} color="var(--color-text-ter)" stroke={1.8} />
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
              Nada para separar
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)', margin: '0 auto', lineHeight: 1.5, maxWidth: 290 }}>
              {turnoLabel
                ? `Nenhum pedido da ${turnoLabel} para ${dayLabel}. Eles aparecem aqui após o corte da ${turnoLabel}.`
                : `Nenhum pedido para ${dayLabel}. Os pedidos aparecem após o corte materializar as entregas.`}
            </p>
          </div>
        ) : (
          <>
            {/* Resumo do dia */}
            <SummaryCard board={board!} />

            {board!.condominiums.map((condo) => {
              const condoSep = condo.slots.reduce((n, s) => n + countSep(s.orders), 0)
              const condoTotal = condo.slots.reduce((n, s) => n + s.orders.length, 0)
              const allOrders = condo.slots.flatMap((s) => s.orders)
              const busyCondo = busyKey === `condo:${condo.condominiumId}`
              const fullyConcluded = condoSep === condoTotal && condoTotal > 0

              return (
                <div
                  key={condo.condominiumId}
                  style={{
                    background: 'var(--color-surface)',
                    borderRadius: 18,
                    border: '1px solid var(--color-border-2)',
                    padding: 15,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 15.5, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                        {condo.name}
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
                        {condoSep}/{condoTotal} separados · {condo.totalBreads} pães
                      </p>
                    </div>
                    <PrintButton
                      label="Imprimir"
                      onClick={() => setCoupons(toCoupons(allOrders, condo.name))}
                    />
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {condo.slots.map((slot) => {
                      const sep = countSep(slot.orders)
                      const total = slot.orders.length
                      const concluded = sep === total && total > 0
                      const busySlot = busyKey === `${condo.condominiumId}:${slot.slotId}`
                      return (
                        <div key={slot.slotId || 'none'}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text-sec)' }}>
                              <Icon name="clock" size={14} stroke={2} color="var(--color-text-ter)" />
                              {slot.slotLabel} · {sep}/{total}
                            </span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <PrintButton label="Cupons" small onClick={() => setCoupons(toCoupons(slot.orders, condo.name))} />
                              <button
                                onClick={() => concludeSlot(condo.condominiumId, slot.slotId)}
                                disabled={concluded || busySlot}
                                style={concludeBtnStyle(concluded)}
                              >
                                {concluded ? (
                                  <>
                                    <Icon name="check" size={13} stroke={2.6} color="var(--color-good)" /> Concluído
                                  </>
                                ) : busySlot ? (
                                  '...'
                                ) : (
                                  'Concluir'
                                )}
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {slot.orders.map((order) => (
                              <OrderRow
                                key={order.orderId}
                                order={order}
                                onToggle={() => toggleOrder(condo.condominiumId, slot.slotId, order)}
                                onPrint={() => setCoupons(toCoupons([order], condo.name))}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Concluir condomínio inteiro */}
                  <button
                    onClick={() => concludeCondo(condo)}
                    disabled={fullyConcluded || busyCondo}
                    style={{
                      marginTop: 14,
                      width: '100%',
                      minHeight: 42,
                      borderRadius: 999,
                      border: 'none',
                      background: fullyConcluded ? 'var(--color-good-soft)' : 'var(--color-espresso)',
                      color: fullyConcluded ? 'var(--color-good)' : '#fff',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: fullyConcluded ? 'default' : 'pointer',
                      opacity: busyCondo ? 0.7 : 1,
                    }}
                  >
                    {fullyConcluded ? 'Condomínio separado ✓' : busyCondo ? 'Concluindo...' : 'Concluir condomínio'}
                  </button>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Folha de cupons (oculta na tela; impressa via window.print) */}
      <SeparationCouponSheet coupons={coupons} />

      <style>{spinKeyframes}</style>
    </div>
  )
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function SummaryCard({ board }: { board: Board }) {
  const sep = board.condominiums.reduce((n, c) => n + c.slots.reduce((m, s) => m + countSep(s.orders), 0), 0)
  const total = board.condominiums.reduce((n, c) => n + c.slots.reduce((m, s) => m + s.orders.length, 0), 0)
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 18,
        border: '1px solid var(--color-border-2)',
        padding: 16,
        marginBottom: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text-sec)' }}>
          Progresso da separação
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>
          {sep}/{total}
        </span>
      </div>
      <ProgressBar value={sep} max={total} color={sep === total && total > 0 ? 'var(--color-good)' : 'var(--color-gold)'} />
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '10px 0 0' }}>
        {board.totalBreads} pães · {total} entregas em {board.condominiums.length} condomínio(s)
      </p>
    </div>
  )
}

function OrderRow({ order, onToggle, onPrint }: { order: BoardOrder; onToggle: () => void; onPrint: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 12,
        background: order.separated ? 'var(--color-good-soft)' : 'var(--color-surface-2)',
      }}
    >
      <button
        onClick={onToggle}
        aria-label={order.separated ? 'Desmarcar separado' : 'Marcar separado'}
        aria-pressed={order.separated}
        style={{
          width: 26,
          height: 26,
          flexShrink: 0,
          borderRadius: 8,
          border: order.separated ? 'none' : '1.5px solid var(--color-border)',
          background: order.separated ? 'var(--color-good)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {order.separated && <Icon name="check" size={15} stroke={3} color="#fff" />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {order.name}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
          {order.block ? `Bloco ${order.block} · ` : ''}Apto {order.apartment || '—'}
        </p>
      </div>

      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          fontWeight: 800,
          color: 'var(--color-text)',
          minWidth: 22,
          textAlign: 'right',
        }}
      >
        {order.quantity}
      </span>

      <button
        onClick={onPrint}
        aria-label="Imprimir cupom"
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 8,
          border: 'none',
          background: 'var(--color-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Icon name="doc" size={16} stroke={2} color="var(--color-text-sec)" />
      </button>
    </div>
  )
}

function PrintButton({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: small ? '5px 10px' : '7px 12px',
        borderRadius: 999,
        border: '1.5px solid var(--color-border)',
        background: 'none',
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: small ? 12 : 13,
        color: 'var(--color-text)',
        cursor: 'pointer',
      }}
    >
      <Icon name="doc" size={small ? 13 : 15} stroke={2} color="var(--color-text-sec)" />
      {label}
    </button>
  )
}

function concludeBtnStyle(concluded: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 12px',
    borderRadius: 999,
    border: 'none',
    background: concluded ? 'var(--color-good-soft)' : 'var(--color-gold-soft)',
    color: concluded ? 'var(--color-good)' : '#8A6A00',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 12,
    cursor: concluded ? 'default' : 'pointer',
  }
}

function Spinner() {
  return (
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
  )
}

const spinKeyframes = `@keyframes spin { to { transform: rotate(360deg); } }`

// ── Helpers de estado imutável ────────────────────────────────────────────────
function patchOrder(board: Board | null, condoId: string, slotId: string, orderId: string, separated: boolean): Board | null {
  if (!board) return board
  return {
    ...board,
    condominiums: board.condominiums.map((c) =>
      c.condominiumId !== condoId
        ? c
        : {
            ...c,
            slots: c.slots.map((s) =>
              s.slotId !== slotId
                ? s
                : {
                    ...s,
                    orders: s.orders.map((o) =>
                      o.orderId !== orderId ? o : { ...o, separated, status: separated ? 'SEPARATED' : 'SCHEDULED' },
                    ),
                  },
            ),
          },
    ),
  }
}
