import { BreadMark } from '../brand/BreadMark'
import { Icon } from '../brand/Icon'
import { CRBig, CR_DISPLAY } from './kit'
import { CRCard } from './CourierPage'
import { dayLabel, type CourierSchedule } from '../../lib/courierApi'

const WD: Record<string, string> = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom' }
export const weekdayShort = (k: string) => WD[k] ?? k

const addDay = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** "hoje" · "amanhã" · "Quarta, 01/10" */
export function whenLabel(date: string, today: string | undefined): string {
  if (today && date === today) return 'hoje'
  if (today && date === addDay(today, 1)) return 'amanhã'
  return dayLabel(date)
}

/** "Quarta, 01/10 · ☀️ Manhã · 06:30" */
export function shiftLabel(next: NonNullable<CourierSchedule['nextShift']>, today?: string): string {
  const when = whenLabel(next.date, today)
  return `${when.charAt(0).toUpperCase()}${when.slice(1)} · ${next.emoji ? `${next.emoji} ` : ''}${next.label} · ${next.time}`
}

export const todayOf = (s: CourierSchedule) => s.week.find((w) => w.today)?.date

/** Semana compacta da tela principal no dia de folga. */
export function CourierWeekMini({ schedule }: { schedule: CourierSchedule }) {
  return (
    <CRCard pad={14}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-ter)', marginBottom: 10 }}>ESTA SEMANA</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {schedule.week.map((d) => {
          const works = !d.off && d.slots.length > 0
          const today = d.today
          return (
            <div
              key={d.date}
              aria-label={`${weekdayShort(d.weekday)} ${d.date.slice(8)}: ${works ? d.slots.map((s) => s.label).join(' e ') : 'folga'}`}
              style={{
                borderRadius: 12,
                padding: '7px 0',
                textAlign: 'center',
                background: today ? (works ? 'var(--color-espresso)' : 'var(--color-good)') : works ? 'var(--color-surface-alt)' : 'var(--color-surface-2)',
                color: today ? '#fff' : 'var(--color-text)',
                border: today ? 'none' : '1px solid var(--color-border-2)',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 800, opacity: 0.8 }}>{weekdayShort(d.weekday)}</div>
              <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 16 }}>{d.date.slice(8)}</div>
              <div style={{ fontSize: 10, fontWeight: 800, marginTop: 2, color: today ? '#fff' : works ? 'var(--color-accent)' : 'var(--color-text-ter)' }}>
                {works ? d.slots.map((s) => s.emoji || '•').join('') : 'folga'}
              </div>
            </div>
          )
        })}
      </div>
    </CRCard>
  )
}

/**
 * E1 sem entregas hoje: "Hoje é sua folga 🌿" (folga marcada ou dia fora da escala) ou
 * "Nenhuma entrega hoje" — com o próximo turno e o atalho para a escala (E18).
 */
export function CourierNoDeliveries({ schedule, onOpenSchedule }: { schedule: CourierSchedule | null; onOpenSchedule: () => void }) {
  const off = !!schedule?.todayOff
  const today = schedule ? todayOf(schedule) : undefined
  const next = schedule?.nextShift ?? null
  const when = next ? whenLabel(next.date, today) : null
  return (
    <>
      <CRCard>
        <div style={{ padding: '26px 22px', textAlign: 'center', background: off ? 'var(--color-good-soft)' : 'var(--color-surface)' }}>
          <div style={{ fontSize: 40, lineHeight: 1, display: 'flex', justifyContent: 'center' }} aria-hidden="true">
            {off ? '🌿' : <BreadMark size={64} color="var(--color-gold)" />}
          </div>
          <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 24, color: 'var(--color-text)', letterSpacing: '-0.02em', marginTop: 10 }}>{off ? 'Hoje é sua folga' : 'Nenhuma entrega hoje'}</div>
          <div style={{ fontSize: 14, color: 'var(--color-text-sec)', marginTop: 6, lineHeight: 1.45 }}>
            {off ? `Descanse.${when ? ` Sua próxima rota é ${when === 'amanhã' ? 'amanhã' : `${when.charAt(0).toLowerCase()}${when.slice(1)}`}.` : ''}` : 'Quando a operação atribuir entregas para você, elas aparecem aqui.'}
          </div>
        </div>
        {next && (
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--color-border-2)' }}>
            <Icon name="calendar" size={20} color="var(--color-accent)" aria-hidden="true" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-ter)', fontWeight: 700 }}>PRÓXIMO TURNO</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>{shiftLabel(next, today)}</div>
            </div>
          </div>
        )}
      </CRCard>
      {off && schedule && <CourierWeekMini schedule={schedule} />}
      <CRBig variant="ghost" icon="dayoff" onClick={onOpenSchedule}>
        Ver minha escala
      </CRBig>
    </>
  )
}
