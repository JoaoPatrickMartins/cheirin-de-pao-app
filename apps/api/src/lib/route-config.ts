import type { PrismaClient } from '@prisma/client'
import { brtDateStr } from './cutoff.js'

/**
 * Config da tela "Rotas e comprovante" (A5 do plano do entregador): base de saída, cálculo da rota,
 * preço do litro, se o cliente vê a foto da entrega e o que o entregador vê de km e combustível
 * (Onda 10: H-5…H-8, T-18).
 *
 * Mesmo padrão do `referral-config`: Settings string, mapa de chaves + padrões + leitor defensivo
 * (chave ausente/inválida cai no padrão, nunca lança). Base e preços NÃO têm padrão: ausência é
 * "não configurado" — a rota começa no primeiro prédio e o combustível não é calculado, em vez de
 * inventar um endereço ou um preço.
 */
export interface RouteConfig {
  /** Base de saída (onde o pão é retirado). null = não definida. */
  base: { endereco: string; lat: number; lng: number } | null
  /** A volta à base entra no km (e no combustível) estimado. */
  voltaBase: boolean
  /** Tempo médio por porta, em minutos — entra na hora prevista de cada prédio. */
  minPorPorta: number
  /** Preço do litro em R$. null = não informado (sem cálculo de combustível). */
  precoGasolina: number | null
  precoEtanol: number | null
  /** Preço do m³ do GNV em R$ (Onda 11 · T-35). null = não informado. */
  precoGnv: number | null
  /** Dia BRT ("YYYY-MM-DD") da última mudança de preço. */
  precoAtualizadoEm: string | null
  /** O cliente vê a foto do comprovante (D-4). A obrigatoriedade é por entregador. */
  fotoClienteVisivel: boolean
  /** O entregador vê km e combustível estimados em Meus números (E17). Padrão: não. */
  entregadorVeCombNumeros: boolean
  /** O entregador vê km e combustível estimados no Fim da rota (E10). Padrão: não. */
  entregadorVeCombFimRota: boolean
  /** O entregador vê a CONTA do combustível em Meus ganhos (E13); sem ela, só o valor. Padrão: não. */
  entregadorVeCombGanhos: boolean
}

/** Switches "O que o entregador vê" — opcionais no PATCH: ausente mantém o gravado (T-19). */
export const COURIER_FUEL_VISIBILITY_KEYS = ['entregadorVeCombNumeros', 'entregadorVeCombFimRota', 'entregadorVeCombGanhos'] as const
type CourierFuelVisibilityKey = (typeof COURIER_FUEL_VISIBILITY_KEYS)[number]

export const ROUTE_SETTING_KEYS = {
  baseEndereco: 'rotaBaseEndereco',
  baseLat: 'rotaBaseLat',
  baseLng: 'rotaBaseLng',
  voltaBase: 'rotaVoltaBase',
  minPorPorta: 'rotaMinPorPorta',
  precoGasolina: 'combustivelGasolina',
  precoEtanol: 'combustivelEtanol',
  precoGnv: 'combustivelGnv',
  precoAtualizadoEm: 'combustivelAtualizadoEm',
  fotoClienteVisivel: 'fotoClienteVisivel',
  entregadorVeCombNumeros: 'entregadorVeCombNumeros',
  entregadorVeCombFimRota: 'entregadorVeCombFimRota',
  entregadorVeCombGanhos: 'entregadorVeCombGanhos',
} as const

/** Sequência do nº do crachá (H-3) — incremento atômico, gravada à parte da config. */
export const COURIER_BADGE_SEQ_KEY = 'courierBadgeSeq'

export const ROUTE_LIMITS = {
  minPorPorta: { min: 0, max: 15 },
  preco: { min: 0.01, max: 20 },
} as const

/** Padrões que vão para o seed do boot. Base e preços ficam de fora de propósito (ver cabeçalho). */
export const ROUTE_SEED_DEFAULTS: Record<string, string> = {
  [ROUTE_SETTING_KEYS.voltaBase]: 'true',
  [ROUTE_SETTING_KEYS.minPorPorta]: '1',
  [ROUTE_SETTING_KEYS.fotoClienteVisivel]: 'true',
  [ROUTE_SETTING_KEYS.entregadorVeCombNumeros]: 'false',
  [ROUTE_SETTING_KEYS.entregadorVeCombFimRota]: 'false',
  [ROUTE_SETTING_KEYS.entregadorVeCombGanhos]: 'false',
}

const DEFAULTS = {
  voltaBase: true,
  minPorPorta: 1,
  fotoClienteVisivel: true,
  entregadorVeCombNumeros: false,
  entregadorVeCombFimRota: false,
  entregadorVeCombGanhos: false,
}

function parseNum(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null
  const n = Number(raw.trim())
  return Number.isFinite(n) ? n : null
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  const v = raw?.trim()
  if (v === 'true') return true
  if (v === 'false') return false
  return fallback
}

function parsePrice(raw: string | undefined): number | null {
  const n = parseNum(raw)
  return n !== null && n >= ROUTE_LIMITS.preco.min && n <= ROUTE_LIMITS.preco.max ? n : null
}

export async function getRouteConfig(prisma: Pick<PrismaClient, 'setting'>): Promise<RouteConfig> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(ROUTE_SETTING_KEYS) } } })
  const byKey = new Map(rows.map((r) => [r.key, r.value]))
  const get = (k: keyof typeof ROUTE_SETTING_KEYS) => byKey.get(ROUTE_SETTING_KEYS[k])

  const endereco = get('baseEndereco')?.trim() ?? ''
  const lat = parseNum(get('baseLat'))
  const lng = parseNum(get('baseLng'))
  const baseOk = endereco !== '' && lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

  const min = parseNum(get('minPorPorta'))
  const minPorPorta =
    min !== null && Number.isInteger(min) && min >= ROUTE_LIMITS.minPorPorta.min && min <= ROUTE_LIMITS.minPorPorta.max
      ? min
      : DEFAULTS.minPorPorta

  const atualizado = get('precoAtualizadoEm')?.trim()
  return {
    base: baseOk ? { endereco, lat: lat!, lng: lng! } : null,
    voltaBase: parseBool(get('voltaBase'), DEFAULTS.voltaBase),
    minPorPorta,
    precoGasolina: parsePrice(get('precoGasolina')),
    precoEtanol: parsePrice(get('precoEtanol')),
    precoGnv: parsePrice(get('precoGnv')),
    precoAtualizadoEm: atualizado && /^\d{4}-\d{2}-\d{2}$/.test(atualizado) ? atualizado : null,
    fotoClienteVisivel: parseBool(get('fotoClienteVisivel'), DEFAULTS.fotoClienteVisivel),
    entregadorVeCombNumeros: parseBool(get('entregadorVeCombNumeros'), DEFAULTS.entregadorVeCombNumeros),
    entregadorVeCombFimRota: parseBool(get('entregadorVeCombFimRota'), DEFAULTS.entregadorVeCombFimRota),
    entregadorVeCombGanhos: parseBool(get('entregadorVeCombGanhos'), DEFAULTS.entregadorVeCombGanhos),
  }
}

/**
 * Grava a config inteira e devolve o que a LEITURA enxerga. A data do preço só muda quando algum
 * preço mudou — salvar a base não pode dizer "preço atualizado hoje".
 */
export async function setRouteConfig(
  prisma: Pick<PrismaClient, 'setting' | '$transaction'>,
  body: Omit<RouteConfig, 'precoAtualizadoEm' | 'precoGnv' | CourierFuelVisibilityKey> & Partial<Pick<RouteConfig, 'precoGnv' | CourierFuelVisibilityKey>>,
  now: Date = new Date(),
): Promise<RouteConfig> {
  const current = await getRouteConfig(prisma)
  // Ausente (A5 antigo em cache) mantém o preço do GNV; null limpa.
  const precoGnv = body.precoGnv === undefined ? current.precoGnv : body.precoGnv
  const priceChanged = current.precoGasolina !== body.precoGasolina || current.precoEtanol !== body.precoEtanol || current.precoGnv !== precoGnv
  const num = (n: number | null) => (n === null ? '' : String(n))
  const values: Record<keyof typeof ROUTE_SETTING_KEYS, string> = {
    baseEndereco: body.base?.endereco.trim() ?? '',
    baseLat: num(body.base?.lat ?? null),
    baseLng: num(body.base?.lng ?? null),
    voltaBase: String(body.voltaBase),
    minPorPorta: String(body.minPorPorta),
    precoGasolina: num(body.precoGasolina),
    precoEtanol: num(body.precoEtanol),
    precoGnv: num(precoGnv),
    precoAtualizadoEm: priceChanged ? brtDateStr(now) : (current.precoAtualizadoEm ?? ''),
    fotoClienteVisivel: String(body.fotoClienteVisivel),
    entregadorVeCombNumeros: String(body.entregadorVeCombNumeros ?? current.entregadorVeCombNumeros),
    entregadorVeCombFimRota: String(body.entregadorVeCombFimRota ?? current.entregadorVeCombFimRota),
    entregadorVeCombGanhos: String(body.entregadorVeCombGanhos ?? current.entregadorVeCombGanhos),
  }
  await prisma.$transaction(
    (Object.keys(values) as Array<keyof typeof ROUTE_SETTING_KEYS>).map((k) =>
      prisma.setting.upsert({
        where: { key: ROUTE_SETTING_KEYS[k] },
        create: { key: ROUTE_SETTING_KEYS[k], value: values[k] },
        update: { value: values[k] },
      }),
    ),
  )
  return getRouteConfig(prisma)
}
