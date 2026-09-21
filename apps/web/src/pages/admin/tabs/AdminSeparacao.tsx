import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { blockLabel, formatUnit } from '@cheirin-de-pao/shared'
import { apiFetch } from '../../../lib/apiFetch'
import { AdminHead } from '../../../components/admin/AdminHead'
import { ProgressBar } from '../../../components/admin/ProgressBar'
import { SegmentedControl } from '../../../components/admin/SegmentedControl'
import { ConfirmSheet } from '../../../components/admin/ConfirmSheet'
import { Toast, useToast } from '../../../components/admin/Toast'
import { Icon } from '../../../components/brand/Icon'
import { FirstOrderChip } from '../../../components/admin/FirstOrderChip'
import { OrderCouponSheet, type CouponData } from '../../../components/admin/coupon/OrderCoupon'
import { usePrintQueue } from '../../../components/admin/coupon/CouponShell'
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
/** Linha da lista consolidada "quanto pegar da prateleira" (agregada por produto). */
interface MarketPickItem {
  productId: string
  name: string
  qty: number
}
interface BoardOrder {
  orderId: string
  userId: string
  name: string
  block: string
  complement: string
  apartment: string
  quantity: number
  slotId: string
  slotLabel: string
  type: string
  status: string
  separated: boolean
  // Mini market ("Além do Pãozin") — presente em parada combinada ou só-market.
  marketOrderId?: string
  /** Todas as Cestinhas da parada (o cliente pode ter comprado mais de uma no turno). */
  marketOrderIds?: string[]
  marketItems: MarketItem[]
  marketItemCount: number
  /** Estreia do cliente — a parada cai no dia da primeira entrega dele. */
  isFirstOrder?: boolean
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
  /** Produtos a separar neste lote (condomínio + turno), agregados por produto. */
  marketPicklist: MarketPickItem[]
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
  /** Produtos a separar no DIA inteiro, agregados por produto — o que tirar da prateleira. */
  marketPicklist: MarketPickItem[]
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

const shortCode = (orderId: string) => orderId.slice(-4).toUpperCase()

const countSep = (orders: { separated: boolean }[]) => orders.filter((o) => o.separated).length

/** Um lote físico (condomínio + turno) — a unidade de conclusão da separação na API. */
export interface SeparationScope {
  condominiumId: string
  slotId: string
}

/** O mínimo que `buildScopes` precisa de um condomínio do quadro. */
export interface ScopeCondo {
  condominiumId: string
  slots: { slotId: string; orders: { separated: boolean }[] }[]
}

/**
 * Um turno está pronto quando todas as suas paradas estão marcadas. Calculado na tela (e não
 * pelo `concluded` do backend) porque o toggle de cada parada é otimista — o quadro só volta
 * do servidor depois.
 */
export function slotDone(slot: { orders: { separated: boolean }[] }): boolean {
  return slot.orders.length > 0 && countSep(slot.orders) === slot.orders.length
}

/**
 * Deriva os lotes a concluir a partir dos condomínios marcados.
 *
 * Só entram os turnos iguais ao EXIBIDO (`activeSlotId`): cada turno é aprovado separadamente,
 * então a seleção múltipla nunca atravessa Manhã → Tarde. Turno já todo marcado fica fora — não
 * há nada a mover, e mantê-lo inflaria a contagem de lotes mostrada ao operador.
 */
export function buildScopes(
  condos: ScopeCondo[],
  selected: ReadonlySet<string>,
  activeSlotId: string,
): SeparationScope[] {
  const scopes: SeparationScope[] = []
  for (const condo of condos) {
    if (!selected.has(condo.condominiumId)) continue
    for (const slot of condo.slots) {
      if (slot.slotId !== activeSlotId || slotDone(slot)) continue
      scopes.push({ condominiumId: condo.condominiumId, slotId: slot.slotId })
    }
  }
  return scopes
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
  // Fila + disparo + limpeza de impressão vivem no shell do cupom (usados também na reimpressão).
  const { queue: coupons, print: setCoupons } = usePrintQueue<CouponData>()
  const [slots, setSlots] = useState<SlotOption[]>([])
  const [slotId, setSlotId] = useState<string>('')
  // Só busca o quadro depois que os turnos carregaram: assim o fetch já sai com o
  // slotId correto, em vez de uma primeira chamada sem filtro (que traz todos os turnos).
  const [slotsReady, setSlotsReady] = useState(false)
  // Sequência de requisições: só aplicamos a resposta da busca mais recente, evitando
  // que uma chamada antiga (sem filtro) resolva depois e sobrescreva o turno selecionado.
  const reqSeq = useRef(0)
  // Seleção múltipla de condomínios (concluir/imprimir em lote) — ids de condomínio.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { toast, showToast } = useToast()

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

  // Trocar de turno zera a seleção: ela vale sempre para o turno em tela.
  useEffect(() => setSelected(new Set()), [slotId])

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
        complement: o.complement,
        apartment: o.apartment,
        quantity: o.quantity,
        slotLabel: o.slotLabel,
        dateLabel,
        marketItems: o.marketItems,
        isFirstOrder: o.isFirstOrder,
      }
    })
  }

  // ── Seleção múltipla de condomínios ─────────────────────────────────────────
  // Cada turno é aprovado separadamente, então a seleção opera sempre num único turno: o do
  // SegmentedControl. Sem turnos configurados o quadro traz um turno só ('' = sem horário) e é
  // ele o ativo. Se ainda assim vierem vários turnos à vista, a seleção some — concluir dois
  // turnos numa tacada é exatamente o que não pode acontecer.
  const boardSlotIds = useMemo(
    () => [...new Set((board?.condominiums ?? []).flatMap((c) => c.slots.map((s) => s.slotId)))],
    [board],
  )
  const activeSlotId: string | null = slotId || (boardSlotIds.length === 1 ? boardSlotIds[0] : null)
  const canSelect = activeSlotId !== null

  /** Condomínios com algo pendente no turno exibido — os únicos marcáveis. */
  const selectableIds = useMemo(() => {
    if (activeSlotId === null) return []
    return (board?.condominiums ?? [])
      .filter((c) => c.slots.some((s) => s.slotId === activeSlotId && !slotDone(s)))
      .map((c) => c.condominiumId)
  }, [board, activeSlotId])

  /** Lotes que a conclusão em massa vai mover (já sem os turnos prontos). */
  const scopes = useMemo(
    () => (activeSlotId === null ? [] : buildScopes(board?.condominiums ?? [], selected, activeSlotId)),
    [board, selected, activeSlotId],
  )

  /** Paradas dos condomínios marcados, no turno exibido — base da impressão e das contagens. */
  const selectedStops = useMemo(() => {
    if (activeSlotId === null) return []
    const stops: { condoName: string; orders: BoardOrder[] }[] = []
    for (const condo of board?.condominiums ?? []) {
      if (!selected.has(condo.condominiumId)) continue
      const orders = condo.slots.filter((s) => s.slotId === activeSlotId).flatMap((s) => s.orders)
      if (orders.length > 0) stops.push({ condoName: condo.name, orders })
    }
    return stops
  }, [board, selected, activeSlotId])

  const selectedTotal = selectedStops.reduce((n, s) => n + s.orders.length, 0)
  const selectedPending = selectedStops.reduce((n, s) => n + (s.orders.length - countSep(s.orders)), 0)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))
  const barVisible = canSelect && selected.size > 0

  function toggleCondoSelection(condominiumId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(condominiumId)) next.delete(condominiumId)
      else next.add(condominiumId)
      return next
    })
  }

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectableIds))

  /** Conclui todos os lotes marcados numa única chamada (o backend agrupa por turno). */
  async function concludeSelected() {
    if (!board || scopes.length === 0) return
    const count = scopes.length
    setBusyKey('selection')
    try {
      const res = await apiFetch('/admin/separation/conclude', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes, date: board.date }),
      })
      if (!res.ok) throw new Error('falha')
      setSelected(new Set())
      setConfirmOpen(false)
      await fetchBoard()
      showToast(`Separação concluída em ${count} ${count === 1 ? 'condomínio' : 'condomínios'}`)
    } catch {
      setConfirmOpen(false)
      showToast('Não foi possível concluir a separação. Tente novamente.', false)
    } finally {
      setBusyKey(null)
    }
  }

  // Toggle otimista de uma parada. Pedido de pão vai por orderId (a Cestinha da mesma parada
  // acompanha no backend); parada SÓ-Cestinha vai pela lista de marketOrderIds.
  async function toggleOrder(condoId: string, slotId: string, order: BoardOrder) {
    const marketIds = order.marketOrderIds ?? (order.marketOrderId ? [order.marketOrderId] : [])
    if (!order.orderId && marketIds.length === 0) return
    const next = !order.separated
    const rowKey = order.orderId || order.marketOrderId || ''
    setBoard((prev) => patchOrder(prev, condoId, slotId, rowKey, next))
    try {
      const res = order.orderId
        ? await apiFetch(`/admin/separation/orders/${order.orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ separated: next }),
          })
        : await apiFetch('/admin/separation/market-orders', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marketOrderIds: marketIds, separated: next }),
          })
      if (!res.ok) throw new Error('falha')
    } catch {
      // reverte em caso de erro
      setBoard((prev) => patchOrder(prev, condoId, slotId, rowKey, order.separated))
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

  // ── Render ──────────────────────────────────────────────────────────────────
  const isEmpty = !board || board.condominiums.length === 0

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <AdminHead
        sub={`Recebimento e conferência · ${dateLabel || 'Hoje'}`}
        titulo="Separação"
      />

      {/* Com a barra na tela, o respiro do rodapé abre espaço para ela: sendo fixa, ela
          cobriria o último card. */}
      <div style={{ padding: barVisible ? '0 20px 124px' : '0 20px 24px' }}>
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

            {/* Seleção múltipla — marcar vários condomínios e concluir/imprimir de uma vez. */}
            {canSelect && selectableIds.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  margin: '0 2px 12px',
                }}
              >
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)' }}>
                  {selected.size > 0
                    ? `${selected.size} de ${selectableIds.length} ${selectableIds.length === 1 ? 'condomínio' : 'condomínios'}`
                    : 'Marque condomínios para concluir em lote'}
                </span>
                <button
                  onClick={toggleAll}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 999,
                    border: '1.5px solid var(--color-border)',
                    background: 'none',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 12,
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {allSelected ? 'Limpar' : 'Selecionar todos'}
                </button>
              </div>
            )}

            {board!.condominiums.map((condo) => {
              const condoSep = condo.slots.reduce((n, s) => n + countSep(s.orders), 0)
              const condoTotal = condo.slots.reduce((n, s) => n + s.orders.length, 0)
              const allOrders = condo.slots.flatMap((s) => s.orders)
              // Marcável só se houver lote pendente no turno exibido; sem isso o quadrado
              // aparece apenas como selo de "já separado".
              const isSelectable = selectableIds.includes(condo.condominiumId)
              const isSelected = selected.has(condo.condominiumId)

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
                    {canSelect && (
                      <CheckSquare
                        checked={isSelectable ? isSelected : true}
                        disabled={!isSelectable}
                        tone={isSelectable ? 'brand' : 'good'}
                        ariaLabel={
                          isSelectable
                            ? `Selecionar ${condo.name}`
                            : `${condo.name} já separado`
                        }
                        onClick={() => toggleCondoSelection(condo.condominiumId)}
                      />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
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
                              {/* Com um turno por card (o normal, já que a tela filtra por turno)
                                  isto imprimiria a mesma pilha do "Imprimir" do cabeçalho. Só
                                  aparece quando há mais de um turno, onde o recorte é diferente. */}
                              {condo.slots.length > 1 && (
                                <PrintButton label="Cupons" small onClick={() => setCoupons(toCoupons(slot.orders, condo.name))} />
                              )}
                              {/* Concluir o lote solto também só faz sentido com vários turnos no
                                  card: com um turno é o que a seleção já faz (marque o condomínio
                                  e conclua na barra, com confirmação). Concluído, sobra o selo. */}
                              {(condo.slots.length > 1 || concluded) && (
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
                              )}
                            </div>
                          </div>

                          {/* Lista do LOTE (condomínio + turno) — é a unidade física de separação:
                              o que pegar da prateleira para este condomínio neste turno. */}
                          {slot.marketPicklist?.length > 0 && (
                            <MarketPicklist items={slot.marketPicklist} title="Itens deste lote" compact />
                          )}

                          {(() => {
                            const groups = groupByBlock(slot.orders)
                            const hasBlocks = groups.some((g) => g.block !== '')
                            const renderRows = (orders: BoardOrder[], showBlock: boolean) =>
                              orders.map((order) => (
                                <OrderRow
                                  // `orderId` é '' em parada só-Cestinha — duas delas no mesmo
                                  // lote colidiriam na mesma key. Cai no marketOrderId.
                                  key={order.orderId || order.marketOrderId}
                                  order={order}
                                  showBlock={showBlock}
                                  onToggle={() => toggleOrder(condo.condominiumId, slot.slotId, order)}
                                  onPrint={() => setCoupons(toCoupons([order], condo.name))}
                                />
                              ))
                            if (!hasBlocks) {
                              return (
                                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {renderRows(slot.orders, true)}
                                </div>
                              )
                            }
                            // Subgrupos por bloco (crescente), cada um com "Imprimir bloco".
                            return (
                              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {groups.map((g) => (
                                  <div key={g.block || 'sem-bloco'} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 30, padding: '2px 0' }}>
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
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Barra da seleção — fixa na viewport, logo acima da nav (56px + safe area), para concluir
          ou imprimir sem rolar até o fim da lista. Fixa e não `sticky` de propósito: quando o
          conteúdo é alto quem rola é a página, e o container do tab — mesmo com `overflow: auto` —
          fica do tamanho do conteúdo, sem nunca rolar. O sticky ficava preso lá embaixo.
          zIndex abaixo da nav (50) e das folhas de confirmação/cupom (100+). */}
      {barVisible && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
            zIndex: 40,
            background: 'var(--color-app-bg)',
            borderTop: '1px solid var(--color-border-2)',
            boxShadow: '0 -8px 24px rgba(30, 18, 7, 0.08)',
            padding: '12px 20px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-sec)' }}>
              {selected.size} {selected.size === 1 ? 'condomínio' : 'condomínios'} · {selectedTotal}{' '}
              {selectedTotal === 1 ? 'entrega' : 'entregas'}
            </span>
            {selectedPending > 0 && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: '#8A6A00', whiteSpace: 'nowrap' }}>
                {selectedPending} a conferir
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setCoupons(selectedStops.flatMap((s) => toCoupons(s.orders, s.condoName)))}
              disabled={selectedTotal === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 46,
                padding: '0 16px',
                borderRadius: 16,
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-surface)',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 14,
                color: 'var(--color-text)',
                cursor: selectedTotal === 0 ? 'default' : 'pointer',
                opacity: selectedTotal === 0 ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon name="doc" size={16} stroke={2} color="var(--color-text-sec)" />
              Cupons
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={scopes.length === 0 || busyKey === 'selection'}
              style={{
                flex: 1,
                minHeight: 46,
                borderRadius: 16,
                border: 'none',
                background: 'var(--color-espresso)',
                color: '#FAF5EC',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 15,
                cursor: scopes.length === 0 ? 'default' : 'pointer',
                opacity: scopes.length === 0 || busyKey === 'selection' ? 0.6 : 1,
              }}
            >
              {busyKey === 'selection'
                ? 'Concluindo...'
                : scopes.length === 0
                  ? 'Nada a concluir'
                  : `Concluir ${scopes.length} ${scopes.length === 1 ? 'condomínio' : 'condomínios'}`}
            </button>
          </div>
        </div>
      )}

      {/* Confirmação — concluir marca como separado até o que ainda não foi conferido. */}
      <ConfirmSheet
        open={confirmOpen}
        title={`Concluir ${scopes.length} ${scopes.length === 1 ? 'condomínio' : 'condomínios'}?`}
        description={
          selectedPending > 0
            ? `${selectedPending} de ${selectedTotal} ${selectedTotal === 1 ? 'entrega' : 'entregas'} ainda não ${selectedPending === 1 ? 'foi conferida' : 'foram conferidas'} e ${selectedPending === 1 ? 'será marcada' : 'serão marcadas'} como separada${selectedPending === 1 ? '' : 's'}. Os pedidos seguem para a divisão de entregas.`
            : 'Os pedidos seguem para a divisão de entregas.'
        }
        confirmLabel="Concluir separação"
        busy={busyKey === 'selection'}
        onConfirm={() => void concludeSelected()}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Folha de cupons (oculta na tela; impressa via window.print) */}
      <OrderCouponSheet coupons={coupons} />

      <Toast toast={toast} />
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

      {/* Lista consolidada do dia — "quanto pegar da prateleira". Antes disto o operador tinha
          que somar os chips de cada parada na mão para saber quantos bolos separar. */}
      {board.marketPicklist.length > 0 && <MarketPicklist items={board.marketPicklist} title="Separar do Além do Pãozin" />}
    </div>
  )
}

/** Lista agregada por produto — o que sai da prateleira. Usada no dia e por lote. */
function MarketPicklist({ items, title, compact = false }: { items: MarketPickItem[]; title: string; compact?: boolean }) {
  const total = items.reduce((s, i) => s + i.qty, 0)
  return (
    <div
      style={{
        marginTop: compact ? 8 : 12,
        padding: compact ? '8px 10px' : '10px 12px',
        borderRadius: 12,
        background: 'var(--color-gold-soft)',
        border: '1px solid rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: compact ? 11 : 12, fontWeight: 800, color: 'var(--color-accent)' }}>
          🧺 {title}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: compact ? 12 : 13, fontWeight: 800, color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
          {total} {total === 1 ? 'item' : 'itens'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.map((it) => (
          <div key={it.productId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: compact ? 11.5 : 12.5,
                color: 'var(--color-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {it.name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: compact ? 12 : 13,
                fontWeight: 800,
                color: 'var(--color-espresso)',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {it.qty}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Quadrado de marcação — o mesmo gesto para "parada separada" (na linha do cliente) e para
 * "condomínio selecionado" (no cabeçalho do card). Desabilitado e marcado = selo de concluído.
 *
 * O `tone` existe para os dois não se confundirem: verde é o "separado" de toda a tela, então
 * a seleção usa o espresso da marca. Um condomínio 0/3 marcado de verde parecia já conferido.
 */
function CheckSquare({
  checked,
  onClick,
  disabled = false,
  ariaLabel,
  tone = 'good',
}: {
  checked: boolean
  onClick: () => void
  disabled?: boolean
  ariaLabel: string
  tone?: 'good' | 'brand'
}) {
  const fill = tone === 'brand' ? 'var(--color-espresso)' : 'var(--color-good)'
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={checked}
      style={{
        width: 26,
        height: 26,
        flexShrink: 0,
        borderRadius: 8,
        border: checked ? 'none' : '1.5px solid var(--color-border)',
        background: checked ? fill : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled && !checked ? 0.5 : 1,
      }}
    >
      {checked && <Icon name="check" size={15} stroke={3} color="#fff" />}
    </button>
  )
}

function OrderRow({ order, onToggle, onPrint, showBlock = true }: { order: BoardOrder; onToggle: () => void; onPrint: () => void; showBlock?: boolean }) {
  // Quando a lista já está agrupada por bloco, o rótulo do grupo diz o bloco — mas o
  // complemento varia dentro do mesmo bloco, então ele continua na linha.
  const location = formatUnit(order, { block: showBlock ? 'full' : 'omit' })
  const items = order.marketItems ?? []
  // Parada só-Cestinha (sem pedido de pão) também alterna: o toggle vai nos MarketOrder dela.
  const marketIds = order.marketOrderIds ?? (order.marketOrderId ? [order.marketOrderId] : [])
  const canToggle = !!order.orderId || marketIds.length > 0
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
      <CheckSquare
        checked={order.separated}
        disabled={!canToggle}
        ariaLabel={order.separated ? 'Separado' : 'Marcar separado'}
        onClick={onToggle}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.name}</span>
          {order.isFirstOrder && <FirstOrderChip compact />}
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
/**
 * Atualiza uma linha do quadro. A chave é `orderId || marketOrderId`: em parada só-Cestinha o
 * orderId é '' e casar por ele marcaria TODAS as paradas só-Cestinha do turno de uma vez.
 */
function patchOrder(board: Board | null, condoId: string, slotId: string, rowKey: string, separated: boolean): Board | null {
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
                      (o.orderId || o.marketOrderId || '') !== rowKey
                        ? o
                        : { ...o, separated, status: separated ? 'SEPARATED' : 'SCHEDULED' },
                    ),
                  },
            ),
          },
    ),
  }
}
