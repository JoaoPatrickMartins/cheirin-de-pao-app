import { useEffect, useState } from 'react'
import { Icon } from '../../components/brand/Icon'
import { CRLabel, CRNote, CRSkel, CR_DISPLAY } from '../../components/courier/kit'
import { CourierPage, CRCard } from '../../components/courier/CourierPage'
import { todayOf, weekdayShort, whenLabel } from '../../components/courier/CourierWeek'
import { supportWhatsappUrl } from '../../lib/support'
import { ddmm, fetchSchedule, rangeLabel, type CourierSchedule as Schedule } from '../../lib/courierApi'

/**
 * E18 · Minha escala — SÓ LEITURA: a semana (dias e turnos), as próximas folgas e o atalho para a
 * operação. Quem define a escala é o admin (A3 · seção 5).
 */
export function CourierSchedule({ initial, onClose }: { initial?: Schedule | null; onClose: () => void }) {
  const [s, setS] = useState<Schedule | null>(initial ?? null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    void fetchSchedule().then((r) => {
      if (!alive) return
      if (r.ok) setS(r.data)
      else setError(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const today = s ? todayOf(s) : undefined
  const next = s?.nextShift ?? null
  const when = next ? whenLabel(next.date, today) : null

  return (
    <CourierPage title="Minha escala" onBack={onClose}>
      {!s && error && <CRNote tone="gold">Não deu para carregar a escala agora. Tente de novo em instantes.</CRNote>}
      {!s && !error && (
        <>
          <CRSkel h={170} r={18} />
          <CRSkel h={60} r={18} />
        </>
      )}
      {s && (
        <>
          {s.todayOff && (
            <CRNote icon="dayoff" tone="good">
              <b>Hoje é sua folga 🌿</b>
              {next && ` Sua próxima rota é ${when === 'amanhã' ? 'amanhã' : (when ?? '').toLowerCase()}, ${next.emoji ? `${next.emoji} ` : ''}${next.label} · ${next.time}.`}
            </CRNote>
          )}
          <CRCard pad={16}>
            <CRLabel>
              Esta semana · {ddmm(s.weekStart)}–{ddmm(s.weekEnd)}
            </CRLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
              {s.week.map((d) => {
                const works = !d.off && d.slots.length > 0
                return (
                  <div
                    key={d.date}
                    aria-label={`${weekdayShort(d.weekday)} ${d.date.slice(8)}${d.today ? ' (hoje)' : ''}: ${works ? d.slots.map((x) => x.label).join(' e ') : 'folga'}`}
                    style={{
                      borderRadius: 14,
                      padding: '9px 0',
                      textAlign: 'center',
                      background: d.today ? 'var(--color-espresso)' : works ? 'var(--color-surface-alt)' : 'var(--color-surface-2)',
                      color: d.today ? '#FAF5EC' : 'var(--color-text)',
                      border: d.today ? 'none' : '1px solid var(--color-border-2)',
                    }}
                  >
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: d.today ? 'var(--color-gold)' : 'var(--color-text-sec)' }}>{weekdayShort(d.weekday)}</div>
                    <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 18 }}>{d.date.slice(8)}</div>
                    <div style={{ fontSize: 12, marginTop: 3, minHeight: 32, lineHeight: 1.3 }} aria-hidden="true">
                      {works ? (
                        d.slots.map((x) => <div key={x.slotId}>{x.emoji || '•'}</div>)
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 800, color: d.today ? '#C7B595' : 'var(--color-text-ter)' }}>folga</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 12, fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 700 }}>
              {s.slots.map((x) => (
                <span key={x.slotId}>
                  {x.emoji ? `${x.emoji} ` : ''}
                  {x.label} · {x.time}
                </span>
              ))}
            </div>
          </CRCard>

          <div>
            <CRLabel style={{ marginTop: 4 }}>Próximas folgas</CRLabel>
            {s.timeOffs.length === 0 ? (
              <CRCard pad={16}>
                <div style={{ fontSize: 14, color: 'var(--color-text-sec)' }}>Nenhuma folga marcada além dos dias fora da escala.</div>
              </CRCard>
            ) : (
              <CRCard>
                {s.timeOffs.map((f, i) => (
                  <div key={`${f.startDate}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', minHeight: 60, borderTop: i ? '1px solid var(--color-border-2)' : 'none' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--color-good-soft)', color: 'var(--color-good)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon name="dayoff" size={19} aria-hidden="true" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>{rangeLabel(f.startDate, f.endDate)}</div>
                      {f.reason && <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)' }}>{f.reason}</div>}
                    </div>
                  </div>
                ))}
              </CRCard>
            )}
          </div>
        </>
      )}

      <CRNote icon="lock">
        A escala é definida pela operação. Algo errado?{' '}
        <a
          href={supportWhatsappUrl('Olá! Sou entregador e preciso falar sobre a minha escala.')}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'inherit', fontWeight: 800, textDecoration: 'underline' }}
        >
          Fale com a operação
        </a>
      </CRNote>
    </CourierPage>
  )
}
