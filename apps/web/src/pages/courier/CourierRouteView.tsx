import { CourierMap } from '../../components/courier/CourierMap'
import { CondoGroup } from '../../components/courier/CondoAccordion'

interface RouteData {
  distanceKm: string
  durationMin: number
  geometry: Array<[number, number]>
}

export interface CourierRouteViewProps {
  condos: CondoGroup[]
  route: RouteData | null
}

function formatEstimatedTime(baseMinutes: number): string {
  const now = new Date()
  const total = now.getHours() * 60 + now.getMinutes() + Math.round(baseMinutes)
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function CourierRouteView({ condos, route }: CourierRouteViewProps) {
  if (route === null) {
    return (
      <div style={{ padding: '20px 0' }}>
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 22,
            padding: 24,
            boxShadow: 'var(--shadow-soft)',
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
            Rota indisponível
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--color-text-sec)',
              margin: 0,
            }}
          >
            O cálculo da rota está temporariamente indisponível. Use a aba Lista para as paradas.
          </p>
        </div>
      </div>
    )
  }

  const waypoints = condos
    .filter((c) => c.lat !== null && c.lng !== null)
    .map((c, i) => ({
      lat: c.lat!,
      lng: c.lng!,
      name: c.condominiumName,
      order: i + 1,
    }))

  const minutesPerStop = waypoints.length > 0 ? route.durationMin / waypoints.length : 0

  const condosWithCoords = condos.filter((c) => c.lat !== null && c.lng !== null)

  return (
    <div>
      {/* Mapa */}
      <div style={{ paddingBottom: 12 }}>
        <CourierMap
          waypoints={waypoints}
          geometry={route.geometry}
          distanceKm={route.distanceKm}
          durationMin={route.durationMin}
        />
      </div>

      {/* Label de seção */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: 'var(--color-text-ter)',
          margin: 0,
          padding: '12px 0 8px',
        }}
      >
        ORDEM DE PARADAS
      </p>

      {/* Lista de condomínios */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {condosWithCoords.map((condo, index) => {
          const estimatedTime = formatEstimatedTime(minutesPerStop * index)
          return (
            <div
              key={condo.condominiumId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: 'var(--color-surface)',
                borderRadius: 16,
                border: '1px solid var(--color-border-2)',
              }}
            >
              {/* Badge numerado */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#E3AC3F',
                  color: '#1E1207',
                  fontFamily: 'var(--font-display)',
                  fontSize: 15,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </div>

              {/* Info do condomínio */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {condo.condominiumName}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    color: 'var(--color-text-ter)',
                    margin: 0,
                  }}
                >
                  {condo.stops.length} {condo.stops.length === 1 ? 'parada' : 'paradas'}
                </p>
              </div>

              {/* Hora estimada */}
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--color-text-sec)',
                  margin: 0,
                  flexShrink: 0,
                }}
              >
                {estimatedTime}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
