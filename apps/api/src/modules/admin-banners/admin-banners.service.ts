import { FastifyInstance } from 'fastify'
import { CreateBannerSchema, type CreateBannerInput, type UpdateBannerInput } from '@cheirin-de-pao/shared'
import { bannerStatus, type BannerStatus } from '../../lib/banner-visibility.js'

/** Números de desempenho de uma peça, na lista do admin. */
export interface BannerMetrics {
  /** Clientes distintos que viram — é o denominador do CTR. */
  reach: number
  /** Somatório das exibições (um mesmo cliente pode contar várias vezes). */
  impressions: number
  clicks: number
  dismissals: number
  /** cliques ÷ alcance, 0..1. Zero quando ninguém viu. */
  ctr: number
}

const ZERO_METRICS: BannerMetrics = { reach: 0, impressions: 0, clicks: 0, dismissals: 0, ctr: 0 }

/**
 * AdminBannersService — CRUD das peças de comunicação (banners, avisos e promoções).
 *
 * Duas decisões que valem registro:
 *
 * 1. O PATCH é validado sobre o objeto MESCLADO (gravado + patch), nunca sobre o patch solto.
 *    Validar o patch isolado deixaria passar trocar o formato para STRIP mantendo a imagem que
 *    já estava lá — e a regra "faixa não tem imagem" existe justamente para isso não acontecer.
 *
 * 2. O status (no ar / agendado / expirado / pausado) é DERIVADO na leitura, nunca gravado.
 *    Ver lib/banner-visibility.ts.
 */
export class AdminBannersService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Métricas de todas as peças, em UMA agregação — a lista do admin não pode disparar uma query
   * por banner. `_count` de um campo anulável conta só os não-nulos, que é exatamente a definição
   * de "clicou" e "dispensou".
   */
  private async metricsByBanner(): Promise<Map<string, BannerMetrics>> {
    const rows = await this.prisma.bannerView.groupBy({
      by: ['bannerId'],
      _count: { _all: true, clickedAt: true, dismissedAt: true },
      _sum: { seenCount: true },
    })

    return new Map(
      rows.map((r) => {
        const reach = r._count._all
        const clicks = r._count.clickedAt
        return [
          r.bannerId,
          {
            reach,
            impressions: r._sum.seenCount ?? 0,
            clicks,
            dismissals: r._count.dismissedAt,
            ctr: reach > 0 ? clicks / reach : 0,
          },
        ]
      }),
    )
  }

  /**
   * Lista completa para o admin, com status e métricas.
   *
   * Ordem: no ar primeiro (por prioridade), depois agendados (o que começa antes na frente),
   * depois pausados, e expirados por último — a ordem em que o admin se importa com eles.
   */
  async list(now: Date = new Date()) {
    const [banners, metrics] = await Promise.all([
      this.prisma.banner.findMany({ orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] }),
      this.metricsByBanner(),
    ])

    const RANK: Record<BannerStatus, number> = { live: 0, scheduled: 1, paused: 2, expired: 3 }

    return banners
      .map((b) => ({ ...b, status: bannerStatus(b, now), metrics: metrics.get(b.id) ?? ZERO_METRICS }))
      .sort((a, b) => {
        const byStatus = RANK[a.status] - RANK[b.status]
        if (byStatus !== 0) return byStatus
        // Dentro de "agendado", o que estreia primeiro aparece primeiro; nos demais vale a
        // prioridade, que o banco já ordenou.
        if (a.status === 'scheduled' && b.status === 'scheduled') {
          return (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0)
        }
        return 0
      })
  }

  async get(id: string, now: Date = new Date()) {
    const banner = await this.prisma.banner.findUnique({ where: { id } })
    if (!banner) throw { statusCode: 404, message: 'Banner não encontrado' }
    return { ...banner, status: bannerStatus(banner, now) }
  }

  async create(input: CreateBannerInput, adminId: string) {
    return this.prisma.banner.create({ data: { ...input, createdById: adminId } })
  }

  /** Ver a decisão 1 no cabeçalho da classe: valida o resultado da mesclagem, não o patch. */
  async update(id: string, patch: UpdateBannerInput) {
    const atual = await this.prisma.banner.findUnique({ where: { id } })
    if (!atual) throw { statusCode: 404, message: 'Banner não encontrado' }

    const merged = CreateBannerSchema.parse({ ...atual, ...patch })
    return this.prisma.banner.update({ where: { id }, data: merged })
  }

  /**
   * Remove a peça e o histórico dela. Deixar os `BannerView` órfãos inflaria a coleção para
   * sempre, e um banner recriado com o mesmo id não existe — o histórico não serve a ninguém.
   */
  async remove(id: string) {
    const atual = await this.prisma.banner.findUnique({ where: { id } })
    if (!atual) throw { statusCode: 404, message: 'Banner não encontrado' }

    await this.prisma.bannerView.deleteMany({ where: { bannerId: id } })
    await this.prisma.banner.delete({ where: { id } })
    return { ok: true }
  }
}
