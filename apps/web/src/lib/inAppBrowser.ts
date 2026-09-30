/**
 * Navegador embutido de app (Instagram, Facebook, etc.). O Google bloqueia login dentro deles
 * (`disallowed_useragent`), então no lugar do botão do Google mostramos o aviso "abra no navegador".
 * Heurística pelo user agent — não é perfeita, mas cobre os casos que mandam gente para o app:
 * link de indicação aberto no Instagram/Facebook.
 */
const IN_APP_UA = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Twitter|TikTok|musical_ly|Snapchat|LinkedInApp/i

export function isInAppBrowser(userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return IN_APP_UA.test(userAgent)
}
