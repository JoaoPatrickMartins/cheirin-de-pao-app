import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { AdminHead } from '../../../components/admin/AdminHead'
import { ProgressBar } from '../../../components/admin/ProgressBar'
import { SegmentedControl } from '../../../components/admin/SegmentedControl'
import { Icon } from '../../../components/brand/Icon'
import { SeparationCouponSheet, type CouponData } from '../../../components/admin/SeparationCoupon'
import { resolveDefaultSlot, nowMinutesLocal, slotTabLabel, type SlotOption } from '../../../lib/slots'

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Tipos (espelham GET /admin/separation/board) ──────────────────────────────
interface MarketItem {
  name: string
  qty: number
}
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
  // Mini market ("Além do Pãozin") — presente em parada combinada ou só-market.
  marketOrderId?: string
  marketItems: MarketItem[]
  marketItemCount: number
}
interface BoardSlot {
  slotId: string
  slotLabel: string
  totalDeliveries: number
  separatedDeliveries: number
  totalBreads: number
  separatedBreads: number
  totalItems: number
  separatedItems: number
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
  totalItems: number
  separatedItems: number
  slots: BoardSlot[]
}
interface Board {
  date: string
  totalDeliveries: number
  separatedDeliveries: number
  totalBreads: number
  separatedBreads: number
  totalItems: number
  separatedItems: number
  condominiums: BoardCondo[]
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

const shortCode = (orderId: string) => orderId.slice(-4).toUpperCase()

const countSep = (orders: BoardOrder[]) => orders.filter((o) => o.separated).length

/** Rótulo do bloco sem duplicar "Bloco" (o valor já pode contê-la). */
function blockLabel(block: string): string {
  const b = (block || '').trim()
  if (!b || b === '—') return ''
  return /^bloco\b/i.test(b) ? b : `Bloco ${b}`
}

/**
 * Agrupa os pedidos de um turno por bloco, preservando a ordem já recebida (o backend
 * ordena por bloco → apartamento → nome). Pedidos sem bloco caem num grupo block === ''.
 */
function groupByBlock(orders: BoardOrder[]): Array<{ block: string; orders: BoardOrder[] }> {
  const groups: Array<{ block: string; orders: BoardOrder[] }> = []
  for (const o of orders) {
    const b = (o.block || '').trim()
    const last = groups[groups.length - 1]
    if (last && last.block === b) last.orders.push(o)
    else groups.push({ block: b, orders: [o] })
  }
  return groups
}

export function AdminSeparacao() {
  const [board, setBoard] = useState<Board | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [coupons, setCoupons] = useState<CouponData[]>([])
  const [slots, setSlots] = useState<SlotOption[]>([])
  const [slotId, setSlotId] = useState<string>('')
  // Só busca o quadro depois que os turnos carregaram: assim o fetch já sai com o
  // slotId correto, em vez de uma primeira chamada sem filtro (que traz todos os turnos).
  const [slotsReady, setSlotsReady] = useState(false)
  // Sequência de requisições: só aplicamos a resposta da busca mais recente, evitando
  // que uma chamada antiga (sem filtro) resolva depois e sobrescreva o turno selecionado.
  const reqSeq = useRef(0)

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
      } finally {
        setSlotsReady(true)
      }
    })()
  }, [])

  const fetchBoard = useCallback(async () => {
    const seq = ++reqSeq.current
    setIsLoading(true)
    try {
      // Separação acontece sempre no dia da entrega — só hoje.
      const slotQs = slotId ? `&slotId=${slotId}` : ''
      const res = await apiFetch(`/admin/separation/board?date=${localDateStr(new Date())}${slotQs}`)
      // Ignora respostas obsoletas: só a busca mais recente pode atualizar o estado.
      if (res.ok && seq === reqSeq.current) setBoard((await res.json()) as Board)
    } catch {
      // falha silenciosa — mantém estado anterior
    } finally {
      if (seq === reqSeq.current) setIsLoading(false)
    }
  }, [slotId])

  useEffect(() => {
    if (!slotsReady) return
    void fetchBoard()
  }, [fetchBoard, slotsReady])

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
  const dayLabel = 'hoje'

  function toCoupons(orders: BoardOrder[], condoName: string): CouponData[] {
    return orders.map((o) => {
      const ref = o.orderId || o.marketOrderId || ''
      return {
        orderId: ref,
        code: shortCode(ref),
        clientName: o.name,
        condominiumName: condoName,
        block: o.block,
        apartment: o.apartment,
        quantity: o.quantity,
        slotLabel: o.slotLabel,
        dateLabel,
        marketItems: o.marketItems,
      }
    })
  }

  // Toggle otimista de um pedido (só pedidos de pão — parada só-market separa no "Concluir").
  async function toggleOrder(condoId: string, slotId: string, order: BoardOrder) {
    if (!order.orderId) return
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
        sub={`Recebimento e conferência · ${dateLabel || 'Hoje'}`}
        titulo="Separação"
      />

      <div style={{ padding: '0 20px' }}>
        {/* Seletor de turno — a separação acontece sempre no dia da entrega (hoje),
            então só escolhemos Manhã/Tarde, igual à aba Entregas. */}
        {slots.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <SegmentedControl<string>
              tabs={slots.map((s) => ({ key: s.slotId, label: slotTabLabel(s) }))}
              value={slotId}
              onChange={setSlotId}
            />
          </div>
        )}

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
                        {condo.totalItems > 0 ? ` + ${condo.totalItems} ${condo.totalItems === 1 ? 'item' : 'itens'}` : ''}
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

                          {(() => {
                            const groups = groupByBlock(slot.orders)
                            const hasBlocks = groups.some((g) => g.block !== '')
                            const renderRows = (orders: BoardOrder[], showBlock: boolean) =>
                              orders.map((order) => (
                                <OrderRow
                                  key={order.orderId}
                                  order={order}
                                  showBlock={showBlock}
                                  onToggle={() => toggleOrder(condo.condominiumId, slot.slotId, order)}
                                  onPrint={() => setCoupons(toCoupons([order], condo.name))}
                                />
                              ))
                            if (!hasBlocks) {
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {renderRows(slot.orders, true)}
                                </div>
                              )
                            }
                            // Subgrupos por bloco (crescente), cada um com "Imprimir bloco".
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {groups.map((g) => (
                                  <div key={g.block || 'sem-bloco'} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 800, letterSpacing: '0.02em', color: 'var(--color-text-sec)', textTransform: 'uppercase' }}>
                                        {g.block ? blockLabel(g.block) : 'Sem bloco'}
                                      </span>
                                      <PrintButton
                                        label="Imprimir bloco"
                                        small
                                        onClick={() => setCoupons(toCoupons(g.orders, condo.name))}
                                      />
                                    </div>
                                    {renderRows(g.orders, false)}
                                  </div>
                                ))}
                              </div>
                            )
                          })()}
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
  const done = sep === total && total > 0
  const condoCount = board.condominiums.length
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
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: done ? 'var(--color-good)' : 'var(--color-text)' }}>
          {sep}/{total}
        </span>
      </div>
      <ProgressBar value={sep} max={total} color={done ? 'var(--color-good)' : 'var(--color-gold)'} />
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '10px 0 0' }}>
        {board.totalBreads} pães{board.totalItems > 0 ? ` + ${board.totalItems} ${board.totalItems === 1 ? 'item' : 'itens'}` : ''} · {total}{' '}
        {total === 1 ? 'entrega' : 'entregas'} em {condoCount} {condoCount === 1 ? 'condomínio' : 'condomínios'}
      </p>
    </div>
  )
}

function OrderRow({ order, onToggle, onPrint, showBlock = true }: { order: BoardOrder; onToggle: () => void; onPrint: () => void; showBlock?: boolean }) {
  const blk = showBlock ? blockLabel(order.block) : ''
  const location = blk ? `${blk} · Apto ${order.apartment || '—'}` : `Apto ${order.apartment || '—'}`
  // Parada só-market (sem pedido de pão): estado de separação é read-only (separa no "Concluir").
  const marketOnly = !order.orderId
  const items = order.marketItems ?? []
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
        onClick={marketOnly ? undefined : onToggle}
        disabled={marketOnly}
        aria-label={order.separated ? 'Separado' : 'Marcar separado'}
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
          cursor: marketOnly ? 'default' : 'pointer',
          opacity: marketOnly && !order.separated ? 0.5 : 1,
        }}
      >
        {order.separated && <Icon name="check" size={15} stroke={3} color="#fff" />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {order.name}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
          {location}
        </p>
        {items.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
            {items.map((it, i) => (
              <span
                key={i}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--color-accent)',
                  background: 'var(--color-gold-soft)',
                  borderRadius: 999,
                  padding: '2px 8px',
                }}
              >
                {it.qty}× {it.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {order.quantity > 0 && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 4,
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 800,
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
          }}
        >
          {order.quantity}
          <span style={{ fontSize: 13 }}>🥖</span>
        </span>
      )}

      <button
        onClick={onPrint}
        aria-label="Imprimir cupom"
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 8,
          border: '1px solid var(--color-border-2)',
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
