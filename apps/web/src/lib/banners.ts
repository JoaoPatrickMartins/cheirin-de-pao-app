// Tipos e helpers dos banners, avisos e promoções (front cliente).
//
// As peças vêm de GET /client/banners JÁ FILTRADAS por janela, condomínio e frequência — o front
// não decide quem vê o quê. E o destino chega como `actionUrl` pronta: o app navega, mas nunca
// monta rota a partir do cadastro. Toda a regra mora em apps/api/src/lib/banner-visibility.ts.

import { apiFetch } from './apiFetch'

/** Uma peça como o cliente a recebe. */
export interface ClientBanner {
  id: string
  imageUrl: string | null
  alt: string | null
  title: string | null
  body: string | null
  bgColor: string | null
  ctaLabel: string | null
  /** Destino resolvido no servidor; null = a peça só informa. */
  actionUrl: string | null
  /** true = sai do app (abre em aba nova). */
  external: boolean
}

export interface ClientBanners {
  popup: ClientBanner | null
  strip: ClientBanner | null
  market: ClientBanner[]
}

export const NO_BANNERS: ClientBanners = { popup: null, strip: null, market: [] }

export type BannerEvent = 'seen' | 'click' | 'dismiss'

/** Busca as peças do cliente. Qualquer falha vira "nenhum banner" — nunca um erro na Home. */
export async function fetchBanners(): Promise<ClientBanners> {
  try {
    const res = await apiFetch('/client/banners')
    if (!res.ok) return NO_BANNERS
    return (await res.json()) as ClientBanners
  } catch {
    return NO_BANNERS
  }
}

/**
 * Registra exibição, clique ou dispensa. Deliberadamente sem `await` do lado de quem chama:
 * telemetria não pode atrasar um toque nem falhar na cara do usuário.
 */
export function trackBanner(bannerId: string, event: BannerEvent): void {
  void apiFetch(`/client/banners/${bannerId}/${event}`, { method: 'POST' }).catch(() => {})
}
