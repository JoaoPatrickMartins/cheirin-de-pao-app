import type { PrismaClient } from '@prisma/client'
import { type DayKey, brtDateStr, brtNoonFromStr, dayKeyOf } from './cutoff.js'

/**
 * agenda-restrictions.ts — restrições de agendamento por dia da semana definidas pelo admin.
 *
 * Duas configs no `Setting` (key/value, JSON `{seg..dom}` — mesmo padrão de `pedidoMinimoAgenda`):
 *  - `diasBloqueados`: dia com `true` NÃO aceita entregas (pedido único, agenda e corte).
 *  - `limitePedidosDia`: máximo de ENTREGAS por dia da semana; `0` = ilimitado.
 *
 * Estas são o **PADRÃO** da operação. Cada condomínio pode sobrescrever as duas
 * (`Condominium.blockedDaysOverride` / `dayLimitOverride`) — a resolução da herança e os
 * bloqueios de DATA/período vivem em `delivery-rules.ts`, que é por onde os chokepoints entram.
 * Este módulo segue sendo o leitor/parser do padrão global e a fonte dos rótulos de dia.
 *
 * Parse sempre defensivo — chave ausente/malformada degrada para "sem restrição" (nunca lança).
 */

/** Ordem canônica dos dias — usada em labels e iteração. */
export const WEEKDAY_ORDER: DayKey[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

/** Rótulos curtos (pt-BR) por dia — para mensagens de erro/aviso. */
export const WEEKDAY_LABEL: Record<DayKey, string> = {
  seg: 'Seg',
  ter: 'Ter',
  qua: 'Qua',
  qui: 'Qui',
  sex: 'Sex',
  sab: 'Sáb',
  dom: 'Dom',
}

export type DiasBloqueados = Record<DayKey, boolean>
export type LimitePedidosDia = Record<DayKey, number>

export interface AgendaRestrictions {
  blocked: DiasBloqueados
  limits: LimitePedidosDia
}

/** Objeto `{seg..dom}` a partir de um objeto já desserializado, aplicando `map` (ausente → default). */
function coerceWeekdayMap<T>(obj: unknown, map: (v: unknown) => T): Record<DayKey, T> {
  const parsed: Record<string, unknown> =
    obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : {}
  return {
    seg: map(parsed.seg),
    ter: map(parsed.ter),
    qua: map(parsed.qua),
    qui: map(parsed.qui),
    sex: map(parsed.sex),
    sab: map(parsed.sab),
    dom: map(parsed.dom),
  }
}

/** Objeto `{seg..dom}` a partir de um raw JSON (string), aplicando `map` a cada valor. */
function parseWeekdayMap<T>(raw: string | null | undefined, map: (v: unknown) => T): Record<DayKey, T> {
  let obj: unknown = null
  if (raw) {
    try {
      obj = JSON.parse(raw)
    } catch {
      // JSON inválido → todos os dias no default
    }
  }
  return coerceWeekdayMap(obj, map)
}

const blockedValue = (v: unknown): boolean => v === true || v === 'true'

const limitValue = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

/** Parse dos dias bloqueados. Só `true` (boolean ou "true") bloqueia; qualquer outra coisa = liberado. */
export function parseDiasBloqueados(raw: string | null | undefined): DiasBloqueados {
  return parseWeekdayMap(raw, blockedValue)
}

/** Parse dos limites por dia. Cada valor é clampado para inteiro >= 0; ausente/inválido → 0 (ilimitado). */
export function parseLimitePedidosDia(raw: string | null | undefined): LimitePedidosDia {
  return parseWeekdayMap(raw, limitValue)
}

/**
 * Mesma coerção de `parseDiasBloqueados`, mas a partir de um OBJETO já desserializado —
 * usado pelos overrides por condomínio, que chegam como `Json` do Prisma (não string).
 */
export function coerceDiasBloqueados(obj: unknown): DiasBloqueados {
  return coerceWeekdayMap(obj, blockedValue)
}

/** Mesma coerção de `parseLimitePedidosDia`, a partir de um objeto já desserializado. */
export function coerceLimitePedidosDia(obj: unknown): LimitePedidosDia {
  return coerceWeekdayMap(obj, limitValue)
}

/**
 * Lê as restrições de agendamento (diasBloqueados + limitePedidosDia) do Setting.
 * Parse defensivo — chaves ausentes caem no default (nada bloqueado, sem limite).
 */
export async function getAgendaRestrictions(
  prisma: Pick<PrismaClient, 'setting'>,
): Promise<AgendaRestrictions> {
  const [blockedRow, limitsRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'diasBloqueados' } }),
    prisma.setting.findUnique({ where: { key: 'limitePedidosDia' } }),
  ])
  return {
    blocked: parseDiasBloqueados(blockedRow?.value),
    limits: parseLimitePedidosDia(limitsRow?.value),
  }
}

/** true se `dayKey` está bloqueado para entregas. */
export function isDayBlocked(blocked: DiasBloqueados, dayKey: DayKey): boolean {
  return blocked[dayKey] === true
}

/**
 * Data (meio-dia BRT) da PRÓXIMA ocorrência de um dia da semana a partir de `now` (inclusive hoje).
 * Usada como data representativa para checar a capacidade de um dia recorrente da agenda.
 */
export function nextDateForWeekday(dayKey: DayKey, now: Date = new Date()): Date {
  for (let i = 0; i < 7; i++) {
    const dateStr = brtDateStr(now, i)
    const d = brtNoonFromStr(dateStr)
    if (dayKeyOf(d) === dayKey) return d
  }
  // Inalcançável (um dos 7 dias sempre casa), mas mantém o tipo total.
  return brtNoonFromStr(brtDateStr(now, 0))
}
