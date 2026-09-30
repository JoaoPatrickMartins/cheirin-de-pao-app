import { randomInt } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import {
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_FALLBACK_PREFIX,
  REFERRAL_CODE_PREFIX_MAX,
  REFERRAL_CODE_SUFFIX_LENGTH,
  normalizeReferralCode,
} from '@cheirin-de-pao/shared'

/**
 * Código de indicação do cliente: primeiro nome + 4 caracteres sorteados (`JOAO7K2F`).
 *
 * O nome na frente é o que faz o código ser lembrado e ditado ("é JOAO e mais quatro"); o sufixo
 * sorteado é o que o torna único e impossível de adivinhar a partir do nome.
 */

/** Tentativas de sortear um código livre antes de desistir (§4.6). */
const CODE_ATTEMPTS = 5

/** Normaliza a entrada do usuário (maiúsculas, sem espaços e hífens). */
export const normalizeCode = normalizeReferralCode

/** Tira acentos: "João" → "Joao", "Conceição" → "Conceicao". */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Prefixo do código a partir do nome: primeiro nome sem acento, só letras, maiúsculas, até 6.
 * Sem nenhuma letra aproveitável (nome vazio, só números ou emoji) → o prefixo reservado `PAO`.
 */
export function codePrefix(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? ''
  const letters = stripAccents(first).toUpperCase().replace(/[^A-Z]/g, '')
  return letters.slice(0, REFERRAL_CODE_PREFIX_MAX) || REFERRAL_CODE_FALLBACK_PREFIX
}

/**
 * Sorteia um código novo para o nome. `pick` existe para o teste fixar o sorteio; em produção é o
 * `randomInt` do Node (CSPRNG) — sufixo previsível deixaria alguém "adivinhar" o código de outro.
 */
export function generateCode(
  name: string | null | undefined,
  pick: (max: number) => number = randomInt,
): string {
  let suffix = ''
  for (let i = 0; i < REFERRAL_CODE_SUFFIX_LENGTH; i++) {
    suffix += REFERRAL_CODE_ALPHABET[pick(REFERRAL_CODE_ALPHABET.length)]
  }
  return codePrefix(name) + suffix
}

/**
 * "Maria Souza" → "Maria S." — o que quem indica vê do amigo, e o que a validação pública do
 * código devolve do dono (LGPD, §4.7). A inicial é do ÚLTIMO sobrenome, para "Maria da Silva"
 * não virar "Maria d.". Nome de uma palavra só fica como está.
 */
export function shortName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  const first = parts[0]
  if (parts.length === 1) return first
  const initial = parts[parts.length - 1].charAt(0).toUpperCase()
  return `${first} ${initial}.`
}

/** Primeiro nome — o `{nome}` da mensagem e o "Maria se cadastrou" dos avisos. */
export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

/**
 * Colisão no índice único. O de `referralCode` é o índice parcial do `ensure-indexes` (fora do
 * schema), então além do P2002 confere o E11000 cru do Mongo, caso o erro não venha traduzido.
 */
function isDuplicateKey(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  if ((err as { code?: unknown }).code === 'P2002') return true
  const message = (err as { message?: unknown }).message
  return typeof message === 'string' && message.includes('E11000')
}

/**
 * Devolve o código do cliente, gerando e gravando na primeira vez.
 *
 * - A gravação é um claim: só casa se o cliente AINDA não tem código. Duas aberturas da tela ao
 *   mesmo tempo não produzem dois códigos — a segunda perde o claim e lê o da primeira.
 * - Filtro `null` OU ausente: em documento antigo a chave nem existe, e `{ referralCode: null }`
 *   sozinho não o encontraria (armadilha do Mongo documentada em `credit-milli-backfill.ts`).
 * - Colisão com o código de outro cliente → sorteia de novo, até 5 vezes.
 *
 * @returns o código, ou `null` se o usuário não existe.
 */
export async function ensureReferralCode(
  prisma: Pick<PrismaClient, 'user'>,
  userId: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, referralCode: true },
  })
  if (!user) return null
  if (user.referralCode) return user.referralCode

  for (let attempt = 1; attempt <= CODE_ATTEMPTS; attempt++) {
    const code = generateCode(user.name)
    try {
      const claimed = await prisma.user.updateMany({
        where: {
          id: userId,
          OR: [{ referralCode: null }, { referralCode: { isSet: false } }],
        },
        data: { referralCode: code },
      })
      if (claimed.count === 1) return code
    } catch (err) {
      if (isDuplicateKey(err)) continue
      throw err
    }
    // Perdeu o claim: outra requisição gravou o código primeiro — vale o dela.
    const again = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } })
    if (again?.referralCode) return again.referralCode
  }
  throw new Error(`[referral] não foi possível gerar um código livre para ${userId}`)
}
