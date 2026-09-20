/**
 * MarketBannerList — as peças do mercadinho, ligadas ao contexto.
 *
 * Não tem dispensa: banner de vitrine é conteúdo de página, e o cliente que fechasse um hoje
 * teria que fechar de novo amanhã. A impressão de cada um é contada quando a lista aparece.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { MarketBanner } from './MarketBanner'
import { useBannerClick, useBanners } from '../../contexts/BannerContext'
import { trackBanner } from '../../lib/banners'

export function MarketBannerList() {
  const { banners } = useBanners()
  const navigate = useNavigate()
  const handleClick = useBannerClick(navigate)
  const lista = banners.market

  useEffect(() => {
    lista.forEach((b) => trackBanner(b.id, 'seen'))
  }, [lista])

  if (lista.length === 0) return null

  return (
    <div style={{ padding: '14px 20px 0' }}>
      {lista.map((b) => (
        <MarketBanner key={b.id} banner={b} onClick={handleClick} />
      ))}
    </div>
  )
}
