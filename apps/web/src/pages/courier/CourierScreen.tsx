import { useState, useEffect } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { getGreeting } from '../../lib/greeting'
import { BreadMark } from '../../components/brand/BreadMark'
import { Icon } from '../../components/brand/Icon'
import { useAuth } from '../../hooks/useAuth'
import { ProgressCard } from '../../components/courier/ProgressCard'
import { SegmentedControl } from '../../components/courier/SegmentedControl'
import { CondoAccordion, CondoGroup } from '../../components/courier/CondoAccordion'
import { ConfirmDeliveryDialog } from '../../components/courier/ConfirmDeliveryDialog'
import { Stop } from '../../components/courier/StopRow'
import { CourierRouteView } from './CourierRouteView'
import { QrScanner } from '../../components/courier/QrScanner'

interface SlotInfo {
  slotId: string
  label: string
  emoji: string
  time: string
}

interface TodayOrdersResponse {
  condos: CondoGroup[]
  totalStops: number
  totalBreads: number
  route: {
    distanceKm: string
    durationMin: number
    geometry: Array<[number, number]>
  } | null
  slots: SlotInfo[]
}

// Data por extenso (ex.: "Sexta-feira, 27 de junho") — deixa clara a data da entrega.
function getTodayLabel(): string {
  const now = new Date()
  const full = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(now)
  return full.charAt(0).toUpperCase() + full.slice(1)
}

export function CourierScreen() {
  const { user, logout } = useAuth()
  const [data, setData] = useState<TodayOrdersResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<'list' | 'route'>('list')
  const [openAccordion, setOpenAccordion] = useState(0)
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set())
  const [notDeliveredIds, setNotDeliveredIds] = useState<Set<string>>(new Set())
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 3500)
    return () => clearTimeout(t)
  }, [feedback])

  async function handleScan(text: string) {
    setScannerOpen(false)
    const orderId = text.trim()
    const stop = data?.condos?.flatMap((c) => c.stops).find((s) => s.orderId === orderId)
    try {
      const res = await apiFetch(`/courier/orders/${orderId}/confirm`, { method: 'PATCH' })
      if (res.ok) {
        setConfirmedIds((prev) => new Set([...prev, orderId]))
        setFeedback({ type: 'ok', text: stop ? `Entrega de ${stop.clientName} confirmada` : 'Entrega confirmada' })
      } else if (res.status === 403) {
        setFeedback({ type: 'err', text: 'Este cupom não pertence à sua rota.' })
      } else if (res.status === 404) {
        setFeedback({ type: 'err', text: 'Pedido não encontrado.' })
      } else if (res.status === 422) {
        setFeedback({ type: 'err', text: 'Pedido já confirmado ou inválido.' })
      } else {
        setFeedback({ type: 'err', text: 'Falha ao confirmar. Tente novamente.' })
      }
    } catch {
      setFeedback({ type: 'err', text: 'Falha de conexão.' })
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch('/courier/orders/today')
        if (res.ok) {
          setData((await res.json()) as TodayOrdersResponse)
        }
      } catch {
        // mantém estado anterior em falha de rede
      } finally {
        setIsLoading(false)
      }
    }
    void fetchData()
  }, [])

  const confirmedCount = confirmedIds.size
  const confirmedBreads = data
    ? (data.condos ?? []).flatMap((c) => c.stops).filter((s) => confirmedIds.has(s.orderId)).reduce((sum, s) => sum + s.quantity, 0)
    : 0

  // Quando o dia mistura turnos (manhã + tarde), a aba Lista é dividida em seções por
  // turno, cada uma com seu próprio progresso. Dia de turno único mantém a lista única.
  const isMultiSlot = (data?.slots.length ?? 0) > 1
  const slotSections = (() => {
    if (!data || !isMultiSlot) return []
    // Ordem: turnos conhecidos (já ordenados por horário) + qualquer slotId órfão
    // presente nos pedidos (legado sem turno) — assim nenhuma entrega some da lista.
    const orderedSlotIds = data.slots.map((s) => s.slotId)
    for (const sid of new Set((data.condos ?? []).flatMap((c) => c.stops).map((s) => s.slotId ?? ''))) {
      if (!orderedSlotIds.includes(sid)) orderedSlotIds.push(sid)
    }

    let index = 0 // índice global do acordeão (único entre seções)
    const sections: Array<{
      slotId: string
      label: string
      condos: Array<{ condo: CondoGroup; index: number }>
      total: number
      confirmed: number
      totalBreads: number
      confirmedBreads: number
    }> = []

    for (const slotId of orderedSlotIds) {
      const condos = (data.condos ?? [])
        .map((c) => ({ ...c, stops: c.stops.filter((s) => (s.slotId ?? '') === slotId) }))
        .filter((c) => c.stops.length > 0)
        .map((condo) => ({ condo, index: index++ }))
      if (condos.length === 0) continue
      const stops = condos.flatMap((x) => x.condo.stops)
      const confirmed = stops.filter((s) => confirmedIds.has(s.orderId))
      const meta = data.slots.find((s) => s.slotId === slotId)
      const label = meta
        ? `${meta.emoji ? `${meta.emoji} ` : ''}${meta.label}${meta.time ? ` · ${meta.time}` : ''}`
        : stops[0]?.slotLabel || 'Sem turno'
      sections.push({
        slotId,
        label,
        condos,
        total: stops.length,
        confirmed: confirmed.length,
        totalBreads: stops.reduce((sum, s) => sum + s.quantity, 0),
        confirmedBreads: confirmed.reduce((sum, s) => sum + s.quantity, 0),
      })
    }
    return sections
  })()

  const todayLabel = getTodayLabel()
  const greeting = getGreeting()
  const courierName = user?.name ?? 'Entregador'

  return (
    <div
      style={{
        background: 'var(--color-app-bg)',
        minHeight: '100vh',
        paddingBottom: 24,
      }}
    >
      {/* Header — saudação */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          // Respiro maior acima do header + área segura (notch). Espelha o header do cliente.
          padding: 'calc(20px + env(safe-area-inset-top)) 20px 16px',
        }}
      >
        {/* Avatar BreadMark */}
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: '#1E1207',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <BreadMark size={30} color="#E3AC3F" aria-label="Cheirin de Pão" />
        </div>

        {/* Saudação */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--color-text-ter)',
              margin: 0,
            }}
          >
            {greeting},
          </p>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--color-text)',
              margin: '1px 0 0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {courierName}
          </p>
        </div>

        {/* Botão logout — D-08: sem dialog, clique direto */}
        <button
          onClick={logout}
          aria-label="Sair"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 12,
            cursor: 'pointer',
            width: 40,
            height: 40,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="logout" size={20} color="var(--color-text-sec)" />
        </button>
      </div>

      {/* Rota de hoje — data + turnos (deixa claro a data e se é manhã/tarde) */}
      <div
        style={{
          margin: '0 20px 14px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-2)',
          borderRadius: 18,
          padding: '14px 16px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--color-text-ter)',
            textTransform: 'uppercase',
            margin: '0 0 3px',
          }}
        >
          Rota de hoje
        </p>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 19,
            fontWeight: 700,
            color: 'var(--color-text)',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {todayLabel}
        </p>
        {data && data.slots.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {data.slots.map((s) => (
              <span
                key={s.slotId}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: 'var(--color-espresso)',
                  background: 'var(--color-gold-soft)',
                  borderRadius: 99,
                  padding: '5px 11px',
                }}
              >
                {s.emoji ? `${s.emoji} ` : ''}{s.label}{s.time ? ` · ${s.time}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Segmented control */}
      <div style={{ margin: '0 20px 12px' }}>
        <SegmentedControl value={tab} onChange={setTab} />
      </div>

      {/* Botão escanear cupom */}
      <div style={{ margin: '0 20px 12px' }}>
        <button
          onClick={() => setScannerOpen(true)}
          style={{
            width: '100%',
            minHeight: 48,
            borderRadius: 14,
            border: 'none',
            background: 'var(--color-espresso)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          <Icon name="doc" size={18} color="#E3AC3F" stroke={2} />
          Escanear cupom
        </button>
      </div>

      {/* Feedback do scan */}
      {feedback && (
        <div style={{ margin: '0 20px 12px' }}>
          <div
            role="status"
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              fontFamily: 'var(--font-body)',
              fontSize: 13.5,
              fontWeight: 700,
              background: feedback.type === 'ok' ? 'var(--color-good-soft)' : 'rgba(194,65,12,0.12)',
              color: feedback.type === 'ok' ? 'var(--color-good)' : 'var(--color-bad, #C2410C)',
            }}
          >
            {feedback.text}
          </div>
        </div>
      )}

      {/* Card de progresso (combinado) — no dia com vários turnos, a aba Lista usa
          progresso por turno; aqui só aparece em turno único ou na aba Rota (mapa). */}
      {data && (!isMultiSlot || tab === 'route') && (
        <div style={{ margin: '0 20px' }}>
          <ProgressCard
            confirmed={confirmedCount}
            total={data.totalStops}
            totalBreads={data.totalBreads}
            confirmedBreads={confirmedBreads}
          />
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '40px 20px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--color-text-sec)',
            }}
          >
            Carregando entregas...
          </p>
        </div>
      )}

      {/* Aba Lista */}
      {!isLoading && data && tab === 'list' && (
        <div
          style={{
            padding: '12px 20px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: isMultiSlot ? 22 : 12,
          }}
        >
          {(data.condos ?? []).length === 0 ? (
            <div
              style={{
                padding: '40px 0',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  margin: '0 0 8px',
                }}
              >
                Sem entregas hoje
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  color: 'var(--color-text-sec)',
                  margin: 0,
                }}
              >
                Não há pedidos atribuídos a você para hoje.
              </p>
            </div>
          ) : isMultiSlot ? (
            // Dia com manhã + tarde: uma seção por turno, com progresso próprio
            slotSections.map((sec) => {
              const pct = sec.total > 0 ? Math.round((sec.confirmed / sec.total) * 100) : 0
              const done = sec.total > 0 && sec.confirmed >= sec.total
              return (
                <div key={sec.slotId}>
                  {/* Cabeçalho do turno + progresso */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontFamily: 'var(--font-body)',
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--color-espresso)',
                          background: 'var(--color-gold-soft)',
                          borderRadius: 99,
                          padding: '5px 12px',
                        }}
                      >
                        {sec.label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-text-ter)' }}>
                        {sec.confirmed}/{sec.total} {sec.total === 1 ? 'parada' : 'paradas'} · {sec.confirmedBreads}/{sec.totalBreads} 🥖
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 99, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: done ? 'var(--color-good)' : 'var(--color-accent)', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                  {/* Prédios do turno */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {sec.condos.map(({ condo, index }, pos) => (
                      <CondoAccordion
                        key={`${sec.slotId}:${condo.condominiumId}`}
                        condo={condo}
                        order={pos + 1}
                        isOpen={openAccordion === index}
                        onToggle={() => setOpenAccordion(openAccordion === index ? -1 : index)}
                        confirmedIds={confirmedIds}
                        notDeliveredIds={notDeliveredIds}
                        showSlot={false}
                        onConfirm={(stop) => {
                          setSelectedStop(stop)
                          setDialogOpen(true)
                        }}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            // Turno único: lista direta de prédios
            (data.condos ?? []).map((condo, index) => (
              <CondoAccordion
                key={condo.condominiumId}
                condo={condo}
                order={index + 1}
                isOpen={openAccordion === index}
                onToggle={() =>
                  setOpenAccordion(openAccordion === index ? -1 : index)
                }
                confirmedIds={confirmedIds}
                notDeliveredIds={notDeliveredIds}
                showSlot={false}
                onConfirm={(stop) => {
                  setSelectedStop(stop)
                  setDialogOpen(true)
                }}
              />
            ))
          )}
        </div>
      )}

      {/* Aba Rota */}
      {!isLoading && data && tab === 'route' && (
        <div style={{ padding: '12px 20px 0' }}>
          <CourierRouteView condos={data.condos ?? []} route={data.route} />
        </div>
      )}

      {/* Dialog de confirmação */}
      <ConfirmDeliveryDialog
        stop={selectedStop}
        isOpen={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setSelectedStop(null)
        }}
        onConfirmed={(id) => {
          setConfirmedIds((prev) => new Set([...prev, id]))
          setDialogOpen(false)
          setSelectedStop(null)
        }}
        onNotDelivered={(id) => {
          setNotDeliveredIds((prev) => new Set([...prev, id]))
          setDialogOpen(false)
          setSelectedStop(null)
          setFeedback({ type: 'err', text: 'Pedido marcado como não entregue.' })
        }}
      />

      {/* Scanner de QR do cupom */}
      {scannerOpen && <QrScanner onDetect={handleScan} onClose={() => setScannerOpen(false)} />}
    </div>
  )
}
