/**
 * BannerContext — as peças de comunicação do cliente, buscadas UMA vez por sessão.
 *
 * Uma busca só, no mount do ClientLayout, servida à Home e à vitrine do mercadinho. Rebuscar a
 * cada navegação faria o pop-up reaparecer ao voltar para a Home — e um pop-up que volta sozinho
 * é exatamente a propaganda que ninguém quer.
 *
 * A dispensa (X) é guardada aqui, em memória: some pelo resto da sessão. O que decide se a peça
 * volta AMANHÃ é o servidor (frequência × BannerView), não este estado.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { fetchBanners, trackBanner, NO_BANNERS, type ClientBanner, type ClientBanners } from '../lib/banners'

interface BannerContextValue {
  banners: ClientBanners
  /** O cliente fechou no X: esconde pelo resto da sessão E conta como dispensa. */
  dismiss: (placement: 'popup' | 'strip', id: string) => void
  /**
   * Esconde SEM contar dispensa. É o que se usa depois de um clique: quem clicou não dispensou,
   * e somar os dois eventos faria a taxa de dispensa acusar rejeição onde houve interesse.
   */
  hide: (placement: 'popup' | 'strip') => void
}

export const BannerContext = createContext<BannerContextValue>({
  banners: NO_BANNERS,
  dismiss: () => {},
  hide: () => {},
})

export function BannerProvider({ children }: { children: React.ReactNode }) {
  const [banners, setBanners] = useState<ClientBanners>(NO_BANNERS)

  useEffect(() => {
    let cancelled = false
    void fetchBanners().then((b) => {
      if (!cancelled) setBanners(b)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const hide = useCallback((placement: 'popup' | 'strip') => {
    setBanners((prev) => ({ ...prev, [placement]: null }))
  }, [])

  const dismiss = useCallback(
    (placement: 'popup' | 'strip', id: string) => {
      trackBanner(id, 'dismiss')
      hide(placement)
    },
    [hide],
  )

  return <BannerContext.Provider value={{ banners, dismiss, hide }}>{children}</BannerContext.Provider>
}

export function useBanners(): BannerContextValue {
  return useContext(BannerContext)
}

/**
 * O que fazer quando o cliente toca numa peça: registrar e ir.
 *
 * Link externo abre em aba nova com `noopener,noreferrer` — sem isso a página aberta ganha
 * referência à nossa (`window.opener`) e poderia trocar o app por uma cópia de phishing.
 */
export function useBannerClick(navigate: (to: string) => void) {
  return useCallback(
    (banner: ClientBanner): void => {
      trackBanner(banner.id, 'click')
      if (!banner.actionUrl) return
      if (banner.external) {
        window.open(banner.actionUrl, '_blank', 'noopener,noreferrer')
        return
      }
      navigate(banner.actionUrl)
    },
    [navigate],
  )
}
