/**
 * DateChips — chips de seleção de data para a SingleScreen
 *
 * Exibe "Amanhã cedo" (desabilitado após 21h — D-05), "Depois de amanhã"
 * e "Outra data" (input nativo com min=amanhã e max=30dias — D-04, D-06).
 *
 * Requirements: SCHED-01
 * Source: screens-order.jsx linhas 280–288, 04-UI-SPEC.md seção 9
 */
import { useRef } from 'react'
import { Icon } from '../brand/Icon'

const CUTOFF_HOUR = 21

interface DateChipsProps {
  value: string | null
  onChange: (v: string) => void
  deliveryTime: string
}

function formatDateValue(dateStr: string): string {
  // Formata "YYYY-MM-DD" para "DD mmm"
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${day} ${months[date.getMonth()]}`
}

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDayAbbr(date: Date): string {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return days[date.getDay()]
}

export default function DateChips({ value, onChange, deliveryTime }: DateChipsProps) {
  const dateInputRef = useRef<HTMLInputElement>(null)

  const now = new Date()
  const isAfterCutoff = now.getHours() >= CUTOFF_HOUR

  // Calcular amanhã e depois de amanhã
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const dayAfterTomorrow = new Date(now)
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)

  // Max = 30 dias a partir de amanhã
  const in30Days = new Date(now)
  in30Days.setDate(in30Days.getDate() + 30)

  const tomorrowStr = toDateString(tomorrow)
  const dayAfterTomorrowStr = toDateString(dayAfterTomorrow)
  const in30DaysStr = toDateString(in30Days)

  // Verificar se o value atual é uma das datas pré-definidas ou outra data
  const isOtherDate = value !== null && value !== tomorrowStr && value !== dayAfterTomorrowStr

  const chipBase: React.CSSProperties = {
    flex: 1,
    padding: '13px 14px',
    borderRadius: 16,
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background .15s, border-color .15s, color .15s',
    minWidth: 0,
  }

  const chipActive: React.CSSProperties = {
    ...chipBase,
    border: '1.5px solid var(--color-accent)',
    background: 'var(--color-gold-soft)',
  }

  const chipDisabled: React.CSSProperties = {
    ...chipBase,
    opacity: 0.4,
    cursor: 'default',
  }

  const chipTitleBase: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--color-text)',
    margin: 0,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }

  const chipTitleActive: React.CSSProperties = {
    ...chipTitleBase,
    color: 'var(--color-accent)',
  }

  const chipSubLabel: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    color: 'var(--color-text-ter)',
    margin: '2px 0 0 0',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          fontWeight: 700,
          color: 'var(--color-text-sec)',
          margin: 0,
          marginBottom: 9,
        }}
      >
        Para quando?
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        {/* Chip "Amanhã cedo" */}
        <button
          disabled={isAfterCutoff}
          style={isAfterCutoff ? chipDisabled : value === tomorrowStr ? chipActive : chipBase}
          onClick={isAfterCutoff ? undefined : () => onChange(tomorrowStr)}
        >
          <p style={value === tomorrowStr && !isAfterCutoff ? chipTitleActive : chipTitleBase}>
            Amanhã cedo
          </p>
          <p style={chipSubLabel}>
            {isAfterCutoff
              ? 'Disponível até 21:00'
              : `${getDayAbbr(tomorrow)}, ${deliveryTime}`}
          </p>
        </button>

        {/* Chip "Depois de amanhã" */}
        <button
          style={value === dayAfterTomorrowStr ? chipActive : chipBase}
          onClick={() => onChange(dayAfterTomorrowStr)}
        >
          <p style={value === dayAfterTomorrowStr ? chipTitleActive : chipTitleBase}>
            Depois de amanhã
          </p>
          <p style={chipSubLabel}>
            {getDayAbbr(dayAfterTomorrow)}, {deliveryTime}
          </p>
        </button>

        {/* Chip "Outra data" */}
        <button
          style={isOtherDate ? chipActive : chipBase}
          onClick={() => dateInputRef.current?.click()}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon name="calendar" size={16} color={isOtherDate ? 'var(--color-accent)' : 'var(--color-text)'} />
            <p style={isOtherDate ? chipTitleActive : chipTitleBase}>
              {isOtherDate ? formatDateValue(value!) : 'Outra data'}
            </p>
          </div>
        </button>

        {/* Input nativo oculto — D-04, D-06 */}
        <input
          ref={dateInputRef}
          type="date"
          min={tomorrowStr}
          max={in30DaysStr}
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value)
          }}
        />
      </div>
    </div>
  )
}
