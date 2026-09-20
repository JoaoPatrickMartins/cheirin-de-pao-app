/**
 * BannerPopupHost — liga o pop-up ao contexto: decide a hora, conta a impressão e navega.
 *
 * Existe separado do BannerPopup (que é só desenho) porque o `enabled` vem de fora: o pop-up é o
 * ÚLTIMO da fila de sobreposições do ClientLayout, atrás do onboarding, do tour e do consentimento
 * do gancho. Cliente novo vê o tutorial inteiro sem propaganda no meio.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { BannerPopup } from './BannerPopup'
import { useBannerClick, useBanners } from '../../contexts/BannerContext'
import { trackBanner } from '../../lib/banners'

export function BannerPopupHost({ enabled }: { enabled: boolean }) {
  const { banners, dismiss, hide } = useBanners()
  const navigate = useNavigate()
  const handleClick = useBannerClick(navigate)
  const popup = banners.popup

  // A impressão é contada quando a peça REALMENTE aparece — não quando chega do servidor. Sem
  // isso, o pop-up que nunca chegou a ser exibido (porque o tour estava aberto) gastaria a
  // frequência do dia e sumiria sem ninguém ter visto.
  useEffect(() => {
    if (enabled && popup) trackBanner(popup.id, 'seen')
  }, [enabled, popup])

  if (!enabled || !popup) return null

  return (
    <BannerPopup
      banner={popup}
      onClick={(b) => {
        handleClick(b)
        hide('popup') // clicou não é dispensou
      }}
      onClose={() => dismiss('popup', popup.id)}
    />
  )
}
