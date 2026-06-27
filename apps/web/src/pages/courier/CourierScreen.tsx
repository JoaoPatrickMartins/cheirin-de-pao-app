import { useState, useEffect } from 'react'
import { apiFetch } from '../../lib/apiFetch'
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

interface TodayOrdersResponse {
  condos: CondoGroup[]
  totalStops: number
  totalBreads: number
  route: {
    distanceKm: string
    durationMin: number
    geometry: Array<[number, number]>
  } | null
}

function getTodayLabel(): string {
  const now = new Date()
  const day = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(now)
  const month = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  })
    .format(now)
    .replace('.', '')
  return `${day} ${month}`
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
    const stop = data?.condos.flatMap((c) => c.stops).find((s) => s.orderId === orderId)
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
    ? data.condos.flatMap((c) => c.stops).filter((s) => confirmedIds.has(s.orderId)).reduce((sum, s) => sum + s.quantity, 0)
    : 0

  const todayLabel = getTodayLabel()
  const courierName = user?.name ?? 'Entregador'

  return (
    <div
      style={{
        background: 'var(--color-app-bg)',
        minHeight: '100vh',
        paddingBottom: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 20px 12px',
        }}
      >
        {/* Avatar BreadMark */}
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            background: '#1E1207',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <BreadMark size={27} color="#E3AC3F" aria-label="Cheirin de Pão" />
        </div>

        {/* Textos + logout */}
        <div style={{ textAlign: 'right' }}>
          {/* Botão logout — D-08: sem dialog, clique direto */}
          <button
            onClick={logout}
            aria-label="Sair"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              marginBottom: 4,
              marginLeft: 'auto',
            }}
          >
            <Icon name="logout" size={22} color="var(--color-text-ter)" />
          </button>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text-ter)',
              margin: 0,
            }}
          >
            Rota de hoje · {todayLabel}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            Olá, {courierName}
          </p>
        </div>
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

      {/* Card de progresso */}
      {data && (
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
            gap: 12,
          }}
        >
          {data.condos.length === 0 ? (
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
          ) : (
            data.condos.map((condo, index) => (
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
          <CourierRouteView condos={data.condos} route={data.route} />
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
