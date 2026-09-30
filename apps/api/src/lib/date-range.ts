/**
 * date-range — janela temporal (startDate/endDate) em UTC a partir de uma especificação de
 * período, sempre no fuso BRT (UTC-3). Fonte compartilhada de TODO relatório do admin.
 *
 * Extraído do padrão de `AdminFinancialService.getDateRange` (07-05) e estendido na onda
 * Financeiro/DRE com as três coisas que o preset não dava e o DRE exige:
 *
 *   1. **Mês fechado** — "agosto inteiro", não "agosto até agora". Um DRE de mês em curso não
 *      fecha com extrato nenhum, e exibido sem ressalva é lido como fechamento.
 *   2. **Intervalo arbitrário** — 01/07 a 15/08.
 *   3. **Período anterior equivalente** — o comparativo. É em {@link previousWindow} que mora
 *      toda a sutileza; ver o comentário lá.
 *
 * Retrocompatibilidade é requisito, não cortesia: {@link getDateRange} continua com a assinatura
 * e o comportamento exatos de antes, porque os 8 relatórios já entregues e os testes deles a usam.
 *
 * O offset é fixo em −3h: o Brasil não tem horário de verão desde 2019, mesma premissa que
 * `lib/cutoff.ts` já assume no resto do sistema.
 */

export type ReportPeriod = 'day' | 'week' | 'month'

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const

/** Como a janela foi pedida. É o que {@link previousWindow} precisa para saber a regra do comparativo. */
export type PeriodSpec =
  /** Atalho legado: início do dia/semana/mês BRT até AGORA. */
  | { kind: 'preset'; period: ReportPeriod }
  /** Mês de competência "YYYY-MM". Fechado quando já passou; parcial quando é o mês em curso. */
  | { kind: 'month'; month: string }
  /** Intervalo de datas BRT "YYYY-MM-DD", com `to` INCLUSIVO. */
  | { kind: 'range'; from: string; to: string }

export interface DateWindow {
  startDate: Date
  endDate: Date
  /** Rótulo pt-BR para cabeçalho de tela e de exportação (ex.: "agosto de 2026"). */
  label: string
  /**
   * `true` quando a janela termina em "agora" — período EM CURSO, não fechado. O DRE e o painel
   * precisam declarar isso: resultado parcial exibido sem ressalva é lido como fechamento.
   */
  isPartial: boolean
  /** A especificação que gerou a janela — mantém o objeto autodescritivo. */
  spec: PeriodSpec
}

/** Preset cru (legado dos 8 relatórios) ou janela já resolvida. */
export type PeriodInput = ReportPeriod | DateWindow

// ─────────────────────────────────────────────────────────── helpers de calendário BRT

/** Instante UTC de 00:00 BRT do dia (y, mês 0-based, d). Overflow de mês/dia é normalizado. */
function brtMidnightUtc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d) + BRT_OFFSET_MS)
}

/** Componentes do calendário BRT de um instante UTC. */
function brtParts(at: Date): { y: number; m: number; d: number; weekday: number } {
  const s = new Date(at.getTime() - BRT_OFFSET_MS)
  return { y: s.getUTCFullYear(), m: s.getUTCMonth(), d: s.getUTCDate(), weekday: s.getUTCDay() }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** "YYYY-MM" a partir de ano + mês 0-based (normaliza mês fora da faixa). */
export function monthKey(y: number, m: number): string {
  const ny = y + Math.floor(m / 12)
  const nm = ((m % 12) + 12) % 12
  return `${ny}-${pad2(nm + 1)}`
}

/** "DD/MM/AAAA" do dia BRT de um instante. */
function fmtDayBrt(at: Date): string {
  const { y, m, d } = brtParts(at)
  return `${pad2(d)}/${pad2(m + 1)}/${y}`
}

// ─────────────────────────────────────────────────────────── construtores de janela

/** Janela de um preset: início do dia/semana/mês BRT até `now`. Sempre parcial, por definição. */
export function presetWindow(period: ReportPeriod, now: Date = new Date()): DateWindow {
  const { y, m, d, weekday } = brtParts(now)

  let startDate: Date
  let label: string
  if (period === 'day') {
    startDate = brtMidnightUtc(y, m, d)
    label = 'hoje'
  } else if (period === 'week') {
    const daysFromMonday = weekday === 0 ? 6 : weekday - 1
    startDate = brtMidnightUtc(y, m, d - daysFromMonday)
    label = 'esta semana'
  } else {
    startDate = brtMidnightUtc(y, m, 1)
    label = 'este mês'
  }

  return { startDate, endDate: now, label, isPartial: true, spec: { kind: 'preset', period } }
}

/**
 * Janela de um mês de competência ("YYYY-MM").
 *
 * Mês já encerrado → janela FECHADA (dia 1 até o dia 1 do mês seguinte), que é o que o DRE precisa.
 * Mês em curso → fecha em `now` e marca `isPartial`, para o mês corrente não se passar por
 * fechado e comparável com os anteriores.
 */
export function monthWindow(month: string, now: Date = new Date()): DateWindow {
  if (!MONTH_RE.test(month)) {
    throw new RangeError('month deve estar no formato YYYY-MM')
  }
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) - 1

  const startDate = brtMidnightUtc(y, m, 1)
  const nextMonth = brtMidnightUtc(y, m + 1, 1)
  const isPartial = now < nextMonth

  // Mês inteiramente no futuro: janela VAZIA (start === end), nunca invertida — uma janela com
  // endDate < startDate faria todo `gte/lte` do Prisma devolver silenciosamente zero.
  const endDate = isPartial ? new Date(Math.max(now.getTime(), startDate.getTime())) : nextMonth

  return {
    startDate,
    endDate,
    label: `${MONTH_NAMES[m]} de ${y}`,
    isPartial,
    spec: { kind: 'month', month },
  }
}

/**
 * Janela de um intervalo de datas BRT, com `to` **inclusivo**.
 *
 * Inclusivo porque é o que o admin espera: quem digita "até 15/08" quer o dia 15 inteiro dentro.
 * Por isso a janela fecha na meia-noite BRT do dia SEGUINTE ao `to`.
 */
export function rangeWindow(from: string, to: string, now: Date = new Date()): DateWindow {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    throw new RangeError('from e to devem estar no formato YYYY-MM-DD')
  }
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)

  const startDate = brtMidnightUtc(fy, fm - 1, fd)
  const endDate = brtMidnightUtc(ty, tm - 1, td + 1)
  if (endDate <= startDate) {
    throw new RangeError('to deve ser igual ou posterior a from')
  }

  return {
    startDate,
    endDate,
    label: `${pad2(fd)}/${pad2(fm)}/${fy} a ${pad2(td)}/${pad2(tm)}/${ty}`,
    // Intervalo que avança sobre o futuro é parcial: os dias que faltam simplesmente não têm dado.
    isPartial: endDate > now,
    spec: { kind: 'range', from, to },
  }
}

/** Resolve qualquer especificação numa janela. */
export function resolveWindow(spec: PeriodSpec, now: Date = new Date()): DateWindow {
  switch (spec.kind) {
    case 'preset':
      return presetWindow(spec.period, now)
    case 'month':
      return monthWindow(spec.month, now)
    case 'range':
      return rangeWindow(spec.from, spec.to, now)
  }
}

/**
 * Normaliza a entrada dos serviços de relatório: aceita o preset cru (como os 8 relatórios já
 * chamam hoje) ou uma janela pronta. É o que permite estender sem tocar em nenhum chamador.
 */
export function toWindow(input: PeriodInput, now: Date = new Date()): DateWindow {
  return typeof input === 'string' ? presetWindow(input, now) : input
}

/**
 * `getDateRange` — atalho legado, preservado byte a byte no comportamento.
 *
 * Continua existindo porque é a assinatura que `AdminReportsService` e os testes dele usam em 8
 * pontos. Código novo deve preferir {@link resolveWindow}/{@link toWindow}, que trazem `label` e
 * `isPartial` — os dois campos sem os quais a tela não sabe dizer se o número é fechado.
 */
export function getDateRange(period: ReportPeriod): { startDate: Date; endDate: Date } {
  const { startDate, endDate } = presetWindow(period)
  return { startDate, endDate }
}

// ─────────────────────────────────────────────────────────── comparativo

/**
 * Janela EQUIVALENTE imediatamente anterior — a base de todo comparativo do módulo.
 *
 * "Equivalente" é o ponto inteiro desta função, e é exatamente o que o painel errava: ele comparava
 * hoje com ONTEM (`revenueTrendPct`), então toda segunda-feira aparecia despencando contra o domingo
 * e todo domingo subindo contra o sábado — ruído de calendário exibido como tendência.
 *
 * As regras, por forma de janela:
 *
 *   - preset `day` → o **mesmo dia da semana**, 7 dias antes. Segunda compara com segunda.
 *   - preset `week` → a semana anterior, no mesmo ponto de avanço.
 *   - preset `month` e **mês em curso** → o mês anterior **até o mesmo ponto de avanço**
 *     (month-to-date × month-to-date). Nunca o mês anterior inteiro: 10 dias de setembro contra
 *     31 de agosto daria −68% de pura mentira.
 *   - **mês fechado** → o mês anterior inteiro.
 *   - intervalo → o mesmo número de dias, imediatamente antes.
 */
export function previousWindow(w: DateWindow): DateWindow {
  const { spec } = w

  if (spec.kind === 'preset' && (spec.period === 'day' || spec.period === 'week')) {
    // 7 dias exatos preservam o dia da semana nos dois casos — e atravessam virada de mês e de
    // ano sem aritmética de calendário.
    return {
      startDate: new Date(w.startDate.getTime() - 7 * DAY_MS),
      endDate: new Date(w.endDate.getTime() - 7 * DAY_MS),
      label: spec.period === 'day' ? 'mesmo dia da semana anterior' : 'semana anterior',
      isPartial: w.isPartial,
      spec,
    }
  }

  if (spec.kind === 'range') {
    const span = w.endDate.getTime() - w.startDate.getTime()
    return {
      startDate: new Date(w.startDate.getTime() - span),
      endDate: w.startDate,
      label: 'período anterior',
      isPartial: false,
      spec,
    }
  }

  // Preset 'month' e kind 'month' caem na mesma regra de mês anterior.
  const { y, m } = brtParts(w.startDate)
  const prevStart = brtMidnightUtc(y, m - 1, 1)
  const prevLabel = `${MONTH_NAMES[((m - 1) % 12 + 12) % 12]} de ${m === 0 ? y - 1 : y}`

  if (w.isPartial) {
    // Mesmo ponto de avanço. O clamp em `w.startDate` importa: fevereiro tem 28 dias, e um mês
    // corrente já em 30 dias de avanço transbordaria para dentro do mês atual, contando o mesmo
    // intervalo nas duas janelas do comparativo.
    const elapsed = w.endDate.getTime() - w.startDate.getTime()
    return {
      startDate: prevStart,
      endDate: new Date(Math.min(prevStart.getTime() + elapsed, w.startDate.getTime())),
      label: `${prevLabel} (mesmo ponto)`,
      isPartial: true,
      spec: { kind: 'month', month: monthKey(y, m - 1) },
    }
  }

  return {
    startDate: prevStart,
    endDate: w.startDate,
    label: prevLabel,
    isPartial: false,
    spec: { kind: 'month', month: monthKey(y, m - 1) },
  }
}

/**
 * Variação percentual entre o período e o anterior, com 1 casa decimal.
 *
 * `null` quando a base é zero — e isso é deliberado: 0 → 10 não é "+1000%", é "saiu do zero", e
 * `Infinity` renderizado numa tela é pior que a ausência do número. Quem exibe decide o rótulo
 * (o painel mostra "novo").
 */
export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}

/** Descritor enxuto da janela no payload das rotas (ISO + rótulo + se está em curso). */
export interface WindowDescriptor {
  from: string
  to: string
  label: string
  isPartial: boolean
}

/**
 * O preset que originou a janela, ou `undefined` quando ela veio de `month`/`range`.
 *
 * Serve para manter o campo `period` das respostas existentes sem mentir: uma janela de intervalo
 * arbitrário não É um preset, e devolver `'month'` ali só para preencher o campo produziria um
 * payload que se contradiz.
 */
export function presetOf(w: DateWindow): ReportPeriod | undefined {
  return w.spec.kind === 'preset' ? w.spec.period : undefined
}

export function windowDescriptor(w: DateWindow): WindowDescriptor {
  return {
    from: w.startDate.toISOString(),
    to: w.endDate.toISOString(),
    label: w.label,
    isPartial: w.isPartial,
  }
}

/** Dia BRT ("DD/MM/AAAA") de um instante — exposto para cabeçalho de PDF/Excel. */
export { fmtDayBrt }
