import type { PrismaClient } from '@prisma/client'
import {
  DEFAULT_REFERRAL_MESSAGE,
  REFERRAL_LIMITS,
  ReferralCampaignSchema,
  ReferralGoalSchema,
  referralMessageHasCodeOrLink,
  type ReferralCampaign,
  type ReferralGoal,
} from '@cheirin-de-pao/shared'
import { brtDateStr } from './cutoff.js'

/**
 * Config do Indique e Ganhe (Setting key/value → valores com defaults defensivos). Tudo é
 * configurado pelo admin em Gestão › Indique e Ganhe (D-3); as faixas são as da D-13.
 */
export interface ReferralConfig {
  /**
   * Programa ligado. Só vale com `recompensa ≥ 1`: um programa ativo que não paga nada prometeria
   * "ganhe 0 pãezins" — o PATCH já recusa ligar assim, e a leitura garante o mesmo.
   */
  ativa: boolean
  /** X — pãezins inteiros para quem indica, por indicação que valeu (antes da campanha). */
  recompensa: number
  /** Y — pãezins inteiros de boas-vindas para o amigo. `0` = sem bônus (nenhum texto fala dele). */
  bonusIndicado: number
  /** Valor mínimo (R$) de um pagamento real do amigo para a indicação valer. `0` = qualquer. */
  compraMinima: number
  /** Recompensas por indicador no mês BRT antes de mandar para análise. `0` = sem limite. */
  limiteMensal: number
  /** Prazo (dias a partir do cadastro) para o amigo qualificar. `0` = sem prazo. */
  prazoDias: number
  /** Texto do compartilhamento, com `{codigo}` `{link}` `{nome}` `{bonus}`. */
  mensagem: string
  /** Campanha por período (D-16) — gravada mesmo fora da janela; ver {@link activeCampaign}. */
  campanha: ReferralCampaign | null
  /** Metas de quem indica, em ordem crescente de quantidade, quantidades distintas, até 5. */
  metas: ReferralGoal[]
}

export const REFERRAL_SETTING_KEYS = {
  ativa: 'indicacaoAtiva',
  recompensa: 'indicacaoRecompensa',
  bonusIndicado: 'indicacaoBonusIndicado',
  compraMinima: 'indicacaoCompraMinima',
  limiteMensal: 'indicacaoLimiteMensal',
  prazoDias: 'indicacaoPrazoDias',
  mensagem: 'indicacaoMensagem',
  campanha: 'indicacaoCampanha',
  metas: 'indicacaoMetas',
} as const satisfies Record<keyof ReferralConfig, string>

/**
 * Padrões — são também os valores semeados no boot (`seedReferralDefaults`). Programa desligado:
 * só passa a valer quando o admin revisa os números e liga.
 */
export const REFERRAL_DEFAULTS: ReferralConfig = {
  ativa: false,
  recompensa: 5,
  bonusIndicado: 0,
  compraMinima: 0,
  limiteMensal: 10,
  prazoDias: 60,
  mensagem: DEFAULT_REFERRAL_MESSAGE,
  campanha: null,
  metas: [],
}

/** Inteiro dentro de [min, max]; qualquer outra coisa (NaN, fração, fora da faixa) → `fallback`. */
function intInRange(raw: string | undefined, range: { min: number; max: number }, fallback: number): number {
  // `Number('')` é 0 — string vazia no banco não pode virar "recompensa 0" em silêncio.
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number(raw.trim())
  return Number.isInteger(n) && n >= range.min && n <= range.max ? n : fallback
}

function parseJson(raw: string | undefined): unknown {
  if (raw === undefined) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** Campanha gravada → objeto válido, ou `null` (ausente, `null`, JSON quebrado ou fora das regras). */
function parseCampaign(raw: string | undefined): ReferralCampaign | null {
  const parsed = ReferralCampaignSchema.safeParse(parseJson(raw))
  return parsed.success ? parsed.data : null
}

/**
 * Metas gravadas → lista limpa. Item inválido é DESCARTADO (e não a lista inteira): uma meta
 * quebrada não deve apagar as outras que o cliente já está perseguindo. Quantidade repetida fica
 * com a primeira; ordena e corta em 5.
 */
function parseGoals(raw: string | undefined): ReferralGoal[] {
  const value = parseJson(raw)
  if (!Array.isArray(value)) return []
  const seen = new Set<number>()
  const goals: ReferralGoal[] = []
  for (const item of value) {
    const parsed = ReferralGoalSchema.safeParse(item)
    if (!parsed.success || seen.has(parsed.data.quantidade)) continue
    seen.add(parsed.data.quantidade)
    goals.push(parsed.data)
  }
  return goals.sort((a, b) => a.quantidade - b.quantidade).slice(0, REFERRAL_LIMITS.metas.max)
}

function parseMessage(raw: string | undefined): string {
  if (raw === undefined) return REFERRAL_DEFAULTS.mensagem
  const len = raw.trim().length
  const ok =
    len >= REFERRAL_LIMITS.mensagem.min &&
    len <= REFERRAL_LIMITS.mensagem.max &&
    referralMessageHasCodeOrLink(raw)
  return ok ? raw : REFERRAL_DEFAULTS.mensagem
}

/**
 * Lê a config do Indique e Ganhe a partir dos Settings `indicacao*`.
 * Parse defensivo — chave ausente/inválida cai no padrão (nunca lança). Sem cache: as leituras de
 * Setting já são diretas no projeto, e config velha aqui pagaria recompensa com valor antigo.
 */
export async function getReferralConfig(
  prisma: Pick<PrismaClient, 'setting'>,
): Promise<ReferralConfig> {
  const keys = Object.values(REFERRAL_SETTING_KEYS)
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } })
  const byKey = new Map(rows.map((r) => [r.key, r.value]))
  const get = (k: keyof ReferralConfig) => byKey.get(REFERRAL_SETTING_KEYS[k])

  const recompensa = intInRange(get('recompensa'), REFERRAL_LIMITS.recompensa, REFERRAL_DEFAULTS.recompensa)

  const compraRaw = get('compraMinima')?.trim()
  const compraParsed = compraRaw ? Number(compraRaw) : NaN
  const compraMinima =
    Number.isFinite(compraParsed) && compraParsed >= 0 ? compraParsed : REFERRAL_DEFAULTS.compraMinima

  return {
    // Sem default de negócio: só `'true'` liga. Valor estranho no banco nunca liga o programa.
    ativa: get('ativa')?.trim() === 'true' && recompensa >= 1,
    recompensa,
    bonusIndicado: intInRange(get('bonusIndicado'), REFERRAL_LIMITS.bonusIndicado, REFERRAL_DEFAULTS.bonusIndicado),
    compraMinima,
    limiteMensal: intInRange(get('limiteMensal'), REFERRAL_LIMITS.limiteMensal, REFERRAL_DEFAULTS.limiteMensal),
    prazoDias: intInRange(get('prazoDias'), REFERRAL_LIMITS.prazoDias, REFERRAL_DEFAULTS.prazoDias),
    mensagem: parseMessage(get('mensagem')),
    campanha: parseCampaign(get('campanha')),
    metas: parseGoals(get('metas')),
  }
}

/** A campanha que vale HOJE (dia BRT dentro de `[inicio, fim]`), ou `null`. */
export function activeCampaign(config: ReferralConfig, now: Date = new Date()): ReferralCampaign | null {
  const c = config.campanha
  if (!c) return null
  const today = brtDateStr(now)
  return today >= c.inicio && today <= c.fim ? c : null
}

/**
 * Quanto quem indica ganharia com uma indicação feita AGORA: X × multiplicador da campanha. É o
 * número das telas ("ganhe 10 pãezins") e o valor congelado no cadastro. O bônus do amigo não
 * passa pela campanha.
 */
export function currentRewardBreads(config: ReferralConfig, now: Date = new Date()): number {
  return config.recompensa * (activeCampaign(config, now)?.multiplicador ?? 1)
}
