/**
 * AvisoStripHost — liga a faixa de aviso ao contexto: conta a impressão, navega e dispensa.
 *
 * Mesma divisão do pop-up: o AvisoStrip só desenha, o host conhece contexto e rota. É isso que
 * deixa o admin renderizar a faixa no preview sem arrastar junto o roteador.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { AvisoStrip } from './AvisoStrip'
import { useBannerClick, useBanners } from '../../contexts/BannerContext'
import { trackBanner } from '../../lib/banners'

export function AvisoStripHost() {
  const { banners, dismiss, hide } = useBanners()
  const navigate = useNavigate()
  const handleClick = useBannerClick(navigate)
  const strip = banners.strip

  useEffect(() => {
    if (strip) trackBanner(strip.id, 'seen')
  }, [strip])

  if (!strip) return null

  return (
    <AvisoStrip
      banner={strip}
      onClick={(b) => {
        handleClick(b)
        hide('strip') // clicou não é dispensou
      }}
      onDismiss={() => dismiss('strip', strip.id)}
    />
  )
}
