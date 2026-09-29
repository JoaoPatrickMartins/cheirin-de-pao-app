import type { FastifyInstance } from 'fastify'
import type { PrismaClient, ReferralStatus } from '@prisma/client'
import { breadsLabel, fromMilli, toMilli } from '@cheirin-de-pao/shared'
import { NotificationsService } from '../modules/notifications/notifications.service.js'
import {
  activeCampaign,
  currentRewardBreads,
  getReferralConfig,
  type ReferralConfig,
} from './referral-config.js'
import { firstName, normalizeCode, shortName } from './referral-code.js'
import { presetWindow } from './date-range.js'
import { withWriteConflictRetry } from './tx-retry.js'

/**
 * Indique e Ganhe — toda a regra do programa mora aqui (§7.3 do plano-indique-e-ganhe).
 *
 * Invariantes que cada função abaixo respeita:
 *   1. Ninguém ganha pão sem dinheiro real e entrega física.
 *   2. Uma recompensa por amigo, garantida pelo banco (trava por status, nunca objeto lido antes).
 *   3. A indicação nunca atrapalha o cadastro nem o login — tudo aqui é best-effort.
 *   4. O que foi prometido é cumprido: os valores são congelados no cadastro.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** De onde veio o código: link `?ref=`, digitado no cadastro, ou vínculo manual do admin. */
export type ReferralSource = 'LINK' | 'CODE' | 'ADMIN'

/** Dono de um código de indicação, com o que a validação precisa. */
export interface ReferralCodeOwner {
  id: string
  name: string
  role: string
  isBlocked: boolean
}

/** Rota da tela C1 — destino dos avisos "Ver indicações" / "Indicar agora". */
export const REFERRAL_SCREEN_ROUTE = '/client/perfil/indique'

/** Extrato (C7) — destino de "Ver saldo" (A-13: não é a Home). */
export const STATEMENT_ROUTE = '/client/creditos/extrato'

/**
 * Estado de uma indicação como a API devolve (§4.2). O front só traduz a chave para o rótulo de
 * quem olha (cliente ou admin) — a regra de qual é qual mora aqui.
 */
export type ReferralStateKey = 'cadastro' | 'aguardando' | 'analise' | 'ganhou' | 'recusada' | 'expirou'

export function referralStateKey(r: { status: ReferralStatus; verifiedAt: Date | null }): ReferralStateKey {
  switch (r.status) {
    case 'PENDING':
      return r.verifiedAt ? 'aguardando' : 'cadastro'
    case 'ON_HOLD':
      return 'analise'
    case 'REWARDED':
      return 'ganhou'
    case 'REJECTED':
      return 'recusada'
    case 'EXPIRED':
      return 'expirou'
  }
}

/**
 * Procura o dono de um código. Devolve `null` para código vazio ou inexistente.
 *
 * `findFirst` e não `findUnique`: a unicidade é um índice parcial fora do schema (ver
 * `ensure-indexes.ts`), então o Prisma não sabe que o campo é único.
 */
export async function findCodeOwner(
  prisma: Pick<PrismaClient, 'user'>,
  rawCode: string | null | undefined,
): Promise<ReferralCodeOwner | null> {
  const code = normalizeCode(rawCode)
  if (!code) return null
  return prisma.user.findFirst({
    where: { referralCode: code },
    select: { id: true, name: true, role: true, isBlocked: true },
  })
}

/** Código válido = dono `CLIENT` e não bloqueado (§4.6). Entregador e admin não participam. */
export function isValidOwner(owner: ReferralCodeOwner | null): owner is ReferralCodeOwner {
  return !!owner && owner.role === 'CLIENT' && !owner.isBlocked
}

/** Resposta da validação pública do código (C4). Só primeiro nome + inicial do dono (LGPD). */
export interface PublicCodeCheck {
  valid: boolean
  referrerName?: string
  welcomeBreads?: number
}

/**
 * `GET /referrals/code/:code` — o cadastro confere o código ao sair do campo.
 * Programa desligado responde inválido (§4.8): o campo nem aparece, mas um app antigo em cache
 * poderia perguntar.
 */
export async function checkPublicCode(
  prisma: Pick<PrismaClient, 'user' | 'setting'>,
  rawCode: string,
): Promise<PublicCodeCheck> {
  const config = await getReferralConfig(prisma)
  if (!config.ativa) return { valid: false }
  const owner = await findCodeOwner(prisma, rawCode)
  if (!isValidOwner(owner)) return { valid: false }
  return { valid: true, referrerName: shortName(owner.name), welcomeBreads: config.bonusIndicado }
}

/**
 * Cria a indicação com os valores CONGELADOS e todas as chaves (null explícito — coleção nova).
 * Não confere se o programa está ligado nem se o código é válido: é trabalho de quem chama.
 *
 * @returns o id da indicação, ou `null` se o amigo já tinha indicador (índice único de `referredId`).
 */
export async function createReferral(
  prisma: Pick<PrismaClient, 'referral'>,
  args: {
    referrerId: string
    referredId: string
    code: string
    source: ReferralSource
    config: ReferralConfig
    verifiedAt?: Date | null
    now?: Date
  },
): Promise<string | null> {
  const now = args.now ?? new Date()
  const campaign = activeCampaign(args.config, now)
  const multiplier = campaign?.multiplicador ?? 1
  try {
    const referral = await prisma.referral.create({
      data: {
        referrerId: args.referrerId,
        referredId: args.referredId,
        code: args.code,
        source: args.source,
        status: 'PENDING',
        rewardMilli: toMilli(args.config.recompensa * multiplier),
        welcomeMilli: toMilli(args.config.bonusIndicado),
        campaignMultiplier: multiplier,
        campaignLabel: campaign?.rotulo ?? null,
        expiresAt: args.config.prazoDias > 0 ? new Date(now.getTime() + args.config.prazoDias * DAY_MS) : null,
        verifiedAt: args.verifiedAt ?? null,
        qualifiedAt: null,
        qualifyingOrderId: null,
        qualifyingKind: null,
        flags: [],
        rewardedAt: null,
        reviewedById: null,
        reviewedAt: null,
        rejectReason: null,
        rejectDetail: null,
        rewardSeenAt: null,
        welcomeSeenAt: null,
      },
      select: { id: true },
    })
    return referral.id
  } catch (err) {
    // O amigo já tem indicador: "1 indicador por amigo" é o índice único que decide, não um
    // `findUnique` antes — duas requisições juntas passariam pelos dois.
    if ((err as { code?: unknown })?.code === 'P2002') return null
    throw err
  }
}

/**
 * Cadastro com código → indicação `PENDING`.
 *
 * BEST-EFFORT: código inválido, programa desligado ou qualquer erro interno → o cadastro segue
 * normal, só sem vínculo (invariante 3). Por isso nunca lança.
 *
 * @returns o id da indicação criada, ou `null` quando não vinculou.
 */
export async function attachReferralAtSignup(
  fastify: FastifyInstance,
  user: { id: string },
  rawCode: string | null | undefined,
  source: 'LINK' | 'CODE' = 'CODE',
): Promise<string | null> {
  const code = normalizeCode(rawCode)
  if (!code) return null
  try {
    const config = await getReferralConfig(fastify.prisma)
    if (!config.ativa) return null
    const owner = await findCodeOwner(fastify.prisma, code)
    if (!isValidOwner(owner) || owner.id === user.id) return null
    return await createReferral(fastify.prisma, {
      referrerId: owner.id,
      referredId: user.id,
      code,
      source,
      config,
    })
  } catch (err) {
    fastify.log.warn({ err, userId: user.id }, '[referral] falha ao vincular a indicação no cadastro — ignorado')
    return null
  }
}

/**
 * 1º login do amigo → "cadastro confirmado" (`verifiedAt`) + aviso `REFERRAL_SIGNUP` a quem indicou.
 *
 * O `User` nasce ANTES do OTP; marcar aqui é o que evita avisar quem indicou de um cadastro
 * abandonado no meio. O claim (`verifiedAt: null`) garante um aviso só, mesmo com dois logins
 * juntos. Chamado depois de emitir os tokens, nunca no refresh.
 *
 * BEST-EFFORT: nunca lança — o login não pode falhar por causa da indicação.
 */
export async function markReferralVerified(fastify: FastifyInstance, userId: string): Promise<void> {
  try {
    const prisma = fastify.prisma
    const claimed = await prisma.referral.updateMany({
      where: { referredId: userId, verifiedAt: null },
      data: { verifiedAt: new Date() },
    })
    if (claimed.count === 0) return

    const referral = await prisma.referral.findUnique({
      where: { referredId: userId },
      select: { referrerId: true, rewardMilli: true },
    })
    if (!referral) return
    const friend = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    const breads = breadsLabel(fromMilli(referral.rewardMilli))

    // O handoff diz "Quando ele/ela receber" — mas o sistema não sabe o gênero de quem se
    // cadastrou. "Quando o 1º pedido chegar" diz o mesmo sem chutar.
    await new NotificationsService(fastify).notifyUser(referral.referrerId, {
      type: 'REFERRAL_SIGNUP',
      title: 'Sua indicação chegou! 🎉',
      body: `${firstName(friend?.name) || 'Alguém'} se cadastrou com o seu código. Quando o 1º pedido chegar, você ganha ${breads}.`,
      actionRoute: REFERRAL_SCREEN_ROUTE,
    })
  } catch (err) {
    fastify.log.warn({ err, userId }, '[referral] falha ao confirmar a indicação no login — ignorado')
  }
}

// ─────────────────────────────────────────────────── qualificação e recompensa (Onda 4)

/** Sinais de análise (§4.4). Gravados em `flags`; NUNCA chegam ao cliente. */
export type ReferralFlag = 'SAME_ADDRESS' | 'SAME_DEVICE' | 'OVER_LIMIT' | 'REFERRER_BLOCKED'

/** Rótulos do admin para os sinais (A4). */
export const REFERRAL_FLAG_LABELS: Record<ReferralFlag, string> = {
  SAME_ADDRESS: 'Mesmo apartamento',
  SAME_DEVICE: 'Mesmo aparelho',
  OVER_LIMIT: 'Limite do mês',
  REFERRER_BLOCKED: 'Indicador bloqueado',
}

/** Desfecho de uma avaliação — o que a varredura conta e o teste confere. */
export type QualifyOutcome = 'NONE' | 'PENDING' | 'EXPIRED' | 'ON_HOLD' | 'REWARDED'

type Prisma = FastifyInstance['prisma']

/** Unidade normalizada para comparar endereço: trim, maiúsculas, sem espaços; ausente = vazio. */
function unitKey(u: { block: string | null; apartment: string | null; complement: string | null }): string {
  return [u.block, u.complement, u.apartment].map((v) => (v ?? '').replace(/\s+/g, '').toUpperCase()).join('|')
}

/**
 * A 1ª entrega do amigo que conta: a mais antiga, pão OU Cestinha, feita até o prazo.
 *
 * O prazo é conferido contra o momento da ENTREGA, não contra o de agora: se a varredura passa
 * depois do prazo por uma entrega que aconteceu dentro dele (o gatilho falhou naquela hora), a
 * promessa continua valendo (invariante 4).
 *
 * `deliveredAt ?? scheduledDate` em código: pedido antigo não tem `deliveredAt`, e filtrar por ele
 * no banco perderia o documento sem a chave.
 */
async function findQualifyingDelivery(
  prisma: Prisma,
  userId: string,
  deadline: Date | null,
): Promise<{ id: string; kind: 'ORDER' | 'MARKET'; at: Date } | null> {
  const select = { id: true, deliveredAt: true, scheduledDate: true } as const
  const [orders, markets] = await Promise.all([
    prisma.order.findMany({ where: { userId, status: 'DELIVERED' }, select, orderBy: { scheduledDate: 'asc' }, take: 20 }),
    prisma.marketOrder.findMany({ where: { userId, status: 'DELIVERED' }, select, orderBy: { scheduledDate: 'asc' }, take: 20 }),
  ])
  const candidates = [
    ...orders.map((o) => ({ id: o.id, kind: 'ORDER' as const, at: o.deliveredAt ?? o.scheduledDate })),
    ...markets.map((o) => ({ id: o.id, kind: 'MARKET' as const, at: o.deliveredAt ?? o.scheduledDate })),
  ]
    .filter((c) => !deadline || c.at <= deadline)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
  return candidates[0] ?? null
}

/**
 * O amigo pôs dinheiro de verdade: ≥ 1 pagamento PAID que não é gancho, de pelo menos a compra
 * mínima. Filtrado em CÓDIGO: `purpose` é nulo OU ausente para compra de pães (armadilha do Mongo).
 */
async function hasQualifyingPayment(prisma: Prisma, userId: string, minAmount: number): Promise<boolean> {
  const payments = await prisma.payment.findMany({
    where: { userId, status: 'PAID' },
    select: { amount: true, purpose: true },
  })
  return payments.some((p) => p.purpose !== 'HOOK' && p.amount > 0 && p.amount >= minAmount)
}

/** Os sinais de análise da §4.4, na ordem da tabela. */
export async function computeReferralFlags(
  prisma: Prisma,
  referral: { referrerId: string; referredId: string },
  config: ReferralConfig,
  now: Date = new Date(),
): Promise<ReferralFlag[]> {
  const addressSelect = { condominiumId: true, block: true, apartment: true, complement: true, isBlocked: true } as const
  const [referrer, friend, friendSessions] = await Promise.all([
    prisma.user.findUnique({ where: { id: referral.referrerId }, select: addressSelect }),
    prisma.user.findUnique({ where: { id: referral.referredId }, select: addressSelect }),
    prisma.session.findMany({ where: { userId: referral.referredId }, select: { deviceId: true } }),
  ])
  const flags: ReferralFlag[] = []

  // Mesmo apartamento. Mesmo condomínio em OUTRO apartamento não é sinal — é bom para a rota.
  if (
    referrer &&
    friend &&
    referrer.condominiumId &&
    referrer.condominiumId === friend.condominiumId &&
    unitKey(referrer) === unitKey(friend)
  ) {
    flags.push('SAME_ADDRESS')
  }

  // Mesmo aparelho: algum deviceId de sessão (inclusive revogada) em comum.
  const deviceIds = [...new Set(friendSessions.map((s) => s.deviceId).filter(Boolean))]
  if (deviceIds.length > 0) {
    const shared = await prisma.session.count({ where: { userId: referral.referrerId, deviceId: { in: deviceIds } } })
    if (shared > 0) flags.push('SAME_DEVICE')
  }

  // Limite do mês (BRT). Não nega: manda para análise. 0 = sem limite.
  if (config.limiteMensal > 0) {
    const monthStart = presetWindow('month', now).startDate
    const thisMonth = await prisma.referral.count({
      where: { referrerId: referral.referrerId, status: 'REWARDED', rewardedAt: { gte: monthStart } },
    })
    if (thisMonth >= config.limiteMensal) flags.push('OVER_LIMIT')
  }

  if (referrer?.isBlocked) flags.push('REFERRER_BLOCKED')
  return flags
}

/**
 * Avalia a indicação do amigo (§4.3): pendente → dentro do prazo → entregue → pagou.
 * Sem sinal → recompensa; com sinal → análise. O que ainda não fecha continua PENDING e é
 * reavaliado na próxima entrega ou na varredura. Lança em erro — quem chama decide (ver
 * `afterDelivery`, que nunca lança).
 */
export async function qualifyReferral(
  fastify: FastifyInstance,
  referredId: string,
  now: Date = new Date(),
): Promise<QualifyOutcome> {
  const prisma = fastify.prisma
  // Caminho quente: é a única consulta para quem não veio por indicação.
  const referral = await prisma.referral.findUnique({ where: { referredId } })
  if (!referral || referral.status !== 'PENDING') return 'NONE'

  const config = await getReferralConfig(prisma)
  const delivery = await findQualifyingDelivery(prisma, referredId, referral.expiresAt)
  const paid = delivery ? await hasQualifyingPayment(prisma, referredId, config.compraMinima) : false

  if (!delivery || !paid) {
    if (referral.expiresAt && referral.expiresAt < now) {
      const expired = await prisma.referral.updateMany({
        where: { id: referral.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      })
      return expired.count > 0 ? 'EXPIRED' : 'NONE'
    }
    return 'PENDING'
  }

  const qualified = { qualifiedAt: now, qualifyingOrderId: delivery.id, qualifyingKind: delivery.kind }
  const flags = await computeReferralFlags(prisma, referral, config, now)

  if (flags.length > 0) {
    const held = await prisma.referral.updateMany({
      where: { id: referral.id, status: 'PENDING' },
      data: { status: 'ON_HOLD', flags, ...qualified },
    })
    if (held.count === 0) return 'NONE'
    await notifyAdminsReview(fastify, referral, flags)
    return 'ON_HOLD'
  }

  const rewarded = await rewardReferral(fastify, referral.id, 'PENDING', { qualified, now })
  return rewarded ? 'REWARDED' : 'NONE'
}

/** "Indicação para analisar" — João → Maria: mesmo apartamento. */
async function notifyAdminsReview(
  fastify: FastifyInstance,
  referral: { referrerId: string; referredId: string },
  flags: ReferralFlag[],
): Promise<void> {
  try {
    const [referrer, friend] = await Promise.all([
      fastify.prisma.user.findUnique({ where: { id: referral.referrerId }, select: { name: true } }),
      fastify.prisma.user.findUnique({ where: { id: referral.referredId }, select: { name: true } }),
    ])
    const reasons = flags.map((f) => REFERRAL_FLAG_LABELS[f].toLowerCase()).join(', ')
    await new NotificationsService(fastify).notifyAdmins({
      type: 'ADMIN_REFERRAL_REVIEW',
      title: 'Indicação para analisar',
      body: `${firstName(referrer?.name)} → ${firstName(friend?.name)}: ${reasons}.`,
      actionRoute: '/admin',
    })
  } catch (err) {
    fastify.log.warn({ err }, '[referral] falha ao avisar os admins da análise — ignorado')
  }
}

/**
 * Paga a indicação: quem indicou ganha X (já com a campanha), o amigo ganha Y — no MESMO evento.
 *
 * A trava é o status: o `updateMany({ id, status: from })` dentro da transação só casa para quem
 * chegar primeiro. Duas entregas confirmadas juntas (entregador + admin, ou pão + Cestinha)
 * disputam a mesma indicação; a perdedora sai sem creditar. P2034 → repete (`withWriteConflictRetry`).
 *
 * @param from `PENDING` (automático) ou `ON_HOLD` (aprovação do admin, D-12)
 * @returns `true` só para quem pagou — é quem avisa.
 */
export async function rewardReferral(
  fastify: FastifyInstance,
  referralId: string,
  from: 'PENDING' | 'ON_HOLD',
  opts: {
    reviewerId?: string
    qualified?: { qualifiedAt: Date; qualifyingOrderId: string; qualifyingKind: 'ORDER' | 'MARKET' }
    now?: Date
  } = {},
): Promise<boolean> {
  const prisma = fastify.prisma
  const now = opts.now ?? new Date()
  const referral = await prisma.referral.findUnique({ where: { id: referralId } })
  if (!referral || referral.status !== from) return false

  const [referrer, friend] = await Promise.all([
    prisma.user.findUnique({ where: { id: referral.referrerId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: referral.referredId }, select: { name: true } }),
  ])

  const paid = await withWriteConflictRetry(() =>
    prisma.$transaction(async (tx) => {
      const claimed = await tx.referral.updateMany({
        where: { id: referralId, status: from },
        data: {
          status: 'REWARDED',
          rewardedAt: now,
          ...(opts.qualified ?? {}),
          ...(opts.reviewerId ? { reviewedById: opts.reviewerId, reviewedAt: now } : {}),
        },
      })
      if (claimed.count === 0) return false

      await tx.creditTransaction.create({
        data: {
          userId: referral.referrerId,
          type: 'REFERRAL_BONUS',
          quantityMilli: referral.rewardMilli,
          referenceId: referral.id,
          description: `${shortName(friend?.name)} recebeu o 1º pedido`,
        },
      })
      await tx.user.update({
        where: { id: referral.referrerId },
        data: { creditMilli: { increment: referral.rewardMilli } },
      })

      if (referral.welcomeMilli > 0) {
        await tx.creditTransaction.create({
          data: {
            userId: referral.referredId,
            type: 'REFERRAL_WELCOME',
            quantityMilli: referral.welcomeMilli,
            referenceId: referral.id,
            description: `Você veio pela indicação de ${shortName(referrer?.name)}`,
          },
        })
        await tx.user.update({
          where: { id: referral.referredId },
          data: { creditMilli: { increment: referral.welcomeMilli } },
        })
      }
      return true
    }),
  )
  if (!paid) return false

  await notifyRewarded(fastify, referral, referrer?.name, friend?.name)
  await grantMilestoneForReward(fastify, { id: referral.id, referrerId: referral.referrerId, rewardedAt: now })
  return true
}

/** Motivos de recusa do admin (D-12). O cliente nunca vê: para ele a indicação só "não valeu". */
export const REFERRAL_REJECT_REASONS = ['SAME_RESIDENCE', 'SAME_DEVICE', 'DUPLICATE_ACCOUNT', 'OTHER'] as const
export type ReferralRejectReason = (typeof REFERRAL_REJECT_REASONS)[number]

/**
 * Recusa de uma indicação em análise: só `ON_HOLD → REJECTED` (D-12). Indicação aguardando não é
 * recusável — ela ainda nem cumpriu a regra; quem decide o destino dela é o prazo.
 *
 * Mesma trava por status da recompensa: se outro admin aprovou no mesmo instante, o `updateMany`
 * não casa e a recusa sai sem efeito — nunca "recusa" algo que já foi pago.
 *
 * Sem aviso ao cliente: o handoff só mostra "Não valeu" na lista dele. O motivo e o detalhe ficam
 * para o admin.
 *
 * @returns `true` só para quem recusou de fato.
 */
export async function rejectReferral(
  fastify: FastifyInstance,
  referralId: string,
  reason: ReferralRejectReason,
  detail: string,
  adminId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const rejected = await fastify.prisma.referral.updateMany({
    where: { id: referralId, status: 'ON_HOLD' },
    data: { status: 'REJECTED', rejectReason: reason, rejectDetail: detail, reviewedById: adminId, reviewedAt: now },
  })
  return rejected.count > 0
}

/** Os três avisos da recompensa. Cada um best-effort: o crédito já foi feito. */
async function notifyRewarded(
  fastify: FastifyInstance,
  referral: { referrerId: string; referredId: string; rewardMilli: number; welcomeMilli: number },
  referrerName: string | undefined,
  friendName: string | undefined,
): Promise<void> {
  const notifications = new NotificationsService(fastify)
  const reward = breadsLabel(fromMilli(referral.rewardMilli))
  const tasks: Array<() => Promise<void>> = [
    () =>
      notifications.notifyUser(referral.referrerId, {
        type: 'REFERRAL_REWARD',
        title: `Você ganhou ${reward}!`,
        body: `${firstName(friendName) || 'Sua indicação'} recebeu o 1º pedido. Obrigado por espalhar o cheirinho de pão 🥖`,
        actionRoute: STATEMENT_ROUTE,
      }),
    () =>
      notifications.notifyAdmins({
        type: 'ADMIN_REFERRAL_REWARDED',
        title: 'Indicação recompensada',
        body: `${firstName(referrerName)} ganhou ${reward} por indicar ${firstName(friendName)}.`,
        actionRoute: '/admin',
      }),
  ]
  if (referral.welcomeMilli > 0) {
    tasks.push(() =>
      notifications.notifyUser(referral.referredId, {
        type: 'REFERRAL_WELCOME',
        title: 'Presente de boas-vindas 🎁',
        body: `Você ganhou ${breadsLabel(fromMilli(referral.welcomeMilli))} por ter vindo pela indicação de ${firstName(referrerName)}.`,
        actionRoute: STATEMENT_ROUTE,
      }),
    )
  }
  for (const task of tasks) {
    try {
      await task()
    } catch (err) {
      fastify.log.warn({ err }, '[referral] falha num aviso da recompensa — ignorado')
    }
  }
}

/**
 * Meta de quem indica: paga o bônus quando ESTA recompensa é a N-ésima que valeu e existe uma meta
 * em N.
 *
 * A posição é contada pelo `rewardedAt` (desempate pelo id), e não por "quantas existem agora":
 * duas recompensas juntas viram 5ª e 6ª, em vez de as duas contarem 6 e a meta da 5ª passar em
 * branco. E isso já dá o "não é retroativo" — meta criada depois de o cliente passar dela não
 * casa com nenhuma recompensa futura.
 *
 * O índice único `(referrerId, threshold)` é a trava de "uma vez por marco": a segunda tentativa
 * bate em P2002 e sai. BEST-EFFORT — a recompensa principal já foi paga.
 */
export async function grantMilestoneForReward(
  fastify: FastifyInstance,
  reward: { id: string; referrerId: string; rewardedAt: Date },
): Promise<boolean> {
  const prisma = fastify.prisma
  try {
    const config = await getReferralConfig(prisma)
    if (config.metas.length === 0) return false

    const before = await prisma.referral.count({
      where: {
        referrerId: reward.referrerId,
        status: 'REWARDED',
        OR: [{ rewardedAt: { lt: reward.rewardedAt } }, { rewardedAt: reward.rewardedAt, id: { lt: reward.id } }],
      },
    })
    const goal = config.metas.find((m) => m.quantidade === before + 1)
    if (!goal) return false

    await withWriteConflictRetry(() =>
      prisma.$transaction(async (tx) => {
        const milestone = await tx.referralMilestone.create({
          data: { referrerId: reward.referrerId, threshold: goal.quantidade, bonusMilli: toMilli(goal.bonus), seenAt: null },
          select: { id: true },
        })
        await tx.creditTransaction.create({
          data: {
            userId: reward.referrerId,
            type: 'REFERRAL_GOAL',
            quantityMilli: toMilli(goal.bonus),
            referenceId: milestone.id,
            description: `Bônus pela ${goal.quantidade}ª indicação que valeu`,
          },
        })
        await tx.user.update({
          where: { id: reward.referrerId },
          data: { creditMilli: { increment: toMilli(goal.bonus) } },
        })
      }),
    )
    return true
  } catch (err) {
    if ((err as { code?: unknown })?.code === 'P2002') return false // marco já pago
    fastify.log.warn({ err, referrerId: reward.referrerId }, '[referral] falha ao pagar a meta — ignorado')
    return false
  }
}

/**
 * Convite "Gostou do pãozin? Indique um vizinho" — uma vez na vida, depois de uma entrega, com o
 * programa ligado. Lê antes de reivindicar: quem já foi convidado (quase todo mundo, com o tempo)
 * sai com uma consulta só, sem ler a config.
 */
export async function sendReferralInvite(
  fastify: FastifyInstance,
  userId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const prisma = fastify.prisma
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, referralInviteAt: true } })
  if (!user || user.role !== 'CLIENT' || user.referralInviteAt) return false

  const config = await getReferralConfig(prisma)
  if (!config.ativa) return false

  const claimed = await prisma.user.updateMany({
    where: { id: userId, OR: [{ referralInviteAt: null }, { referralInviteAt: { isSet: false } }] },
    data: { referralInviteAt: now },
  })
  if (claimed.count === 0) return false

  await new NotificationsService(fastify).notifyUser(userId, {
    type: 'REFERRAL_INVITE',
    title: 'Gostou do pãozin?',
    body: `Indique um vizinho: quando ele receber o 1º pedido, você ganha ${breadsLabel(currentRewardBreads(config, now))}.`,
    actionRoute: REFERRAL_SCREEN_ROUTE,
  })
  return true
}

/**
 * Chamado nos 4 pontos de entrega (entregador/separação/admin, pedido parado de pão, Cestinha
 * parada, Cestinha do entregador): avalia a indicação do cliente e manda o convite.
 *
 * NUNCA lança — a confirmação da entrega não pode falhar por causa da indicação.
 */
export async function afterDelivery(fastify: FastifyInstance, userId: string): Promise<void> {
  try {
    await qualifyReferral(fastify, userId)
  } catch (err) {
    fastify.log.warn({ err, userId }, '[referral] falha ao avaliar a indicação na entrega — ignorado')
  }
  try {
    await sendReferralInvite(fastify, userId)
  } catch (err) {
    fastify.log.warn({ err, userId }, '[referral] falha ao enviar o convite — ignorado')
  }
}

/**
 * Varredura diária (rede de segurança do `afterDelivery`): reavalia toda indicação PENDING — expira
 * as vencidas e paga as que qualificaram sem o gatilho ter pego (erro na hora da entrega).
 */
export async function sweepReferrals(
  fastify: FastifyInstance,
  now: Date = new Date(),
): Promise<Record<QualifyOutcome, number>> {
  const counts: Record<QualifyOutcome, number> = { NONE: 0, PENDING: 0, EXPIRED: 0, ON_HOLD: 0, REWARDED: 0 }
  const pending = await fastify.prisma.referral.findMany({ where: { status: 'PENDING' }, select: { referredId: true } })
  for (const r of pending) {
    try {
      counts[await qualifyReferral(fastify, r.referredId, now)]++
    } catch (err) {
      fastify.log.warn({ err, referredId: r.referredId }, '[referral] varredura: falha numa indicação — seguindo')
    }
  }
  return counts
}

// ─────────────────────────────────────────────────────────────── comemoração (C5)

/** Comemoração da abertura (C5). Uma por abertura; o resto espera a próxima. */
export interface Celebration {
  variant: 'friend' | 'goal' | 'multi' | 'referrer'
  /** Pãezins da comemoração (o "+N"). */
  breads: number
  /** Primeiros nomes de quem recebeu o 1º pedido (referrer/multi). */
  names: string[]
  /** Primeiro nome de quem indicou (friend). */
  referrerName: string | null
  /** Meta atingida (goal) e a próxima, se houver. */
  goal: { threshold: number; bonus: number; next: { threshold: number; bonus: number } | null } | null
  /** O que o `POST /referrals/celebration/seen` deve marcar quando o modal fechar. */
  seen: { referralIds: string[]; goalThresholds: number[]; welcome: boolean }
}

/**
 * Monta a comemoração pendente, na prioridade do plano: `friend` → `goal` → `multi` (≥ 2
 * recompensas não vistas) → `referrer`. `null` = nada a comemorar.
 */
export async function buildCelebration(fastify: FastifyInstance, userId: string): Promise<Celebration | null> {
  const prisma = fastify.prisma
  const [welcome, milestones, rewards] = await Promise.all([
    prisma.referral.findFirst({
      where: { referredId: userId, status: 'REWARDED', welcomeMilli: { gt: 0 }, welcomeSeenAt: null },
      select: { welcomeMilli: true, referrerId: true },
    }),
    prisma.referralMilestone.findMany({
      where: { referrerId: userId, seenAt: null },
      select: { threshold: true, bonusMilli: true },
      orderBy: { threshold: 'asc' },
    }),
    prisma.referral.findMany({
      where: { referrerId: userId, status: 'REWARDED', rewardSeenAt: null },
      select: { id: true, rewardMilli: true, referredId: true },
      orderBy: { rewardedAt: 'asc' },
    }),
  ])

  const empty = { names: [], referrerName: null, goal: null }

  if (welcome) {
    const referrer = await prisma.user.findUnique({ where: { id: welcome.referrerId }, select: { name: true } })
    return {
      ...empty,
      variant: 'friend',
      breads: fromMilli(welcome.welcomeMilli),
      referrerName: firstName(referrer?.name) || null,
      seen: { referralIds: [], goalThresholds: [], welcome: true },
    }
  }

  if (milestones.length > 0) {
    const hit = milestones[0]
    const config = await getReferralConfig(prisma)
    const next = config.metas.find((m) => m.quantidade > hit.threshold)
    return {
      ...empty,
      variant: 'goal',
      breads: fromMilli(hit.bonusMilli),
      goal: {
        threshold: hit.threshold,
        bonus: fromMilli(hit.bonusMilli),
        next: next ? { threshold: next.quantidade, bonus: next.bonus } : null,
      },
      seen: { referralIds: [], goalThresholds: [hit.threshold], welcome: false },
    }
  }

  if (rewards.length > 0) {
    const friends = await prisma.user.findMany({
      where: { id: { in: rewards.map((r) => r.referredId) } },
      select: { id: true, name: true },
    })
    const nameById = new Map(friends.map((f) => [f.id, firstName(f.name)]))
    return {
      ...empty,
      variant: rewards.length >= 2 ? 'multi' : 'referrer',
      breads: fromMilli(rewards.reduce((acc, r) => acc + r.rewardMilli, 0)),
      names: rewards.map((r) => nameById.get(r.referredId) ?? '').filter(Boolean),
      seen: { referralIds: rewards.map((r) => r.id), goalThresholds: [], welcome: false },
    }
  }

  return null
}

/** Marca o que o modal mostrou. Só mexe no que é do próprio usuário. */
export async function markCelebrationSeen(
  prisma: Pick<PrismaClient, 'referral' | 'referralMilestone'>,
  userId: string,
  seen: { referralIds?: string[]; goalThresholds?: number[]; welcome?: boolean },
  now: Date = new Date(),
): Promise<void> {
  if (seen.referralIds?.length) {
    await prisma.referral.updateMany({
      where: { id: { in: seen.referralIds }, referrerId: userId, rewardSeenAt: null },
      data: { rewardSeenAt: now },
    })
  }
  if (seen.goalThresholds?.length) {
    await prisma.referralMilestone.updateMany({
      where: { referrerId: userId, threshold: { in: seen.goalThresholds }, seenAt: null },
      data: { seenAt: now },
    })
  }
  if (seen.welcome) {
    await prisma.referral.updateMany({
      where: { referredId: userId, welcomeSeenAt: null },
      data: { welcomeSeenAt: now },
    })
  }
}
