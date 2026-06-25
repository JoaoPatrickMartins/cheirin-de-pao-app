import { useState, useEffect } from 'react'
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

type Segment = 'hoje' | 'historico'

// Shape retornado por GET /admin/orders/division-suggestion.
// O backend usa `condominiums`; o front trabalha com `condos`.
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

interface SupplierOrderHistory {
  id: string
  date: string
  totalQuantity: number
  status: string
  delivered?: number
  total?: number
}

const TABS: Array<{ key: Segment; label: string }> = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'historico', label: 'Histórico' },
]

function formatDateLong(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatDateShort() {
  const d = new Date()
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

export function AdminEntregas() {
  const [segment, setSegment] = useState<Segment>('hoje')

  // Estado aba Hoje
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus[]>([])
  const [isLoadingHoje, setIsLoadingHoje] = useState(true)
  const [isApproved, setIsApproved] = useState(false)
  const [isApproving, setIsApproving] = useState(false)

  // Estado aba Histórico
  const [history, setHistory] = useState<SupplierOrderHistory[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  useEffect(() => {
    if (segment === 'hoje') {
      void fetchHojeData()
    } else {
      void fetchHistory()
    }
  }, [segment])

  async function fetchHojeData() {
    setIsLoadingHoje(true)
    try {
      // Buscar divisão sugerida
      const divRes = await apiFetch('/admin/orders/division-suggestion')
      if (divRes.ok) {
        const divData = (await divRes.json()) as DivisionSuggestionItem[]
        const mapped: Assignment[] = divData.map((item) => ({
          courierId: item.courierId,
          courierName: item.courierName,
          condos: item.condominiums ?? [],
        }))
        setAssignments(mapped)
      }

      // Buscar status de entregas do dia
      const statusRes = await apiFetch('/admin/orders/delivery-status')
      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as DeliveryStatus[]
        setDeliveryStatus(statusData)
      }
    } catch {
      // falha silenciosa — mantém estado anterior
    } finally {
      setIsLoadingHoje(false)
    }
  }

  async function fetchHistory() {
    if (history.length > 0) return
    setIsLoadingHistory(true)
    try {
      const res = await apiFetch('/admin/supplier-orders')
      if (res.ok) {
        const data = (await res.json()) as SupplierOrderHistory[]
        setHistory(data)
      }
    } catch {
      // falha silenciosa
    } finally {
      setIsLoadingHistory(false)
    }
  }

  async function handleApprove() {
    setIsApproving(true)
    try {
      // Para cada entregador com condominios, buscar orderIds via delivery-status e chamar assign-courier
      const assignmentsWithCondos = assignments.filter((a) => a.condos.length > 0)

      for (const assignment of assignmentsWithCondos) {
        const condoIds = assignment.condos.map((c) => c.condominiumId)
        const orderIds = deliveryStatus
          .filter((ds) => condoIds.includes(ds.condominiumId))
          .flatMap((ds) => ds.orderIds)

        if (orderIds.length === 0) continue

        const res = await apiFetch('/admin/orders/assign-courier', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courierId: assignment.courierId, orderIds }),
        })

        if (!res.ok) {
          throw new Error(`Falha ao atribuir entregador ${assignment.courierId}`)
        }
      }

      setIsApproved(true)
    } finally {
      setIsApproving(false)
    }
  }

  function renderHoje() {
    if (isLoadingHoje) {
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

    if (assignments.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--color-text)',
              margin: '0 0 8px',
            }}
          >
            Aguardando o corte
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13.5,
              color: 'var(--color-text-sec)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            A divisão de entregadores ficará disponível após o pedido ser confirmado.
          </p>
        </div>
      )
    }

    return (
      <>
        {/* Card de divisão sugerida com dnd */}
        <DeliveryDivisionCard
          assignments={assignments}
          onAssignmentsChange={setAssignments}
          onApprove={handleApprove}
          isApproved={isApproved}
          isApproving={isApproving}
        />

        {/* Seção Agendadas vs Realizadas */}
        {deliveryStatus.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 700,
                color: 'var(--color-text-sec)',
                letterSpacing: '0.04em',
                margin: '0 0 10px',
              }}
            >
              AGENDADAS VS REALIZADAS
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {deliveryStatus.map((item) => {
                const isComplete = item.delivered >= item.scheduled && item.scheduled > 0
                const pct = item.scheduled > 0 ? item.delivered / item.scheduled : 0

                return (
                  <div
                    key={item.condominiumId}
                    style={{
                      background: 'var(--color-surface)',
                      borderRadius: 18,
                      padding: 15,
                      border: '1px solid var(--color-border-2)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 14.5,
                          fontWeight: 700,
                          color: 'var(--color-text)',
                        }}
                      >
                        {item.condominiumName}
                      </span>

                      {isComplete ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 99,
                            background: 'var(--color-good-soft)',
                            color: 'var(--color-good)',
                            fontFamily: 'var(--font-body)',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          <Icon name="check" size={13} color="var(--color-good)" stroke={2.6} aria-hidden="true" />
                          Completo
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: 99,
                            background: 'var(--color-gold-soft)',
                            color: '#8A6A00',
                            fontFamily: 'var(--font-body)',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {item.delivered}/{item.scheduled}
                        </span>
                      )}
                    </div>

                    <ProgressBar
                      value={item.delivered}
                      max={item.scheduled}
                      color={isComplete ? 'var(--color-good)' : 'var(--color-gold)'}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </>
    )
  }

  function renderHistorico() {
    if (isLoadingHistory) {
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

    if (history.length === 0) {
      return (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13.5,
            color: 'var(--color-text-sec)',
            textAlign: 'center',
            padding: '40px 0',
          }}
        >
          Nenhum histórico encontrado.
        </p>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {history.map((item) => {
          const delivered = item.delivered ?? 0
          const total = item.total ?? item.totalQuantity ?? 0
          const pct = total > 0 ? Math.round((delivered / total) * 100) : 0
          const isComplete = pct >= 100

          return (
            <div
              key={item.id}
              style={{
                background: 'var(--color-surface)',
                borderRadius: 18,
                padding: 15,
                border: '1px solid var(--color-border-2)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {/* Avatar */}
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
                }}
              >
                <Icon name="truck" size={20} color="var(--color-accent)" stroke={2} aria-hidden="true" />
              </div>

              {/* Dados */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 14.5,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {formatDateLong(item.date)}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    color: 'var(--color-text-ter)',
                    margin: '3px 0 0',
                  }}
                >
                  {delivered} de {total} entregues
                </p>
              </div>

              {/* Pill percentual */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 8px',
                  borderRadius: 99,
                  background: isComplete ? 'var(--color-good-soft)' : 'var(--color-surface-2)',
                  color: isComplete ? 'var(--color-good)' : 'var(--color-text-sec)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: 24,
      }}
    >
      <AdminHead sub={`Controle do dia · ${formatDateShort()}`} titulo="Entregas" />

      <div style={{ padding: '0 20px' }}>
        {/* SegmentedControl Hoje/Histórico */}
        <div style={{ marginBottom: 16 }}>
          <SegmentedControl<Segment>
            tabs={TABS}
            value={segment}
            onChange={setSegment}
          />
        </div>

        {/* Conteúdo da aba */}
        {segment === 'hoje' ? renderHoje() : renderHistorico()}
      </div>

      {/* CSS para animação de spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
