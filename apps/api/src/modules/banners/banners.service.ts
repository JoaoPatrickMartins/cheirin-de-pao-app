import { FastifyInstance } from 'fastify'
import type { Banner } from '@prisma/client'
import type { BannerEvent } from '@cheirin-de-pao/shared'
import { resolveActionUrl, selectForClient, type BannerViewFields } from '../../lib/banner-visibility.js'

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/

/** Uma peça como o CLIENTE a recebe — só o que a tela desenha, mais a URL já resolvida. */
export interface ClientBanner {
  id: string
  imageUrl: string | null
  alt: string | null
  title: string | null
  body: string | null
  bgColor: string | null
  ctaLabel: string | null
  /** Destino já resolvido pelo servidor; null = a peça não leva a lugar nenhum. */
  actionUrl: string | null
  /** true = sai do app (abre em aba nova). */
  external: boolean
}

export interface ClientBanners {
  popup: ClientBanner | null
  strip: ClientBanner | null
  market: ClientBanner[]
}

/**
 * BannersService — o que cada cliente vê, e o registro do que ele fez com a peça.
 *
 * O cliente recebe a URL de destino JÁ RESOLVIDA e nunca o `actionType`: ele não monta rota, não
 * conhece a allowlist e não tem como ser induzido a navegar para lugar nenhum. Cadastro
 * inconsistente vira `actionUrl: null` (peça sem ação), jamais um destino adivinhado.
 *
 * Toda a regra de quem-vê-o-quê mora em lib/banner-visibility.ts; aqui só se busca e se mapeia.
 */
export class BannersService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  async forClient(userId: string, now: Date = new Date()): Promise<ClientBanners> {
    // Buscar só as peças ligadas e filtrar o resto em código: a coleção é pequena (dezenas), e a
    // janela/público/frequência dependem de `now` e do cliente — traduzir isso para query renderia
    // um `where` difícil de ler e impossível de testar sem banco.
    //
    // O condomínio vem do banco porque o JWT não o carrega (ver plugins/authenticate.ts) — e não
    // deve carregar: cliente que muda de condomínio passaria a receber a segmentação errada até
    // o token expirar.
    const [banners, views, user] = await Promise.all([
      this.prisma.banner.findMany({ where: { isActive: true } }),
      this.prisma.bannerView.findMany({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { condominiumId: true } }),
    ])
    const condominiumId = user?.condominiumId ?? null

    const viewsByBanner = new Map<string, BannerViewFields>(
      views.map((v) => [v.bannerId, { lastSeenAt: v.lastSeenAt, clickedAt: v.clickedAt }]),
    )
    const opts = { condominiumId, viewsByBanner, idOf: (b: { id: string }) => b.id }

    const pick = (placement: 'POPUP' | 'STRIP' | 'MARKET') =>
      selectForClient(banners, { ...opts, placement }, now).map(toClientBanner)

    return {
      popup: pick('POPUP')[0] ?? null,
      strip: pick('STRIP')[0] ?? null,
      market: pick('MARKET'),
    }
  }

  /**
   * Registra exibição, clique ou dispensa. Best-effort por definição: telemetria nunca pode
   * derrubar a tela do cliente nem atrasar um toque, então id inválido e falha de banco são
   * engolidos (com log) e a rota responde 202 de qualquer jeito.
   *
   * `click` e `dismiss` NÃO incrementam `seenCount` num registro que já existe — a impressão já
   * foi contada quando a peça apareceu, e contar de novo inflaria o denominador do CTR.
   */
  async track(userId: string, bannerId: string, event: BannerEvent, now: Date = new Date()): Promise<void> {
    if (!OBJECT_ID_RE.test(bannerId) || !OBJECT_ID_RE.test(userId)) return

    const create = {
      bannerId,
      userId,
      seenCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      clickedAt: event === 'click' ? now : null,
      dismissedAt: event === 'dismiss' ? now : null,
    }

    const update =
      event === 'seen'
        ? { seenCount: { increment: 1 }, lastSeenAt: now }
        : event === 'click'
          ? { clickedAt: now, lastSeenAt: now }
          : { dismissedAt: now, lastSeenAt: now }

    try {
      await this.prisma.bannerView.upsert({
        where: { bannerId_userId: { bannerId, userId } },
        create,
        update,
      })
    } catch (err) {
      this.fastify.log.warn({ err, bannerId, event }, 'falha ao registrar evento de banner')
    }
  }
}

function toClientBanner(b: Banner): ClientBanner {
  const action = resolveActionUrl(b)
  return {
    id: b.id,
    imageUrl: b.imageUrl,
    alt: b.alt,
    title: b.title,
    body: b.body,
    bgColor: b.bgColor,
    ctaLabel: b.ctaLabel,
    actionUrl: action?.url ?? null,
    external: action?.external ?? false,
  }
}
