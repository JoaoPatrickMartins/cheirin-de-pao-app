import { FastifyInstance } from 'fastify'
import type { TransactionType } from '@prisma/client'
import { fromMilli } from '@cheirin-de-pao/shared'
import { activeCampaign, currentRewardBreads, getReferralConfig, type ReferralConfig } from '../../lib/referral-config.js'
import { ensureReferralCode, firstName, shortName } from '../../lib/referral-code.js'
import {
  buildCelebration,
  checkPublicCode,
  markCelebrationSeen,
  referralStateKey,
  type Celebration,
  type PublicCodeCheck,
  type ReferralStateKey,
} from '../../lib/referral.js'
import { presetWindow } from '../../lib/date-range.js'

/** Card da Home fechado fica escondido por 30 dias (D-11). */
const HOME_CARD_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

/** Lançamentos que o programa dá — o "+N este mês" do extrato (C7). */
const REFERRAL_TX_TYPES: TransactionType[] = ['REFERRAL_BONUS', 'REFERRAL_WELCOME', 'REFERRAL_GOAL']

/** "Pãezins ganhos" do C1: tudo o que o programa deu a QUEM INDICA — indicações + metas (A-15). */
const REFERRER_TX_TYPES: TransactionType[] = ['REFERRAL_BONUS', 'REFERRAL_GOAL']

/** Máximo de indicados na lista do C1 (os mais recentes). */
const LIST_LIMIT = 200

type Campaign = { label: string; until: string } | null

export interface ReferralSummary {
  active: boolean
  hasReferrals: boolean
  isNew: boolean
  rewardBreads: number
  campaign: Campaign
  homeCard: { visible: boolean }
  bonusThisMonth: number
  celebration: Celebration | null
}

export interface ReferralMe {
  state: 'active' | 'paused'
  code: string | null
  messageTemplate: string
  referrerFirstName: string
  rewardBreads: number
  baseRewardBreads: number
  welcomeBreads: number
  campaign: Campaign
  rules: { prazoDias: number; compraMinima: number }
  stats: { earnedBreads: number; valeram: number; emAndamento: number }
  goals: {
    count: number
    milestones: Array<{ quantidade: number; bonus: number; reached: boolean; paid: boolean }>
    justHit: { quantidade: number; bonus: number } | null
    next: { quantidade: number; bonus: number } | null
  }
  referrals: Array<{
    id: string
    name: string
    state: ReferralStateKey
    date: string
    rewardBreads: number | null
    campaign: boolean
  }>
}

function campaignOf(config: ReferralConfig, now: Date): Campaign {
  const c = activeCampaign(config, now)
  return c ? { label: c.rotulo, until: c.fim } : null
}

/** Soma de lançamentos em pãezins (a conta em milésimos, a conversão no fim). */
function sumBreads(rows: Array<{ quantityMilli: number | null }>): number {
  return fromMilli(rows.reduce((acc, r) => acc + (r.quantityMilli ?? 0), 0))
}

/**
 * ReferralsService — lado do cliente do Indique e Ganhe. A regra do programa mora em
 * `lib/referral.ts`; aqui só a montagem das respostas.
 */
export class ReferralsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /** `GET /referrals/config` — o cadastro decide se mostra o campo do código (C4). */
  async publicConfig(): Promise<{ active: boolean; welcomeBreads: number }> {
    const config = await getReferralConfig(this.prisma)
    return { active: config.ativa, welcomeBreads: config.ativa ? config.bonusIndicado : 0 }
  }

  /** `GET /referrals/code/:code` — confere o código digitado ou vindo do link. */
  checkCode(code: string): Promise<PublicCodeCheck> {
    return checkPublicCode(this.prisma, code)
  }

  /**
   * `GET /referrals/summary` — as entradas leves: Perfil (C2), Home (C3), comemoração (C5) e
   * cabeçalho do extrato (C7). Uma chamada só na abertura, em vez de cada tela perguntar.
   */
  async summary(userId: string, now: Date = new Date()): Promise<ReferralSummary> {
    const prisma = this.prisma
    const monthStart = presetWindow('month', now).startDate
    const [config, user, referralCount, monthRows, celebration] = await Promise.all([
      getReferralConfig(prisma),
      prisma.user.findUnique({
        where: { id: userId },
        select: { referralCode: true, referralCardDismissedAt: true },
      }),
      prisma.referral.count({ where: { referrerId: userId } }),
      prisma.creditTransaction.findMany({
        where: { userId, type: { in: REFERRAL_TX_TYPES }, createdAt: { gte: monthStart } },
        select: { quantityMilli: true },
      }),
      buildCelebration(this.fastify, userId),
    ])

    // Card da Home: programa ligado + já recebeu ≥ 1 entrega + não fechado nos últimos 30 dias.
    // As contagens de entrega só rodam quando o resto já deixaria o card aparecer.
    const dismissedAt = user?.referralCardDismissedAt ?? null
    const snoozed = !!dismissedAt && now.getTime() - dismissedAt.getTime() < HOME_CARD_SNOOZE_MS
    let homeCardVisible = false
    if (config.ativa && !snoozed) {
      const [orders, markets] = await Promise.all([
        prisma.order.count({ where: { userId, status: 'DELIVERED' } }),
        prisma.marketOrder.count({ where: { userId, status: 'DELIVERED' } }),
      ])
      homeCardVisible = orders + markets > 0
    }

    return {
      active: config.ativa,
      hasReferrals: referralCount > 0,
      isNew: !(user?.referralCode ?? null),
      rewardBreads: currentRewardBreads(config, now),
      campaign: campaignOf(config, now),
      homeCard: { visible: homeCardVisible },
      bonusThisMonth: sumBreads(monthRows),
      celebration,
    }
  }

  /**
   * `GET /referrals/me` — a tela C1. Com o programa ligado, gera o código na primeira abertura.
   * Desligado: estado `paused` (só histórico, sem código nem compartilhar — §4.8).
   *
   * A mensagem vai como MODELO (`messageTemplate`): o link é `${origin}/?ref=CODIGO`, e só o app
   * sabe a própria origem — o front monta com `renderReferralMessage`, a mesma função do shared.
   */
  async me(userId: string, now: Date = new Date()): Promise<ReferralMe> {
    const prisma = this.prisma
    const config = await getReferralConfig(prisma)
    const state = config.ativa ? 'active' : 'paused'

    const [user, code, referrals, earnedRows, milestones] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      config.ativa ? ensureReferralCode(prisma, userId) : Promise.resolve(null),
      prisma.referral.findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: 'desc' },
        take: LIST_LIMIT,
        select: {
          id: true,
          referredId: true,
          status: true,
          verifiedAt: true,
          createdAt: true,
          rewardedAt: true,
          rewardMilli: true,
          campaignMultiplier: true,
        },
      }),
      prisma.creditTransaction.findMany({
        where: { userId, type: { in: REFERRER_TX_TYPES } },
        select: { quantityMilli: true },
      }),
      prisma.referralMilestone.findMany({ where: { referrerId: userId }, select: { threshold: true } }),
    ])

    const friends = await prisma.user.findMany({
      where: { id: { in: referrals.map((r) => r.referredId) } },
      select: { id: true, name: true },
    })
    const nameById = new Map(friends.map((f) => [f.id, shortName(f.name)]))

    // Contagens sobre a lista inteira, não sobre a página: com mais de 200 indicações, o resumo
    // continuaria certo.
    const [valeram, emAndamento] = await Promise.all([
      prisma.referral.count({ where: { referrerId: userId, status: 'REWARDED' } }),
      prisma.referral.count({ where: { referrerId: userId, status: { in: ['PENDING', 'ON_HOLD'] } } }),
    ])

    const paid = new Set(milestones.map((m) => m.threshold))
    const goal = (m: { quantidade: number; bonus: number }) => ({ quantidade: m.quantidade, bonus: m.bonus })

    return {
      state,
      code,
      messageTemplate: config.mensagem,
      referrerFirstName: firstName(user?.name),
      rewardBreads: currentRewardBreads(config, now),
      baseRewardBreads: config.recompensa,
      welcomeBreads: config.bonusIndicado,
      campaign: campaignOf(config, now),
      rules: { prazoDias: config.prazoDias, compraMinima: config.compraMinima },
      stats: { earnedBreads: sumBreads(earnedRows), valeram, emAndamento },
      goals: {
        count: valeram,
        milestones: config.metas.map((m) => ({
          ...goal(m),
          reached: valeram >= m.quantidade,
          paid: paid.has(m.quantidade),
        })),
        justHit: (() => {
          const hit = config.metas.find((m) => m.quantidade === valeram)
          return hit ? goal(hit) : null
        })(),
        next: (() => {
          const next = config.metas.find((m) => m.quantidade > valeram)
          return next ? goal(next) : null
        })(),
      },
      referrals: referrals.map((r) => {
        const key = referralStateKey(r)
        return {
          id: r.id,
          name: nameById.get(r.referredId) ?? '',
          state: key,
          // Recompensada mostra quando valeu; as outras, quando o amigo se cadastrou.
          date: (key === 'ganhou' ? (r.rewardedAt ?? r.createdAt) : r.createdAt).toISOString(),
          rewardBreads: key === 'ganhou' ? fromMilli(r.rewardMilli) : null,
          campaign: r.campaignMultiplier > 1,
        }
      }),
    }
  }

  /** `POST /referrals/celebration/seen` — marca o que o modal mostrou. */
  markCelebrationSeen(
    userId: string,
    seen: { referralIds?: string[]; goalThresholds?: number[]; welcome?: boolean },
  ): Promise<void> {
    return markCelebrationSeen(this.prisma, userId, seen)
  }

  /** `POST /referrals/home-card/dismiss` — some por 30 dias, em qualquer aparelho (D-11). */
  async dismissHomeCard(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { referralCardDismissedAt: new Date() } })
  }
}
