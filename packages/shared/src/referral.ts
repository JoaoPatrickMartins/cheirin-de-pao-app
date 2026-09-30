import { z } from 'zod'

/**
 * Indique e Ganhe — regras que o front e a API precisam dizer IGUAL: formato do código, faixas da
 * configuração e a mensagem de compartilhamento.
 *
 * A mensagem é o caso que mais importa: a prévia do admin (A3), o botão do WhatsApp (C1) e o
 * `GET /referrals/me` montam o mesmo texto. Com três cópias de `refMsg`, a prévia mostraria uma
 * coisa e o amigo receberia outra.
 */

/**
 * Alfabeto do sufixo do código: sem 0/O, 1/I/L — os pares que se confundem ao ditar ou digitar.
 * 31 símbolos × 4 posições ≈ 923 mil sufixos por prefixo de nome.
 */
export const REFERRAL_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** Tamanho do sufixo sorteado (`JOAO` + `7K2F`). */
export const REFERRAL_CODE_SUFFIX_LENGTH = 4

/** Máximo de letras do nome no prefixo (`FERNAN7K2F`). */
export const REFERRAL_CODE_PREFIX_MAX = 6

/** Prefixo reservado para quem não tem letra aproveitável no primeiro nome. */
export const REFERRAL_CODE_FALLBACK_PREFIX = 'PAO'

/**
 * Normaliza o que o usuário digitou ou colou: maiúsculas, sem espaços e sem hífens.
 * "joao 7k2f", "JOAO-7K2F" e " Joao7k2f " viram o mesmo "JOAO7K2F".
 */
export function normalizeReferralCode(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().replace(/[\s-]+/g, '')
}

/**
 * Os dois grupos da exibição (`JOAO` · `7K2F`) — o sufixo sai em dourado na tela.
 * Código curto demais para ter prefixo devolve tudo no sufixo.
 */
export function splitReferralCode(code: string): { prefix: string; suffix: string } {
  const cut = Math.max(0, code.length - REFERRAL_CODE_SUFFIX_LENGTH)
  return { prefix: code.slice(0, cut), suffix: code.slice(cut) }
}

/**
 * Faixas da configuração (D-13) — são as dos controles do handoff (A3). O PATCH do admin valida
 * com elas, e a leitura defensiva (`getReferralConfig`) descarta o que cair fora.
 */
export const REFERRAL_LIMITS = {
  recompensa: { min: 0, max: 50 },
  bonusIndicado: { min: 0, max: 50 },
  limiteMensal: { min: 0, max: 99 },
  prazoDias: { min: 0, max: 180 },
  mensagem: { min: 20, max: 500 },
  multiplicador: { min: 2, max: 5 },
  metas: { max: 5 },
  metaQuantidade: { min: 1, max: 999 },
  metaBonus: { min: 1, max: 50 },
  campanhaRotulo: { min: 1, max: 30 },
} as const

/** Variáveis aceitas na mensagem — os chips do A3. */
export const REFERRAL_MESSAGE_VARS = ['{codigo}', '{link}', '{nome}', '{bonus}'] as const

/** Mensagem padrão do compartilhamento (seed de `indicacaoMensagem`). */
export const DEFAULT_REFERRAL_MESSAGE =
  'Oi! Recebo pão fresquinho na porta com o Cheirin de Pão 🥖 Cadastra com o meu código {codigo} ' +
  'e ganha {bonus} pãezins no primeiro pedido: {link}'

/**
 * O trecho do bônus da mensagem padrão. Sem bônus do amigo (Y = 0) ele sai inteiro: "ganha 0
 * pãezins" é pior do que não dizer nada.
 */
const BONUS_CLAUSE = / e ganha \{bonus\} pãezins no primeiro pedido/

export interface ReferralMessageVars {
  code: string
  link: string
  /** Primeiro nome de quem indica — o `{nome}`. */
  name: string
  /** Bônus do amigo em pãezins inteiros (Y). */
  welcomeBreads: number
}

/**
 * Monta a mensagem de compartilhamento — o `refMsg` do handoff.
 *
 * Replacer em FUNÇÃO, não em string: nome com "$&" ou "$1" viraria outro texto no `replace`.
 */
export function renderReferralMessage(template: string, vars: ReferralMessageVars): string {
  let m = template
  if (!vars.welcomeBreads) m = m.replace(BONUS_CLAUSE, '')
  return m
    .replace(/\{codigo\}/g, () => vars.code)
    .replace(/\{link\}/g, () => vars.link)
    .replace(/\{nome\}/g, () => vars.name)
    .replace(/\{bonus\}/g, () => String(vars.welcomeBreads))
}

/** A mensagem precisa levar o código ou o link — sem os dois, o amigo não tem como usar. */
export function referralMessageHasCodeOrLink(template: string): boolean {
  return template.includes('{codigo}') || template.includes('{link}')
}

/**
 * Aviso `bonusWarn` do A3: sem bônus do amigo, uma mensagem personalizada que ainda usa `{bonus}`
 * vai sair "ganha 0 pãezins". A padrão não avisa — o trecho dela é removido sozinho.
 */
export function referralMessageBonusWarning(template: string, welcomeBreads: number): boolean {
  if (welcomeBreads > 0) return false
  return template.replace(BONUS_CLAUSE, '').includes('{bonus}')
}

/** "1 pãozin" / "5 pãezins" — o `paez` do handoff, para números inteiros de pão. */
export function breadsLabel(n: number): string {
  return `${String(n).replace('.', ',')} ${n === 1 ? 'pãozin' : 'pãezins'}`
}

// ─────────────────────────────────────────────────────────── campanha e metas

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Campanha por período (D-16: uma por vez). `inicio`/`fim` são dias BRT "YYYY-MM-DD", inclusivos.
 * O "fim ≥ hoje" é regra de ESCRITA (PATCH do admin) — na leitura, campanha vencida só não vale.
 */
export const ReferralCampaignSchema = z
  .object({
    rotulo: z
      .string()
      .trim()
      .min(REFERRAL_LIMITS.campanhaRotulo.min, 'Dê um nome à campanha')
      .max(REFERRAL_LIMITS.campanhaRotulo.max),
    multiplicador: z
      .number()
      .int()
      .min(REFERRAL_LIMITS.multiplicador.min)
      .max(REFERRAL_LIMITS.multiplicador.max),
    inicio: z.string().regex(DAY_RE, 'Data inválida'),
    fim: z.string().regex(DAY_RE, 'Data inválida'),
  })
  .refine((c) => c.inicio <= c.fim, { message: 'O fim vem depois do início', path: ['fim'] })

export type ReferralCampaign = z.infer<typeof ReferralCampaignSchema>

export const ReferralGoalSchema = z.object({
  quantidade: z
    .number()
    .int()
    .min(REFERRAL_LIMITS.metaQuantidade.min)
    .max(REFERRAL_LIMITS.metaQuantidade.max),
  bonus: z.number().int().min(REFERRAL_LIMITS.metaBonus.min).max(REFERRAL_LIMITS.metaBonus.max),
})

export type ReferralGoal = z.infer<typeof ReferralGoalSchema>

/** Até 5 metas, quantidades distintas. A ordem crescente é normalizada por quem grava. */
export const ReferralGoalsSchema = z
  .array(ReferralGoalSchema)
  .max(REFERRAL_LIMITS.metas.max, `No máximo ${REFERRAL_LIMITS.metas.max} metas`)
  .refine((goals) => new Set(goals.map((g) => g.quantidade)).size === goals.length, {
    message: 'Duas metas na mesma quantidade',
  })
