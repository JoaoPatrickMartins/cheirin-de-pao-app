/**
 * MarketBannerList — as peças do mercadinho, ligadas ao contexto.
 *
 * Uma peça no ar aparece sozinha e parada; duas ou mais viram carrossel. Não há ajuste para
 * escolher: o formato é consequência de quantos banners estão publicados, então nunca existe o
 * caso de um banner "No ar" no admin que o cliente não vê.
 *
 * Não tem dispensa: banner de vitrine é conteúdo de página, e o cliente que fechasse um hoje
 * teria que fechar de novo amanhã.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { MarketBanner } from './MarketBanner'
import { MarketBannerCarousel } from './MarketBannerCarousel'
import { useBannerClick, useBanners } from '../../contexts/BannerContext'
import { trackBanner, type ClientBanner } from '../../lib/banners'

export function MarketBannerList() {
  const { banners } = useBanners()
  const navigate = useNavigate()
  const handleClick = useBannerClick(navigate)
  const lista = banners.market

  if (lista.length === 0) return null

  return (
    <div style={{ padding: '14px 20px 12px' }}>
      {lista.length === 1 ? (
        <PecaUnica banner={lista[0]} onClick={handleClick} />
      ) : (
        <MarketBannerCarousel
          banners={lista}
          onClick={handleClick}
          onSeen={(id) => trackBanner(id, 'seen')}
        />
      )}
    </div>
  )
}

/** Peça sozinha: sem dots, sem rotação — e a impressão conta na montagem. */
function PecaUnica({ banner, onClick }: { banner: ClientBanner; onClick: (b: ClientBanner) => void }) {
  useEffect(() => {
    trackBanner(banner.id, 'seen')
  }, [banner.id])

  return <MarketBanner banner={banner} onClick={onClick} />
}
