/**
 * Navegar até o prédio pelo app de mapas do celular (E9 do plano do entregador). A navegação curva
 * a curva é do app de mapas — o nosso só abre o destino. A escolha fica no aparelho (T-11).
 */
export type NavApp = 'google' | 'waze' | 'apple'

export const NAV_APP_LABELS: Record<NavApp, string> = { google: 'Google Maps', waze: 'Waze', apple: 'Apple Maps' }

const KEY = 'cdp.navApp'

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  // iPad com iPadOS se apresenta como Mac com toque.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1)
}

/** Apple Maps só aparece no iPhone. */
export function availableNavApps(): NavApp[] {
  return isIOS() ? ['google', 'waze', 'apple'] : ['google', 'waze']
}

export function getPreferredNavApp(): NavApp | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'google' || v === 'waze' || v === 'apple' ? v : null
  } catch {
    return null
  }
}

export function setPreferredNavApp(app: NavApp | null): void {
  try {
    if (app) localStorage.setItem(KEY, app)
    else localStorage.removeItem(KEY)
  } catch {
    // modo privado do Safari: só não lembra
  }
}

/** Link do destino. Com coordenada, vai direto ao ponto; sem ela, pelo endereço. */
export function navUrl(app: NavApp, dest: { lat: number | null; lng: number | null; address?: string }): string {
  const hasCoords = dest.lat !== null && dest.lng !== null
  const q = encodeURIComponent(dest.address ?? '')
  if (app === 'waze') return hasCoords ? `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes` : `https://waze.com/ul?q=${q}&navigate=yes`
  if (app === 'apple') return hasCoords ? `https://maps.apple.com/?daddr=${dest.lat},${dest.lng}&dirflg=d` : `https://maps.apple.com/?daddr=${q}&dirflg=d`
  return hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`
}
