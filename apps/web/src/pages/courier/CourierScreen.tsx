import { useState, useEffect } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { BreadMark } from '../../components/brand/BreadMark'
import { useAuth } from '../../hooks/useAuth'
import { ProgressCard } from '../../components/courier/ProgressCard'
import { SegmentedControl } from '../../components/courier/SegmentedControl'
import { CondoAccordion, CondoGroup } from '../../components/courier/CondoAccordion'
import { ConfirmDeliveryDialog } from '../../components/courier/ConfirmDeliveryDialog'
import { Stop } from '../../components/courier/StopRow'

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
  const { user } = useAuth()
  const [data, setData] = useState<TodayOrdersResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<'list' | 'route'>('list')
  const [openAccordion, setOpenAccordion] = useState(0)
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set())
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

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

        {/* Textos */}
        <div style={{ textAlign: 'right' }}>
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
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 22,
              padding: 24,
              textAlign: 'center',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                color: 'var(--color-text-sec)',
                margin: 0,
              }}
            >
              Mapa disponível em breve
            </p>
          </div>
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
      />
    </div>
  )
}
