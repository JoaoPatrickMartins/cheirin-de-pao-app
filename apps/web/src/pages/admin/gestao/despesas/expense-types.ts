/**
 * Tipos e helpers do módulo de despesas (Fase 1 do plano-financeiro-vendas).
 *
 * Os rótulos e a ordem dos grupos vêm de `@cheirin-de-pao/shared` — a mesma fonte que a API usa
 * para montar as linhas do DRE, para tela e demonstração nunca discordarem sobre onde uma
 * categoria entra.
 */
import type { ExpenseGroup, ExpenseStatus } from '@cheirin-de-pao/shared'

export interface ExpenseCategory {
  id: string
  name: string
  group: ExpenseGroup
  isFixed: boolean
  emoji?: string | null
  sortOrder: number
  isActive: boolean
}

export interface Expense {
  id: string
  categoryId: string
  description: string
  amount: number
  competenceDate: string
  dueDate?: string | null
  paidAt?: string | null
  status: ExpenseStatus
  supplierId?: string | null
  payee?: string | null
  paymentMethod?: string | null
  condominiumId?: string | null
  receiptUrl?: string | null
  notes?: string | null
  recurrenceId?: string | null
  previousAmount?: number | null
  // Decorados pelo serviço, numa consulta por coleção (o Mongo não faz join barato).
  categoryName: string
  categoryGroup: ExpenseGroup
  categoryEmoji?: string | null
  categoryIsFixed: boolean
  supplierName?: string | null
  condominiumName?: string | null
  /** Só em contas a pagar: atraso comparado por DIA BRT. */
  isOverdue?: boolean
  /**
   * Origem da linha de contas a pagar (B5). `PURCHASE` é uma compra ao fornecedor ainda não paga —
   * ela NÃO é um `Expense` (criar um espelho faria o DRE contar a compra duas vezes), e por isso
   * o pagamento vai para outro endpoint.
   */
  sourceKind?: 'EXPENSE' | 'PURCHASE'
}

export interface ExpenseRecurrence {
  id: string
  categoryId: string
  description: string
  amount: number
  dayOfMonth: number
  payee?: string | null
  startsAt: string
  endsAt?: string | null
  isActive: boolean
  categoryName: string
  categoryGroup: ExpenseGroup
  categoryEmoji?: string | null
}

export const fmtBRL = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

/** ISO → "DD/MM" no calendário BRT. */
export function fmtDayShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(d)
}

/** ISO → "AAAA-MM-DD" BRT — o formato que os campos `<input type="date">` e a API usam. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

/** Mês corrente em BRT ("AAAA-MM"). */
export function currentMonthBrt(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
    .format(new Date())
    .slice(0, 7)
}

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** "2026-08" → "Agosto de 2026". */
export function monthLabel(month: string): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) - 1
  const name = MONTH_NAMES[m] ?? month
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`
}

/** Mês anterior/seguinte a partir de "AAAA-MM". */
export function shiftMonth(month: string, delta: number): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) - 1
  const d = new Date(Date.UTC(y, m + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export const STATUS_LABEL: Record<ExpenseStatus, string> = {
  PENDING: 'A pagar',
  PAID: 'Paga',
  CANCELLED: 'Cancelada',
}
