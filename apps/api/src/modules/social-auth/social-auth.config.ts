/**
 * Login social — configuração lida do ambiente a cada uso (não no import), para os testes e para
 * o `@fastify/env` (que popula o process.env no boot) valerem igual.
 *
 * O Google só liga com o par de credenciais E a URL pública da API (sem ela não há redirect_uri).
 * Isso é o interruptor do lançamento: em produção, o botão aparece quando os secrets entram.
 */

export type GoogleOAuthConfig = {
  clientId: string
  clientSecret: string
  // Precisa bater EXATAMENTE com uma das URIs cadastradas no Google Cloud (sem barra no fim).
  redirectUri: string
}

export type SocialConfig = {
  // Para onde a API devolve o navegador no fim do fluxo (a raiz do app — ver T-4 do plano).
  appBaseUrl: string
  google: GoogleOAuthConfig | null
}

function withoutTrailingSlash(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function readSocialConfig(env: NodeJS.ProcessEnv = process.env): SocialConfig {
  const apiBase = withoutTrailingSlash(env.API_PUBLIC_URL ?? '')
  const appBaseUrl = withoutTrailingSlash(env.APP_PUBLIC_URL || env.CORS_ORIGIN || 'http://localhost:5173')

  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? ''
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? ''
  const google =
    clientId && clientSecret && apiBase
      ? { clientId, clientSecret, redirectUri: `${apiBase}/auth/social/google/callback` }
      : null

  return { appBaseUrl, google }
}
