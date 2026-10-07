import { useEffect, useState } from 'react'
import { BreadMark } from '../../components/brand/BreadMark'
import { Icon, type Ic } from '../../components/brand/Icon'
import { CRLabel, CRNote, CRSkel, CRTag, crMoney, crNum, CR_DISPLAY } from '../../components/courier/kit'
import { CourierPage, CRCard } from '../../components/courier/CourierPage'
import { dayLabel, ddmm, fetchSchedule, fetchStats, fmtDuration, type CourierSchedule, type CourierStats } from '../../lib/courierApi'

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const shortDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return WEEKDAY_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

/** Frase do cartão de sucesso — tom motivador, sem ranking. */
function cheer(rate: number): string {
  if (rate >= 0.95) return 'Mandou bem! Quase todo mundo acordou com pão na porta.'
  if (rate >= 0.85) return 'Bom ritmo. Cada porta conta.'
  return 'Os números são só seus — cada rota é uma chance nova.'
}

function Kpi({ icon, value, label, span, empty }: { icon: keyof typeof Ic; value: string; label: string; span?: boolean; empty?: boolean }) {
  return (
    <div
      style={{
        gridColumn: span ? 'span 2' : 'auto',
        background: 'var(--color-surface)',
        borderRadius: 16,
        padding: '12px 14px',
        border: empty ? '1.5px dashed var(--color-border)' : '1px solid var(--color-border-2)',
      }}
    >
      <Icon name={icon} size={17} color={empty ? 'var(--color-text-ter)' : 'var(--color-accent)'} stroke={2.3} aria-hidden="true" />
      <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 22, color: empty ? 'var(--color-text-ter)' : 'var(--color-text)', marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-sec)', fontWeight: 700 }}>{label}</div>
    </div>
  )
}

/**
 * E17 · Meus números: 7 ou 30 dias — entregas, taxa de sucesso, pães, tempo médio por rota, gráfico
 * por dia e a lista dos últimos dias. Só os números dele. Km e combustível estimados só com o switch
 * "Meus números" do A5 (padrão desligado — a API nem manda).
 */
export function CourierNumbers({ firstName, onClose }: { firstName: string; onClose: () => void }) {
  const [days, setDays] = useState<7 | 30>(30)
  const [stats, setStats] = useState<CourierStats | null>(null)
  const [error, setError] = useState(false)
  const [next, setNext] = useState<CourierSchedule['nextShift']>(null)

  useEffect(() => {
    let alive = true
    setError(false)
    void fetchStats(days).then((r) => {
      if (!alive) return
      if (r.ok) setStats(r.data)
      else setError(true)
    })
    return () => {
      alive = false
    }
  }, [days])

  const empty = stats !== null && stats.deliveries + stats.failed === 0 && days === 30
  useEffect(() => {
    if (!empty) return
    let alive = true
    void fetchSchedule().then((r) => {
      if (alive && r.ok) setNext(r.data.nextShift)
    })
    return () => {
      alive = false
    }
  }, [empty])

  if (empty) {
    return (
      <CourierPage title="Meus números" onBack={onClose}>
        <div style={{ background: 'var(--color-espresso)', color: '#FAF5EC', borderRadius: 24, padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -30, bottom: -46, opacity: 0.12 }} aria-hidden="true">
            <BreadMark size={170} color="var(--color-gold)" />
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-gold)' }}>BEM-VINDO, {firstName.toUpperCase()}</div>
            <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', marginTop: 6, lineHeight: 1.1 }}>Seus números começam na primeira rota</div>
            {next && (
              <div style={{ fontSize: 14, color: '#C7B595', marginTop: 8 }}>
                {dayLabel(next.date)} · {next.emoji ? `${next.emoji} ` : ''}
                {next.label} · {next.time}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Kpi empty span icon="check" value="—" label="Entregas" />
          <Kpi empty icon="basket" value="—" label="Pães entregues" />
          <Kpi empty icon="clock" value="—" label="Tempo médio por rota" />
        </div>
        <CRNote icon="spark">Cada rota encerrada entra aqui. Sem ranking: são só os seus números.</CRNote>
      </CourierPage>
    )
  }

  const max = stats ? Math.max(1, ...stats.perDay.map((d) => d.delivered)) : 1
  const today = stats?.perDay[stats.perDay.length - 1]?.date

  return (
    <CourierPage title="Meus números" onBack={onClose}>
      <div role="radiogroup" aria-label="Período" style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', borderRadius: 14, padding: 4 }}>
        {([7, 30] as const).map((d) => {
          const on = d === days
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                if (d === days) return
                setStats(null)
                setDays(d)
              }}
              style={{
                flex: 1,
                height: 42,
                borderRadius: 11,
                border: 'none',
                background: on ? 'var(--color-surface)' : 'transparent',
                boxShadow: on ? 'var(--shadow-soft)' : 'none',
                fontWeight: 800,
                fontSize: 14,
                color: on ? 'var(--color-text)' : 'var(--color-text-sec)',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {d} dias
            </button>
          )
        })}
      </div>

      {error && <CRNote tone="gold">Não deu para carregar seus números agora. Tente de novo em instantes.</CRNote>}

      {!stats && !error && (
        <>
          <CRSkel h={86} r={22} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <CRSkel h={78} r={16} style={{ gridColumn: 'span 2' }} />
            <CRSkel h={78} r={16} />
            <CRSkel h={78} r={16} />
          </div>
        </>
      )}

      {stats && (
        <>
          <div style={{ background: 'var(--color-espresso)', color: '#FAF5EC', borderRadius: 22, padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 48, color: 'var(--color-gold)', letterSpacing: '-0.03em' }}>
              {stats.successRate === null ? '—' : `${Math.round(stats.successRate * 100)}%`}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>de entregas com sucesso</div>
              <div style={{ fontSize: 13.5, color: '#C7B595', marginTop: 2 }}>
                {stats.successRate === null ? 'Nenhuma entrega nesse período.' : cheer(stats.successRate)}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Kpi span icon="check" value={String(stats.deliveries)} label="Entregas" />
            <Kpi icon="basket" value={stats.breads.toLocaleString('pt-BR')} label="Pães entregues" />
            <Kpi icon="clock" value={stats.avgRouteMin === null ? '—' : fmtDuration(stats.avgRouteMin)} label="Tempo médio por rota" />
            {stats.fuelVisible === true && (
              <>
                <Kpi icon="route" value={stats.km == null ? '—' : `~${crNum(stats.km)} km`} label="Km estimado" />
                <Kpi icon="fuel" value={stats.fuel == null ? '—' : `≈ ${crMoney(stats.fuel)}`} label="Combustível estimado" />
              </>
            )}
          </div>

          <CRCard pad={16}>
            <CRLabel>Entregas por dia</CRLabel>
            <div role="img" aria-label={`Entregas por dia nos últimos ${stats.days} dias`} style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>
              {stats.perDay.map((d) => (
                <div
                  key={d.date}
                  title={`${ddmm(d.date)}: ${d.delivered}`}
                  style={{
                    flex: 1,
                    height: d.delivered ? `${(d.delivered / max) * 100}%` : 3,
                    borderRadius: 3,
                    background: d.delivered ? (d.date === today ? 'var(--color-gold)' : 'var(--color-accent)') : 'var(--color-surface-2)',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-ter)', fontWeight: 700, marginTop: 6 }}>
              <span>{ddmm(stats.perDay[0].date)}</span>
              <span>folgas em cinza</span>
              <span>{today ? ddmm(today) : ''}</span>
            </div>
          </CRCard>

          {stats.recent.length > 0 && (
            <CRCard>
              {stats.recent.map((d, i) => (
                <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', minHeight: 54, borderTop: i ? '1px solid var(--color-border-2)' : 'none' }}>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)' }}>
                    {d.date === today ? 'Hoje' : shortDay(d.date)} · {ddmm(d.date)}
                  </span>
                  <span style={{ fontSize: 14 }} aria-hidden="true">
                    {d.slots.join(' ')}
                  </span>
                  <CRTag icon="check" tone="good" size="sm">
                    <span className="sr-only">entregues: </span>
                    {d.delivered}
                  </CRTag>
                  {d.failed > 0 && (
                    <CRTag icon="x" tone="danger" size="sm">
                      <span className="sr-only">não entregues: </span>
                      {d.failed}
                    </CRTag>
                  )}
                </div>
              ))}
            </CRCard>
          )}
        </>
      )}
    </CourierPage>
  )
}
