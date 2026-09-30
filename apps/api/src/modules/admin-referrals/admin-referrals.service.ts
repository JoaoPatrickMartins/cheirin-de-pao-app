import { FastifyInstance } from 'fastify'
import type { Prisma, ReferralStatus, TransactionType } from '@prisma/client'
import { fromMilli } from '@cheirin-de-pao/shared'
import { getReferralConfig } from '../../lib/referral-config.js'
import { ensureReferralCode, normalizeCode } from '../../lib/referral-code.js'
import {
  REFERRAL_FLAG_LABELS,
  createReferral,
  findCodeOwner,
  isValidOwner,
  qualifyReferral,
  referralStateKey,
  rejectReferral,
  rewardReferral,
  type QualifyOutcome,
  type ReferralFlag,
  type ReferralStateKey,
} from '../../lib/referral.js'
import type { ListReferralsQuery, ReferralListFilter, RejectReferralBody } from './admin-referrals.schema.js'

/** Indicações por página no A4. */
export const REFERRALS_PAGE_SIZE = 20

/** Máximo de pessoas que a busca por nome considera (nome muito comum → refine a busca). */
const SEARCH_USER_LIMIT = 500

/** Máximo de indicados no card do detalhe do cliente (A5). */
const CLIENT_LIST_LIMIT = 50

/** Status do modelo por chip. `aguardando` junta `cadastro` e `aguardando` (os dois PENDING). */
const STATUS_BY_FILTER: Record<Exclude<ReferralListFilter, 'todas'>, ReferralStatus> = {
  analise: 'ON_HOLD',
  aguardando: 'PENDING',
  ganhou: 'REWARDED',
  recusada: 'REJECTED',
  expirou: 'EXPIRED',
}

/** O que o programa deu a quem indica — indicações + metas (o mesmo "pãezins ganhos" do C1). */
const REFERRER_TX_TYPES: TransactionType[] = ['REFERRAL_BONUS', 'REFERRAL_GOAL']

const OBJECT_ID = /^[0-9a-fA-F]{24}$/

export type ReferralCounts = Record<ReferralListFilter, number>

export interface AdminReferralListItem {
  id: string
  state: ReferralStateKey
  referrer: { id: string; name: string }
  referred: { id: string; name: string }
  createdAt: string
  /** Condomínio do amigo. */
  condo: string | null
  /** Rótulos dos sinais de análise (§4.4) — só o admin vê. */
  signals: string[]
}

export interface AdminReferralDetail {
  id: string
  state: ReferralStateKey
  referrer: { id: string; name: string }
  referred: { id: string; name: string }
  condo: string | null
  signals: string[]
  code: string
  source: string
  /** Valores CONGELADOS no cadastro (invariante 4). */
  rewardBreads: number
  welcomeBreads: number
  campaignLabel: string | null
  timeline: {
    cadastro: string
    login: string | null
    pagamento: string | null
    entrega: string | null
    recompensa: string | null
  }
  reviewedAt: string | null
  rejectReason: string | null
  rejectDetail: string | null
  expiresAt: string | null
}

export interface AdminClientReferrals {
  /** Programa ligado — com ele desligado, o vínculo manual não existe (§4.8). */
  active: boolean
  code: string | null
  referredBy: { id: string; name: string; state: ReferralStateKey } | null
  stats: { fez: number; valeram: number; earnedBreads: number }
  referrals: Array<{ id: string; name: string; createdAt: string; state: ReferralStateKey }>
}

export interface AdminCodeCheck {
  valid: boolean
  /** O código é do próprio cliente — "ninguém pode indicar a si mesmo". */
  self: boolean
  owner: { name: string; condo: string | null } | null
}

/** Erro de domínio que o controller traduz em status HTTP. */
function fail(statusCode: number, message: string): never {
  throw { statusCode, message }
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null
}

function signalsOf(flags: string[]): string[] {
  return flags.map((f) => REFERRAL_FLAG_LABELS[f as ReferralFlag] ?? f)
}

/**
 * AdminReferralsService — Indique e Ganhe, lado do admin (A4 e A5). A regra do programa mora em
 * `lib/referral.ts` (aprovar = `rewardReferral` a partir de ON_HOLD, recusar = `rejectReferral`);
 * aqui só a montagem das respostas e as checagens de quem pode o quê.
 */
export class AdminReferralsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /** Nomes por id, numa consulta só. */
  private async namesById(ids: string[]): Promise<Map<string, { name: string; condominiumId: string | null }>> {
    const unique = [...new Set(ids)]
    if (unique.length === 0) return new Map()
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, condominiumId: true },
    })
    return new Map(users.map((u) => [u.id, { name: u.name, condominiumId: u.condominiumId ?? null }]))
  }

  private async condoNames(ids: Array<string | null>): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))]
    if (unique.length === 0) return new Map()
    const condos = await this.prisma.condominium.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } })
    return new Map(condos.map((c) => [c.id, c.name]))
  }

  /**
   * Contagem por chip — GLOBAL, sem a busca: o selo "N em análise" do hub (A1/A2) e o do chip
   * precisam dizer o mesmo número, qualquer que seja o filtro aberto.
   */
  async counts(): Promise<ReferralCounts> {
    const [analise, aguardando, ganhou, recusada, expirou] = await Promise.all(
      (['ON_HOLD', 'PENDING', 'REWARDED', 'REJECTED', 'EXPIRED'] as const).map((status) =>
        this.prisma.referral.count({ where: { status } }),
      ),
    )
    return { analise, aguardando, ganhou, recusada, expirou, todas: analise + aguardando + ganhou + recusada + expirou }
  }

  /** `GET /admin/referrals/summary` — só o que o hub de Gestão precisa (A1). */
  async summary(): Promise<{ pendingReview: number }> {
    return { pendingReview: await this.prisma.referral.count({ where: { status: 'ON_HOLD' } }) }
  }

  /**
   * `GET /admin/referrals` — lista do A4. "Em análise" vem da mais antiga para a mais nova (é uma
   * fila: quem espera há mais tempo primeiro); os outros filtros, da mais recente.
   */
  async list(query: ListReferralsQuery): Promise<{
    items: AdminReferralListItem[]
    counts: ReferralCounts
    total: number
    page: number
    pageSize: number
  }> {
    const { state, q, page } = query
    const where: Prisma.ReferralWhereInput = state === 'todas' ? {} : { status: STATUS_BY_FILTER[state] }

    const term = q?.trim()
    if (term) {
      // A busca é pelo nome de QUALQUER uma das duas pessoas.
      const users = await this.prisma.user.findMany({
        where: { name: { contains: term, mode: 'insensitive' } },
        select: { id: true },
        take: SEARCH_USER_LIMIT,
      })
      const ids = users.map((u) => u.id)
      if (ids.length === 0) {
        return { items: [], counts: await this.counts(), total: 0, page, pageSize: REFERRALS_PAGE_SIZE }
      }
      where.OR = [{ referrerId: { in: ids } }, { referredId: { in: ids } }]
    }

    const [rows, total, counts] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        orderBy: { createdAt: state === 'analise' ? 'asc' : 'desc' },
        skip: (page - 1) * REFERRALS_PAGE_SIZE,
        take: REFERRALS_PAGE_SIZE,
        select: { id: true, referrerId: true, referredId: true, status: true, verifiedAt: true, createdAt: true, flags: true },
      }),
      this.prisma.referral.count({ where }),
      this.counts(),
    ])

    const people = await this.namesById(rows.flatMap((r) => [r.referrerId, r.referredId]))
    const condos = await this.condoNames(rows.map((r) => people.get(r.referredId)?.condominiumId ?? null))

    return {
      items: rows.map((r) => {
        const friend = people.get(r.referredId)
        return {
          id: r.id,
          state: referralStateKey(r),
          referrer: { id: r.referrerId, name: people.get(r.referrerId)?.name ?? '' },
          referred: { id: r.referredId, name: friend?.name ?? '' },
          createdAt: r.createdAt.toISOString(),
          condo: (friend?.condominiumId && condos.get(friend.condominiumId)) || null,
          signals: signalsOf(r.flags),
        }
      }),
      counts,
      total,
      page,
      pageSize: REFERRALS_PAGE_SIZE,
    }
  }

  /**
   * `GET /admin/referrals/:id` — o sheet do A4: as duas pessoas, sinais, valores congelados e a
   * linha do tempo (cadastro · 1º login · 1º pagamento · 1ª entrega · recompensa).
   *
   * Pagamento e entrega são os PRIMEIROS do amigo, lidos na hora (filtrados em código, como na
   * qualificação: `purpose` nulo OU ausente = compra de pão; `deliveredAt ?? scheduledDate`).
   */
  async detail(id: string): Promise<AdminReferralDetail | null> {
    if (!OBJECT_ID.test(id)) return null
    const referral = await this.prisma.referral.findUnique({ where: { id } })
    if (!referral) return null

    const deliveredSelect = { deliveredAt: true, scheduledDate: true } as const
    const [people, payments, order, market] = await Promise.all([
      this.namesById([referral.referrerId, referral.referredId]),
      this.prisma.payment.findMany({
        where: { userId: referral.referredId, status: 'PAID' },
        select: { createdAt: true, purpose: true, amount: true },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
      this.prisma.order.findFirst({
        where: { userId: referral.referredId, status: 'DELIVERED' },
        select: deliveredSelect,
        orderBy: { scheduledDate: 'asc' },
      }),
      this.prisma.marketOrder.findFirst({
        where: { userId: referral.referredId, status: 'DELIVERED' },
        select: deliveredSelect,
        orderBy: { scheduledDate: 'asc' },
      }),
    ])
    const friend = people.get(referral.referredId)
    const condos = await this.condoNames([friend?.condominiumId ?? null])

    const firstPayment = payments.find((p) => p.purpose !== 'HOOK' && p.amount > 0)?.createdAt ?? null
    const deliveries = [order, market]
      .filter((o): o is NonNullable<typeof o> => !!o)
      .map((o) => o.deliveredAt ?? o.scheduledDate)
      .sort((a, b) => a.getTime() - b.getTime())

    return {
      id: referral.id,
      state: referralStateKey(referral),
      referrer: { id: referral.referrerId, name: people.get(referral.referrerId)?.name ?? '' },
      referred: { id: referral.referredId, name: friend?.name ?? '' },
      condo: (friend?.condominiumId && condos.get(friend.condominiumId)) || null,
      signals: signalsOf(referral.flags),
      code: referral.code,
      source: referral.source,
      rewardBreads: fromMilli(referral.rewardMilli),
      welcomeBreads: fromMilli(referral.welcomeMilli),
      campaignLabel: referral.campaignLabel ?? null,
      timeline: {
        cadastro: referral.createdAt.toISOString(),
        login: iso(referral.verifiedAt),
        pagamento: iso(firstPayment),
        entrega: iso(deliveries[0] ?? null),
        recompensa: iso(referral.rewardedAt),
      },
      reviewedAt: iso(referral.reviewedAt),
      rejectReason: referral.rejectReason ?? null,
      rejectDetail: referral.rejectDetail ?? null,
      expiresAt: iso(referral.expiresAt),
    }
  }

  /**
   * `POST /admin/referrals/:id/approve` — só `ON_HOLD → REWARDED` (D-12). Paga, avisa e confere a
   * meta pelo mesmo caminho da recompensa automática.
   */
  async approve(id: string, adminId: string): Promise<void> {
    if (!OBJECT_ID.test(id)) fail(404, 'Indicação não encontrada.')
    const referral = await this.prisma.referral.findUnique({ where: { id }, select: { status: true } })
    if (!referral) fail(404, 'Indicação não encontrada.')
    if (referral.status !== 'ON_HOLD') fail(409, 'Esta indicação não está mais em análise.')
    const paid = await rewardReferral(this.fastify, id, 'ON_HOLD', { reviewerId: adminId })
    // Outro admin decidiu no mesmo instante: a trava por status deixou só um passar.
    if (!paid) fail(409, 'Esta indicação não está mais em análise.')
  }

  /** `POST /admin/referrals/:id/reject` — só `ON_HOLD → REJECTED`, com motivo + detalhe (D-12). */
  async reject(id: string, body: RejectReferralBody, adminId: string): Promise<void> {
    if (!OBJECT_ID.test(id)) fail(404, 'Indicação não encontrada.')
    const referral = await this.prisma.referral.findUnique({ where: { id }, select: { status: true } })
    if (!referral) fail(404, 'Indicação não encontrada.')
    if (referral.status !== 'ON_HOLD') fail(409, 'Só dá para recusar uma indicação em análise.')
    const rejected = await rejectReferral(this.fastify, id, body.reason, body.detail, adminId)
    if (!rejected) fail(409, 'Só dá para recusar uma indicação em análise.')
  }

  /** O cliente existe e é CLIENT? (entregador e admin não participam — §4.6) */
  private async findClient(clientId: string): Promise<{ id: string; name: string } | null> {
    if (!OBJECT_ID.test(clientId)) return null
    const user = await this.prisma.user.findUnique({ where: { id: clientId }, select: { id: true, name: true, role: true } })
    return user && user.role === 'CLIENT' ? { id: user.id, name: user.name } : null
  }

  /**
   * `GET /admin/clients/:id/referrals` — o card do A5 e a linha "Indicado por". Gera o código do
   * cliente se ainda não existir: o admin precisa conseguir ditar o código para quem pergunta.
   */
  async clientReferrals(clientId: string): Promise<AdminClientReferrals | null> {
    const client = await this.findClient(clientId)
    if (!client) return null
    const prisma = this.prisma

    const [config, code, asFriend, mine, valeram, earnedRows] = await Promise.all([
      getReferralConfig(prisma),
      ensureReferralCode(prisma, clientId),
      prisma.referral.findUnique({
        where: { referredId: clientId },
        select: { referrerId: true, status: true, verifiedAt: true },
      }),
      prisma.referral.findMany({
        where: { referrerId: clientId },
        orderBy: { createdAt: 'desc' },
        take: CLIENT_LIST_LIMIT,
        select: { id: true, referredId: true, status: true, verifiedAt: true, createdAt: true },
      }),
      prisma.referral.count({ where: { referrerId: clientId, status: 'REWARDED' } }),
      prisma.creditTransaction.findMany({
        where: { userId: clientId, type: { in: REFERRER_TX_TYPES } },
        select: { quantityMilli: true },
      }),
    ])
    const fez = await prisma.referral.count({ where: { referrerId: clientId } })
    const people = await this.namesById([...mine.map((r) => r.referredId), ...(asFriend ? [asFriend.referrerId] : [])])

    return {
      active: config.ativa,
      code,
      referredBy: asFriend
        ? { id: asFriend.referrerId, name: people.get(asFriend.referrerId)?.name ?? '', state: referralStateKey(asFriend) }
        : null,
      stats: {
        fez,
        valeram,
        earnedBreads: fromMilli(earnedRows.reduce((acc, r) => acc + (r.quantityMilli ?? 0), 0)),
      },
      referrals: mine.map((r) => ({
        id: r.id,
        name: people.get(r.referredId)?.name ?? '',
        createdAt: r.createdAt.toISOString(),
        state: referralStateKey(r),
      })),
    }
  }

  /**
   * `GET /admin/clients/:id/referral-code-check?code=` — o sheet "Vincular indicação" confere o
   * código antes do Confirmar. O admin vê o nome completo e o condomínio do dono (não é LGPD de
   * cliente para cliente: o admin já enxerga os dois cadastros).
   */
  async checkCode(clientId: string, rawCode: string): Promise<AdminCodeCheck | null> {
    const client = await this.findClient(clientId)
    if (!client) return null
    const owner = await findCodeOwner(this.prisma, rawCode)
    if (owner?.id === clientId) return { valid: false, self: true, owner: null }
    if (!isValidOwner(owner)) return { valid: false, self: false, owner: null }
    const full = await this.prisma.user.findUnique({ where: { id: owner.id }, select: { condominiumId: true } })
    const condos = await this.condoNames([full?.condominiumId ?? null])
    return {
      valid: true,
      self: false,
      owner: { name: owner.name, condo: (full?.condominiumId && condos.get(full.condominiumId)) || null },
    }
  }

  /**
   * `POST /admin/clients/:id/referral` — vínculo manual, para quem esqueceu o código no cadastro.
   *
   * - Só com o programa ligado: desligado, "código novo não vincula" (§4.8) — vale para o admin
   *   também, senão o botão prometeria valores de um programa que não está no ar.
   * - Uma vez só: `createReferral` devolve `null` quando o cliente já tem indicador (índice único
   *   de `referredId` — o banco decide, não uma leitura antes).
   * - `verifiedAt` já preenchido: o cliente existe e já entrou no app; não há cadastro a confirmar.
   * - Avalia na hora: se o cliente já pagou e recebeu, a indicação é paga (ou vai para análise)
   *   agora — é o "ou é recompensada na hora" do handoff.
   */
  async link(
    clientId: string,
    rawCode: string,
  ): Promise<{ outcome: QualifyOutcome; referredBy: { id: string; name: string } }> {
    const client = await this.findClient(clientId)
    if (!client) fail(404, 'Cliente não encontrado.')
    const config = await getReferralConfig(this.prisma)
    if (!config.ativa) fail(422, 'O programa está desligado. Ligue em Gestão › Indique e Ganhe para vincular.')

    const code = normalizeCode(rawCode)
    const owner = await findCodeOwner(this.prisma, code)
    if (owner?.id === clientId) fail(422, 'Esse é o código do próprio cliente. Ninguém pode indicar a si mesmo.')
    if (!isValidOwner(owner)) fail(422, 'Código não encontrado. Confira as letras com o cliente.')

    const now = new Date()
    const created = await createReferral(this.prisma, {
      referrerId: owner.id,
      referredId: clientId,
      code,
      source: 'ADMIN',
      config,
      verifiedAt: now,
      now,
    })
    if (!created) fail(409, 'Este cliente já tem uma indicação.')

    let outcome: QualifyOutcome = 'PENDING'
    try {
      outcome = await qualifyReferral(this.fastify, clientId, now)
    } catch (err) {
      // O vínculo já está gravado; a varredura diária reavalia se a avaliação falhou agora.
      this.fastify.log.warn({ err, clientId }, '[admin-referrals] vínculo feito, avaliação falhou — a varredura reavalia')
    }
    return { outcome, referredBy: { id: owner.id, name: owner.name } }
  }
}
