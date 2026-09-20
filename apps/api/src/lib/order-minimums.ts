import type { PrismaClient } from '@prisma/client'
import type { DayKey } from './cutoff.js'
import { coerceWeekdayMap, parseWeekdayMap } from './agenda-restrictions.js'

/**
 * order-minimums.ts — fonte ÚNICA dos pedidos mínimos, resolvidos POR CONDOMÍNIO.
 *
 * Três regras, três `Setting` (o PADRÃO da operação):
 *  - `pedidoMinimoUnico`    — quantidade mínima de pães num pedido único. Vale também como
 *                             mínimo do Pão Francês dentro da Cestinha (`breadMin`).
 *  - `pedidoMinimoAgenda`   — mínimo por dia da semana na agenda; aplica-se POR TURNO quando a
 *                             quantidade do dia é > 0 (`0` = folga, sempre válido).
 *  - `marketMinimoCestinha` — valor mínimo em R$ da Cestinha, exigido só quando há produtos.
 *
 * Cada condomínio pode sobrescrever as três (`Condominium.pedidoMinimoUnicoOverride` /
 * `pedidoMinimoAgendaOverride` / `marketMinimoCestinhaOverride`). Override AUSENTE = herda.
 *
 * ATENÇÃO (Mongo): a resolução é SEMPRE em código (`override ?? global`) — `where: { campo: null }`
 * não encontra documento sem a chave, então nunca filtramos por isso. Mesmo contrato do
 * `delivery-rules.ts`, que é o precedente deste padrão.
 *
 * Parse sempre defensivo — chave ausente/malformada degrada para o default (nunca lança).
 */

export const PEDIDO_MINIMO_UNICO_KEY = 'pedidoMinimoUnico'
export const PEDIDO_MINIMO_AGENDA_KEY = 'pedidoMinimoAgenda'
export const MARKET_MINIMO_CESTINHA_KEY = 'marketMinimoCestinha'

/** Mínimo da Cestinha quando o Setting ainda não existe (mesmo default do seed). */
export const DEFAULT_MIN_CESTINHA = 15

/** Teto do mínimo do pedido único — casa com o `max` do Zod e do stepper da UI. */
const MAX_MIN_UNICO = 20
/** Teto do mínimo por dia da agenda — casa com o `max` do StepperInline da agenda. */
const MAX_MIN_AGENDA = 12

export type WeekdayMinimums = Record<DayKey, number>

export interface OrderMinimums {
  /** Pães por pedido único (e por Pão Francês na Cestinha). Sempre >= 1. */
  unico: number
  /** Mínimo por dia da semana na agenda, por turno. `0` = sem mínimo naquele dia. */
  agenda: WeekdayMinimums
  /** Valor mínimo da Cestinha em R$. `0` = sem mínimo. */
  cestinha: number
}

/** De onde veio cada mínimo — a UI do admin usa para o badge "herdado/personalizado". */
export interface MinimumsSource {
  unico: 'global' | 'condo'
  agenda: 'global' | 'condo'
  cestinha: 'global' | 'condo'
}

export interface ResolvedMinimums extends OrderMinimums {
  source: MinimumsSource
}

/** Overrides como vêm do documento do condomínio. */
export interface CondoMinimumOverrides {
  pedidoMinimoUnicoOverride?: unknown
  pedidoMinimoAgendaOverride?: unknown
  marketMinimoCestinhaOverride?: unknown
}

// ------------------------------------------------------------------ parse / coerção

/** Clamp de um dia da agenda: inteiro em [0..12]; ausente/inválido → 0 (sem mínimo). */
const agendaValue = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(MAX_MIN_AGENDA, Math.floor(n))
}

/**
 * Mínimo do pedido único a partir do `Setting.value`. Piso 1 (nunca "zero pães"), teto 20.
 * Ausente/inválido → 1, que é o comportamento histórico.
 */
export function parseMinimoUnico(raw: string | null | undefined): number {
  const n = raw == null ? NaN : parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(MAX_MIN_UNICO, Math.floor(n))
}

/**
 * Mínimo da Cestinha (R$) a partir do `Setting.value`. Ausente/inválido → R$ 15 (default do
 * seed); negativo → 0. `0` é válido e significa "sem mínimo".
 */
export function parseMinimoCestinha(raw: string | null | undefined): number {
  if (raw == null) return DEFAULT_MIN_CESTINHA
  const n = parseFloat(raw)
  if (!Number.isFinite(n)) return DEFAULT_MIN_CESTINHA
  return n < 0 ? 0 : n
}

/**
 * Mínimos da agenda a partir do `Setting.value` (JSON string). Cada dia clampado para [0..12];
 * ausente/JSON inválido → 0 em todos os dias (sem mínimo).
 */
export function parseAgendaMinimos(raw: string | null | undefined): WeekdayMinimums {
  return parseWeekdayMap(raw, agendaValue)
}

/**
 * Mesma coerção de `parseAgendaMinimos`, mas a partir de um OBJETO já desserializado — usado
 * pelo override do condomínio, que chega como `Json` do Prisma (não string).
 */
export function coerceAgendaMinimos(obj: unknown): WeekdayMinimums {
  return coerceWeekdayMap(obj, agendaValue)
}

// ------------------------------------------------------------------ resolução da herança

/**
 * Um override de MAPA só "existe" quando é um objeto de verdade. `null`/`undefined` (chave
 * ausente no Mongo) e escalares/arrays degradam para herança — nunca lança.
 */
function hasMapOverride(v: unknown): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Um override ESCALAR existe quando é um número finito. `0` conta como personalização
 * (desliga o mínimo naquele condomínio) — por isso a checagem nunca é truthy.
 */
function hasScalarOverride(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/**
 * Resolve os mínimos de um condomínio a partir do padrão global + overrides. Função PURA —
 * o ponto único onde a herança é decidida. Cada mínimo herda independentemente dos outros.
 */
export function resolveCondoMinimums(
  global: OrderMinimums,
  overrides?: CondoMinimumOverrides | null,
): ResolvedMinimums {
  const unicoOverridden = hasScalarOverride(overrides?.pedidoMinimoUnicoOverride)
  const agendaOverridden = hasMapOverride(overrides?.pedidoMinimoAgendaOverride)
  const cestinhaOverridden = hasScalarOverride(overrides?.marketMinimoCestinhaOverride)

  return {
    // Mesmo clamp do parse global: o override também respeita o piso 1 e o teto 20.
    unico: unicoOverridden
      ? Math.min(MAX_MIN_UNICO, Math.max(1, Math.floor(overrides!.pedidoMinimoUnicoOverride as number)))
      : global.unico,
    agenda: agendaOverridden
      ? coerceAgendaMinimos(overrides!.pedidoMinimoAgendaOverride)
      : global.agenda,
    cestinha: cestinhaOverridden
      ? Math.max(0, overrides!.marketMinimoCestinhaOverride as number)
      : global.cestinha,
    source: {
      unico: unicoOverridden ? 'condo' : 'global',
      agenda: agendaOverridden ? 'condo' : 'global',
      cestinha: cestinhaOverridden ? 'condo' : 'global',
    },
  }
}

type MinimumsPrisma = Pick<PrismaClient, 'setting' | 'condominium'>

/**
 * O PADRÃO global dos três mínimos (as três chaves do `Setting`).
 * Três `findUnique` em paralelo — mesmo formato de `getAgendaRestrictions`.
 */
export async function getGlobalMinimums(
  prisma: Pick<PrismaClient, 'setting'>,
): Promise<OrderMinimums> {
  const [unicoRow, agendaRow, cestinhaRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: PEDIDO_MINIMO_UNICO_KEY } }),
    prisma.setting.findUnique({ where: { key: PEDIDO_MINIMO_AGENDA_KEY } }),
    prisma.setting.findUnique({ where: { key: MARKET_MINIMO_CESTINHA_KEY } }),
  ])
  return {
    unico: parseMinimoUnico(unicoRow?.value),
    agenda: parseAgendaMinimos(agendaRow?.value),
    cestinha: parseMinimoCestinha(cestinhaRow?.value),
  }
}

/**
 * Mínimos resolvidos de um condomínio (override ?? padrão global). Sem `condominiumId`
 * (cliente sem condomínio, telas globais do admin) devolve o padrão global puro.
 */
export async function getMinimumsForCondo(
  prisma: MinimumsPrisma,
  condominiumId?: string | null,
): Promise<ResolvedMinimums> {
  const global = await getGlobalMinimums(prisma)
  if (!condominiumId) {
    return { ...global, source: { unico: 'global', agenda: 'global', cestinha: 'global' } }
  }
  const condo = await prisma.condominium.findUnique({
    where: { id: condominiumId },
    select: {
      pedidoMinimoUnicoOverride: true,
      pedidoMinimoAgendaOverride: true,
      marketMinimoCestinhaOverride: true,
    },
  })
  return resolveCondoMinimums(global, condo)
}

/**
 * Atalho para os chokepoints que só têm o `userId` em mãos (Cestinha/pricing): resolve o
 * condomínio do cliente e devolve os mínimos dele. Cliente sem condomínio → padrão global.
 */
export async function getMinimumsForUser(
  prisma: MinimumsPrisma & Pick<PrismaClient, 'user'>,
  userId?: string | null,
): Promise<ResolvedMinimums> {
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { condominiumId: true } })
    : null
  return getMinimumsForCondo(prisma, user?.condominiumId)
}

// ------------------------------------------------------------------ mensagens (fonte única)

/** "1 pão" / "N pães" — usado nas mensagens de erro do pedido único e da Cestinha. */
export function paesLabel(qty: number): string {
  return qty === 1 ? '1 pão' : `${qty} pães`
}
