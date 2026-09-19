/**
 * product-availability.ts — quando um produto da Cestinha aceita pedido, e por que não aceita.
 *
 * São DOIS mecanismos diferentes, que compõem por OR e não se apagam:
 *
 *  1. HORÁRIO DE VENDA (`availableUntil` = fecha, `availableFrom` = reabre) — RELÓGIO DE LOJA,
 *     absoluto: dentro da janela o produto vende, fora dela fica indisponível, para qualquer data
 *     de entrega. Abre e fecha nos horários que o admin digitou e em nenhum outro.
 *
 *  2. PAUSA MANUAL (`isPaused`/`pausedUntil`) — derruba o item AGORA. Com prazo, despausa sozinha
 *     ao passar do instante; sem prazo, o admin religa na mão. Quando a pausa com prazo expira,
 *     o horário de venda volta a mandar.
 *
 * NÃO CONFUNDIR com `availableDays` (os chips Seg/Ter/Qua), que é relativo à DATA DE ENTREGA e
 * continua sendo validado no checkout: os dias dizem quando o produto pode CHEGAR, o horário diz
 * quando ele pode ser COMPRADO.
 *
 * HISTÓRICO: até 19/09/2026 o horário era um corte por CICLO DE ENTREGA (entrava no lugar do
 * `cutoffTime` do turno). O UAT mostrou que aquilo não entrega o que o controle aparenta fazer —
 * o produto reabria num horário derivado do turno (10:00 ou 22:00), nunca no que foi configurado,
 * e não bloqueava nada quando o condomínio não tinha turno ativo. Ver
 * `.projeto/docs/plano-correcao-horario-de-venda.md`.
 *
 * Tudo é DERIVADO de `now` na leitura — nada de cron escrevendo flag. Não existe minuto perdido em
 * deploy ou queda, não precisa de backfill, a precisão é ao segundo e a regra inteira é função
 * pura com relógio injetável.
 *
 * O cliente nunca vê nada disso: as três causas (sem estoque, pausado, fora do horário) colapsam
 * numa palavra só — "Esgotado". Só o admin recebe estado, motivo e hora da volta.
 */

import { nowHHMM } from './cutoff.js'
import { isPromoVigente, type PromoFields } from './product-pricing.js'

/** Os campos de disponibilidade de um Product. Nullable: documentos antigos não os têm. */
export interface AvailabilityFields {
  /** Hora em que o produto REABRE ("HH:MM" BRT). null = não tem reabertura própria. */
  availableFrom?: string | null
  /** Hora em que o produto FECHA ("HH:MM" BRT). null = não fecha por horário. */
  availableUntil?: string | null
  isPaused?: boolean | null
  pausedUntil?: Date | null
  isNew?: boolean | null
  newUntil?: Date | null
}

export type PauseReason = 'manual' | 'temporaria' | 'horario'
export type AvailabilityState = 'inativo' | 'pausado' | 'esgotado' | 'ativo'

export interface PauseInfo {
  paused: boolean
  reason: PauseReason | null
  /** Instante da volta; `null` = sem previsão (pausa sem prazo). */
  until: Date | null
}

const NOT_PAUSED: PauseInfo = { paused: false, reason: null, until: null }

// ── 1. Pausa manual ─────────────────────────────────────────────────────────

/**
 * Pausa imediata: bloqueia agora, para qualquer data de entrega.
 * A pausa SEM prazo (`isPaused`) tem precedência: se o admin religou na mão, um `pausedUntil`
 * velho e já expirado não deve ressuscitar nada.
 */
export function vitrinePause(p: AvailabilityFields, now: Date = new Date()): PauseInfo {
  if (p.isPaused === true) return { paused: true, reason: 'manual', until: null }
  if (p.pausedUntil && p.pausedUntil.getTime() > now.getTime()) {
    return { paused: true, reason: 'temporaria', until: p.pausedUntil }
  }
  return NOT_PAUSED
}

// ── 2. Horário de venda (relógio de loja) ───────────────────────────────────

/**
 * O produto está dentro do horário de venda AGORA?
 *
 * Comparação lexicográfica de "HH:MM" zero-padded (= cronológica), a mesma convenção que a régua
 * de corte usa em todo lugar. `f` = reabre, `u` = fecha.
 *
 *   sem nenhum  → sempre aberto
 *   só `f`      → fechado da meia-noite até f
 *   só `u`      → fechado de u até a meia-noite
 *   f <  u      → janela normal: aberto [f, u)
 *   f >  u      → CRUZA a meia-noite: fechado [u, f) — "fecha 20:00, reabre 22:00"
 *
 * `f === u` é recusado na escrita (seria janela de duração zero ou de 24h, ambíguo).
 */
export function isWithinStoreHours(p: AvailabilityFields, now: Date = new Date()): boolean {
  const f = p.availableFrom || null
  const u = p.availableUntil || null
  if (!f && !u) return true

  const h = nowHHMM(now)
  if (f && !u) return h >= f
  if (!f && u) return h < u
  // Os dois presentes: a ordem entre eles decide se a janela cruza a meia-noite.
  return (f as string) < (u as string) ? h >= (f as string) && h < (u as string) : h >= (f as string) || h < (u as string)
}

/**
 * Próximo instante em que o produto REABRE pelo horário de venda.
 *
 * Com `availableFrom`, é a próxima vez que o relógio bate nessa hora (hoje se ainda não passou,
 * senão amanhã). Sem ele, o fechamento vai até a meia-noite, então a volta é a próxima meia-noite.
 * `null` quando o produto não fecha por horário — não há o que reabrir.
 */
export function nextOpening(p: AvailabilityFields, now: Date = new Date()): Date | null {
  if (!p.availableFrom && !p.availableUntil) return null
  return nextClockInstant(p.availableFrom || '00:00', now)
}

/** Próximo instante (UTC) em que o relógio BRT bate `hhmm` — hoje se ainda à frente, senão amanhã. */
function nextClockInstant(hhmm: string, now: Date): Date {
  const BRT_OFFSET_MS = 3 * 60 * 60 * 1000
  const brt = new Date(now.getTime() - BRT_OFFSET_MS)
  const [h, m] = hhmm.split(':').map(Number)
  const jaPassou = nowHHMM(now) >= hhmm
  return new Date(
    Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate() + (jaPassou ? 1 : 0), h + 3, m, 0, 0),
  )
}

/** O horário de venda está bloqueando este produto? E, se sim, até quando? */
export function storeHoursBlock(
  p: AvailabilityFields,
  now: Date = new Date(),
): { blocked: boolean; until: Date | null } {
  if (isWithinStoreHours(p, now)) return { blocked: false, until: null }
  return { blocked: true, until: nextOpening(p, now) }
}

/** O produto aceita pedido neste instante? Junta pausa manual e horário de venda. */
export function acceptsOrder(p: AvailabilityFields, now: Date = new Date()): boolean {
  if (vitrinePause(p, now).paused) return false
  return isWithinStoreHours(p, now)
}

// ── 4. Estado consolidado ───────────────────────────────────────────────────

export interface AdminAvailability {
  state: AvailabilityState
  reason: PauseReason | null
  /** ISO do instante da volta; `null` = sem previsão. */
  until: string | null
}

/**
 * Estado do produto na visão do ADMIN — com motivo e hora da volta.
 *
 * Prioridade: inativo → pausado → esgotado → ativo. "Inativo" primeiro porque arquivado é um
 * estado mais forte que pausado (o item nem aparece na vitrine); "pausado" antes de "esgotado"
 * porque é a decisão de alguém, e é isso que o admin precisa reconhecer e desfazer.
 */
export function availabilityOf(
  p: AvailabilityFields,
  opts: { isActive: boolean; outOfStock: boolean },
  now: Date = new Date(),
): AdminAvailability {
  if (!opts.isActive) return { state: 'inativo', reason: null, until: null }

  const vitrine = vitrinePause(p, now)
  if (vitrine.paused) {
    return { state: 'pausado', reason: vitrine.reason, until: vitrine.until?.toISOString() ?? null }
  }

  const horario = storeHoursBlock(p, now)
  if (horario.blocked) {
    return { state: 'pausado', reason: 'horario', until: horario.until?.toISOString() ?? null }
  }

  if (opts.outOfStock) return { state: 'esgotado', reason: null, until: null }
  return { state: 'ativo', reason: null, until: null }
}

/**
 * O `soldOut` do CLIENTE: as três causas (sem estoque, pausado, fora do horário) numa palavra só.
 * É o que faz o card ficar visível e não-comprável sem nunca revelar que alguém pausou o item.
 */
export function isUnavailableForClient(
  p: AvailabilityFields,
  opts: { outOfStock: boolean },
  now: Date = new Date(),
): boolean {
  if (opts.outOfStock) return true
  return !acceptsOrder(p, now)
}

// ── 5. Novidade ─────────────────────────────────────────────────────────────

/**
 * Prazo padrão do selo de novidade, em dias. Um selo que não expira deixa de ser novidade: daqui
 * a três meses a vitrine teria seis "novidades" de abril. Por isso marcar sem dizer o prazo
 * aplica este default — "até eu remover" existe, mas precisa ser uma escolha explícita.
 */
export const DEFAULT_NOVIDADE_DAYS = 14


/** Instante de expiração para `DEFAULT_NOVIDADE_DAYS` (ou outro número de dias) a partir de agora. */
export function novidadeExpiryFromNow(days: number = DEFAULT_NOVIDADE_DAYS, now: Date = new Date()): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}

/**
 * O selo de novidade está valendo? `newUntil` ausente com `isNew` ligado = "até eu remover".
 *
 * Precisa ser avaliado em runtime (e não no `orderBy` do banco): o banco não sabe que a data
 * expirou, e uma novidade vencida continuaria ordenando na frente para sempre.
 */
export function isNovidadeVigente(p: AvailabilityFields, now: Date = new Date()): boolean {
  if (p.isNew !== true) return false
  return p.newUntil == null || p.newUntil.getTime() > now.getTime()
}

// ── 6. Ordem da vitrine ─────────────────────────────────────────────────────

/**
 * Degrau de um produto na vitrine. Menor sobe.
 *
 *   0 — novidade vigente
 *   1 — promoção vigente COM destaque (`promoPriority`)
 *   2 — todo o resto, incluindo promoção sem destaque (tem selo, não fura fila)
 *
 * Novidade ganha de promoção quando o produto é as duas coisas — a mesma precedência que decide
 * qual selo o card mostra, para a ordem e o selo nunca contarem histórias diferentes.
 *
 * O Pão Francês não entra: ele tem card próprio, renderizado fora da grade e sempre primeiro.
 */
export function vitrineRank<T extends AvailabilityFields & PromoFields>(p: T, now: Date = new Date()): 0 | 1 | 2 {
  if (isNovidadeVigente(p, now)) return 0
  if (p.promoPriority === true && isPromoVigente(p, now)) return 1
  return 2
}

/**
 * Ordena a vitrine pelos três degraus, preservando a ordem recebida dentro de cada um
 * (`Array.prototype.sort` é estável) — o banco já entrega tudo por `[sortOrder, name]`.
 *
 * Precisa ser em runtime e não no `orderBy`: o banco não sabe que um `newUntil` ou um
 * `promoUntil` venceu, e uma novidade de abril continuaria no topo para sempre.
 */
export function sortVitrine<T extends AvailabilityFields & PromoFields>(
  products: T[],
  now: Date = new Date(),
): T[] {
  return [...products].sort((a, b) => vitrineRank(a, now) - vitrineRank(b, now))
}
