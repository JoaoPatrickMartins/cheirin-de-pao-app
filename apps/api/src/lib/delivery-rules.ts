import type { PrismaClient } from '@prisma/client'
import {
  type AgendaRestrictions,
  type DiasBloqueados,
  type LimitePedidosDia,
  coerceDiasBloqueados,
  coerceLimitePedidosDia,
  getAgendaRestrictions,
} from './agenda-restrictions.js'
import { brtDateStr } from './cutoff.js'

/**
 * delivery-rules.ts — fonte ÚNICA das regras de disponibilidade de entrega, resolvidas POR
 * CONDOMÍNIO. Envolve a `agenda-restrictions.ts` (que segue sendo o leitor do padrão global) e
 * acrescenta os bloqueios de DATA/PERÍODO (`DeliveryBlock`).
 *
 * Duas camadas:
 *
 * 1. **Dia da semana** (`diasBloqueados` / `limitePedidosDia`). O `Setting` global é o PADRÃO;
 *    cada condomínio pode sobrescrever via `Condominium.blockedDaysOverride` /
 *    `dayLimitOverride`. Override AUSENTE = herda. A resolução é sempre EM CÓDIGO — no Mongo,
 *    `where: { campo: null }` não encontra documento sem a chave, então nunca filtramos por isso.
 *
 * 2. **Data/período** (`DeliveryBlock`). Bloqueio GLOBAL (`condominiumId` ausente) ou de um
 *    condomínio. Uma data está bloqueada se cair em QUALQUER um dos dois. Intervalo inclusivo,
 *    datas em "YYYY-MM-DD" (dia BRT) — comparação lexicográfica == cronológica.
 *
 * O CORTE (`cutoffTime`) NÃO passa por aqui: continua global por turno (ver `delivery-slots.ts`),
 * porque o pipeline de pedido ao fornecedor assume um corte único por (turno, data).
 */

// ------------------------------------------------------------------ dia da semana

/** De onde veio cada seção das regras resolvidas — a UI do admin usa para o badge "herdado". */
export interface RulesSource {
  blocked: 'global' | 'condo'
  limits: 'global' | 'condo'
}

export interface ResolvedRules extends AgendaRestrictions {
  source: RulesSource
}

/** Overrides como vêm do documento do condomínio (campos `Json?` do Prisma). */
export interface CondoOverrides {
  blockedDaysOverride?: unknown
  dayLimitOverride?: unknown
}

/**
 * Um override só "existe" quando é um objeto de verdade. `null`/`undefined` (chave ausente no
 * Mongo) e valores escalares degradam para herança — nunca lança.
 */
function hasOverride(v: unknown): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Resolve as regras de um condomínio a partir do padrão global + overrides. Função PURA —
 * o ponto único onde a herança é decidida.
 */
export function resolveCondoRules(
  global: AgendaRestrictions,
  overrides?: CondoOverrides | null,
): ResolvedRules {
  const blockedOverridden = hasOverride(overrides?.blockedDaysOverride)
  const limitsOverridden = hasOverride(overrides?.dayLimitOverride)
  return {
    blocked: blockedOverridden
      ? coerceDiasBloqueados(overrides!.blockedDaysOverride)
      : global.blocked,
    limits: limitsOverridden
      ? coerceLimitePedidosDia(overrides!.dayLimitOverride)
      : global.limits,
    source: {
      blocked: blockedOverridden ? 'condo' : 'global',
      limits: limitsOverridden ? 'condo' : 'global',
    },
  }
}

type RulesPrisma = Pick<PrismaClient, 'setting' | 'condominium'>

/**
 * Regras resolvidas de um condomínio (override ?? padrão global). Sem `condominiumId`
 * (cliente sem condomínio, telas globais do admin) devolve o padrão global puro.
 */
export async function getRulesForCondo(
  prisma: RulesPrisma,
  condominiumId?: string | null,
): Promise<ResolvedRules> {
  const global = await getAgendaRestrictions(prisma)
  if (!condominiumId) {
    return { ...global, source: { blocked: 'global', limits: 'global' } }
  }
  const condo = await prisma.condominium.findUnique({
    where: { id: condominiumId },
    select: { blockedDaysOverride: true, dayLimitOverride: true },
  })
  return resolveCondoRules(global, condo)
}

/** Reexport de conveniência — os chokepoints importam tudo de `delivery-rules`. */
export type { DiasBloqueados, LimitePedidosDia, AgendaRestrictions }
export { isDayBlocked } from './agenda-restrictions.js'

// ------------------------------------------------------------------ bloqueios de data

/** Um bloqueio de data/período. `condominiumId` nulo/ausente = global. */
export interface DeliveryBlockRow {
  id: string
  condominiumId: string | null
  startDate: string
  endDate: string
  reason: string | null
}

type BlocksPrisma = Pick<PrismaClient, 'deliveryBlock'>

/**
 * Filtro de escopo: os bloqueios do condomínio MAIS os globais.
 *
 * Um bloqueio global é gravado sem `condominiumId`. No Mongo, `{ condominiumId: null }` NÃO
 * encontra o documento que não tem a chave — por isso as duas variantes (`null` explícito e
 * `isSet: false`) entram no OR. Sem `condominiumId`, só os globais valem.
 */
function scopeWhere(condominiumId?: string | null) {
  const globalScopes = [{ condominiumId: null }, { condominiumId: { isSet: false } }]
  return condominiumId
    ? { OR: [{ condominiumId }, ...globalScopes] }
    : { OR: globalScopes }
}

/**
 * Bloqueios (do condomínio + globais) que cobrem QUALQUER data do intervalo `[fromStr, toStr]`.
 *
 * Sobreposição de intervalos: `startDate <= toStr && endDate >= fromStr`. Uma leitura serve para
 * uma janela inteira — é assim que a régua de datas e o cron evitam N+1.
 */
export async function listBlocksOverlapping(
  prisma: BlocksPrisma,
  condominiumId: string | null | undefined,
  fromStr: string,
  toStr: string,
): Promise<DeliveryBlockRow[]> {
  const rows = await prisma.deliveryBlock.findMany({
    where: {
      ...scopeWhere(condominiumId),
      startDate: { lte: toStr },
      endDate: { gte: fromStr },
    },
    orderBy: { startDate: 'asc' },
  })
  return rows.map((r) => ({
    id: r.id,
    condominiumId: r.condominiumId ?? null,
    startDate: r.startDate,
    endDate: r.endDate,
    reason: r.reason ?? null,
  }))
}

/**
 * O bloqueio que cobre `dateStr` numa lista já carregada, ou `null`. Função PURA.
 * Prefere o bloqueio do condomínio ao global (o motivo local é mais informativo).
 */
export function findBlockForDate(
  blocks: DeliveryBlockRow[],
  dateStr: string,
): DeliveryBlockRow | null {
  const hits = blocks.filter((b) => b.startDate <= dateStr && dateStr <= b.endDate)
  if (hits.length === 0) return null
  return hits.find((b) => b.condominiumId !== null) ?? hits[0]
}

/** O bloqueio que cobre `dateStr` para aquele condomínio (ou global), ou `null`. */
export async function getDateBlock(
  prisma: BlocksPrisma,
  condominiumId: string | null | undefined,
  dateStr: string,
): Promise<DeliveryBlockRow | null> {
  const blocks = await listBlocksOverlapping(prisma, condominiumId, dateStr, dateStr)
  return findBlockForDate(blocks, dateStr)
}

/** Mensagem única (pt-BR) para uma data bloqueada — mesma frase em todos os chokepoints. */
export function blockedDateMessage(block: DeliveryBlockRow): string {
  const [, mes, dia] = block.startDate.split('-')
  const periodo = block.startDate === block.endDate
    ? `${dia}/${mes}`
    : `${dia}/${mes} a ${block.endDate.slice(8, 10)}/${block.endDate.slice(5, 7)}`
  return block.reason
    ? `Não há entregas nesta data (${block.reason}). Período bloqueado: ${periodo}.`
    : `Não há entregas nesta data. Período bloqueado: ${periodo}.`
}

// ------------------------------------------------------------------ validação de entrada

/** "YYYY-MM-DD" bem formado (e uma data de calendário real). */
export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  // Rejeita 31/02 e afins comparando com a data reconstruída em UTC.
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/**
 * Valida um bloqueio antes de gravar. Regras: datas bem formadas, `endDate >= startDate` e nada
 * no passado (o dia de hoje BRT é aceito — dá para bloquear o resto de hoje).
 * @returns mensagem de erro, ou `null` se válido.
 */
export function validateBlockRange(
  startDate: string,
  endDate: string,
  now: Date = new Date(),
): string | null {
  if (!isValidDateStr(startDate) || !isValidDateStr(endDate)) {
    return 'Data inválida. Use o formato AAAA-MM-DD.'
  }
  if (endDate < startDate) {
    return 'A data final não pode ser anterior à inicial.'
  }
  if (endDate < brtDateStr(now, 0)) {
    return 'Não é possível bloquear um período que já passou.'
  }
  return null
}
