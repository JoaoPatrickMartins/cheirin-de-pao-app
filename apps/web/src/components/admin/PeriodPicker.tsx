import { useState } from 'react'
import { Icon } from '../brand/Icon'

/**
 * PeriodPicker — o seletor de período de todo o módulo Financeiro/Relatórios.
 *
 * Substitui o `SegmentedControl` de dia/semana/mês nas telas de análise, porque aquele só sabia
 * dizer "do início do período até agora" — e as duas perguntas que faltavam no admin exigem mais:
 *
 *   - **"como fechou agosto?"** → mês FECHADO, não "agosto até agora". Um DRE de mês em curso não
 *     fecha com extrato nenhum.
 *   - **"de 01/07 a 15/08"** → intervalo arbitrário.
 *
 * O componente é um controlador puro: devolve a especificação (`PeriodSelection`) e quem chama a
 * traduz em querystring com {@link periodQuery}. Ele não sabe de endpoint nenhum.
 */

export type PeriodPreset = 'day' | 'week' | 'month'

export type PeriodSelection =
  | { kind: 'preset'; period: PeriodPreset }
  /** Mês de competência "YYYY-MM". */
  | { kind: 'month'; month: string }
  /** Intervalo "YYYY-MM-DD", com `to` inclusivo. */
  | { kind: 'range'; from: string; to: string }

/** Querystring correspondente à seleção — o formato que `lib/period-query.ts` valida na API. */
export function periodQuery(sel: PeriodSelection, opts?: { compare?: boolean }): string {
  const p = new URLSearchParams()
  if (sel.kind === 'preset') p.set('period', sel.period)
  else if (sel.kind === 'month') p.set('month', sel.month)
  else {
    p.set('from', sel.from)
    p.set('to', sel.to)
  }
  if (opts?.compare) p.set('compare', 'true')
  return p.toString()
}

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Hoje em BRT. O navegador do admin pode estar em outro fuso; o negócio é sempre BRT. */
function todayBrt(): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const [y, m, d] = parts.split('-').map(Number)
  return { y, m: m - 1, d }
}

/** Os N meses anteriores ao corrente, do mais recente para o mais antigo. */
function recentClosedMonths(count: number): Array<{ key: string; label: string }> {
  const { y, m } = todayBrt()
  const out: Array<{ key: string; label: string }> = []
  for (let i = 1; i <= count; i++) {
    const d = new Date(Date.UTC(y, m - i, 1))
    const my = d.getUTCFullYear()
    const mm = d.getUTCMonth()
    out.push({ key: `${my}-${pad2(mm + 1)}`, label: `${MONTH_NAMES[mm]}${my !== y ? ` ${my}` : ''}` })
  }
  return out
}

/** Rótulo curto da seleção, para o cabeçalho da tela. */
export function selectionLabel(sel: PeriodSelection): string {
  if (sel.kind === 'preset') {
    return sel.period === 'day' ? 'Hoje' : sel.period === 'week' ? 'Esta semana' : 'Este mês'
  }
  if (sel.kind === 'month') {
    const y = Number(sel.month.slice(0, 4))
    const m = Number(sel.month.slice(5, 7)) - 1
    const name = MONTH_NAMES[m] ?? sel.month
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`
  }
  const fmt = (s: string) => s.split('-').reverse().join('/')
  return `${fmt(sel.from)} a ${fmt(sel.to)}`
}

/** Sufixo para nome de arquivo exportado (ex.: "2026-08", "2026-07-01_2026-08-15", "week"). */
export function selectionSlug(sel: PeriodSelection): string {
  if (sel.kind === 'preset') return sel.period
  if (sel.kind === 'month') return sel.month
  return `${sel.from}_${sel.to}`
}

const PRESETS: Array<{ period: PeriodPreset; label: string }> = [
  { period: 'day', label: 'Hoje' },
  { period: 'week', label: 'Semana' },
  { period: 'month', label: 'Mês' },
]

interface PeriodPickerProps {
  value: PeriodSelection
  onChange: (v: PeriodSelection) => void
  /** Exibe o switch "comparar com período anterior". Só nas telas que renderizam o comparativo. */
  showCompare?: boolean
  compare?: boolean
  onCompareChange?: (v: boolean) => void
  /** Quantos meses fechados oferecer como atalho. */
  closedMonths?: number
}

export function PeriodPicker({
  value,
  onChange,
  showCompare = false,
  compare = false,
  onCompareChange,
  closedMonths = 3,
}: PeriodPickerProps) {
  // O painel de intervalo começa fechado: é o caminho menos usado, e aberto por padrão empurraria
  // todo o conteúdo da tela para baixo em cada carga.
  const [rangeOpen, setRangeOpen] = useState(value.kind === 'range')
  const [from, setFrom] = useState(value.kind === 'range' ? value.from : '')
  const [to, setTo] = useState(value.kind === 'range' ? value.to : '')

  const months = recentClosedMonths(closedMonths)
  const isActive = (sel: PeriodSelection) =>
    sel.kind === 'preset'
      ? value.kind === 'preset' && value.period === sel.period
      : sel.kind === 'month'
        ? value.kind === 'month' && value.month === sel.month
        : value.kind === 'range'

  // `to` inclusivo e não anterior a `from` — a mesma regra que a API valida. Checar aqui evita
  // um 400 previsível e deixa o botão desabilitado explicar o porquê.
  const rangeValid = from !== '' && to !== '' && from <= to

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Presets + meses fechados numa faixa rolável: em tela de 375px não cabem 6 chips fixos. */}
      <div
        role="tablist"
        aria-label="Período"
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 2,
          scrollbarWidth: 'none',
        }}
      >
        {PRESETS.map((p) => (
          <Chip
            key={p.period}
            label={p.label}
            active={isActive({ kind: 'preset', period: p.period })}
            onClick={() => onChange({ kind: 'preset', period: p.period })}
          />
        ))}

        {months.map((m) => (
          <Chip
            key={m.key}
            label={m.label}
            active={isActive({ kind: 'month', month: m.key })}
            onClick={() => onChange({ kind: 'month', month: m.key })}
          />
        ))}

        <Chip
          label="Intervalo"
          icon="calendar"
          active={value.kind === 'range'}
          onClick={() => setRangeOpen((o) => !o)}
        />
      </div>

      {rangeOpen && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 14,
            padding: 12,
          }}
        >
          <DateField label="De" value={from} onChange={setFrom} />
          <DateField label="Até" value={to} onChange={setTo} />
          <button
            type="button"
            disabled={!rangeValid}
            onClick={() => onChange({ kind: 'range', from, to })}
            style={{
              minHeight: 40,
              padding: '0 14px',
              borderRadius: 10,
              border: 'none',
              background: rangeValid ? 'var(--color-espresso)' : 'var(--color-surface-2)',
              color: rangeValid ? '#FAF5EC' : 'var(--color-text-ter)',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 700,
              cursor: rangeValid ? 'pointer' : 'default',
              flexShrink: 0,
            }}
          >
            Aplicar
          </button>
        </div>
      )}

      {showCompare && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color-text-sec)',
            paddingLeft: 2,
          }}
        >
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => onCompareChange?.(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
          />
          Comparar com o período anterior
        </label>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ subcomponentes

function Chip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string
  active: boolean
  onClick: () => void
  icon?: 'calendar'
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        minHeight: 36,
        padding: '0 13px',
        borderRadius: 99,
        border: `1px solid ${active ? 'transparent' : 'var(--color-border-2)'}`,
        background: active ? 'var(--color-espresso)' : 'var(--color-surface)',
        color: active ? '#FAF5EC' : 'var(--color-text-sec)',
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        textTransform: 'capitalize',
      }}
    >
      {icon === 'calendar' && (
        <Icon name="calendar" size={14} color={active ? '#FAF5EC' : 'var(--color-text-ter)'} />
      )}
      {label}
    </button>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--color-text-ter)',
        }}
      >
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          minHeight: 40,
          width: '100%',
          boxSizing: 'border-box',
          padding: '0 10px',
          borderRadius: 10,
          border: '1px solid var(--color-border-2)',
          background: 'var(--color-surface-2)',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text)',
        }}
      />
    </label>
  )
}
