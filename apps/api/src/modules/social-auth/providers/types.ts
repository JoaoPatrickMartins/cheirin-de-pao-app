/**
 * Contrato de um provedor de login social. O Google é o único hoje; outro provedor (Facebook —
 * plano-login-social-facebook.md) entra implementando esta mesma interface.
 */

// O que o fluxo precisa saber de quem entrou. A identidade é SEMPRE `providerUserId` (o `sub` do
// Google) — nunca o e-mail, que pode mudar dos dois lados.
export type ProviderIdentity = {
  providerUserId: string
  email: string | null
  // Só um e-mail confirmado pelo provedor vale para achar conta existente e cadastrar sem código.
  emailVerified: boolean
  name: string | null
}

export interface SocialProviderAdapter {
  // URL do consentimento. `state` e `codeChallenge` (PKCE S256) vêm do fluxo.
  buildAuthUrl(params: { state: string; codeChallenge: string }): string
  // Troca o `code` pelo token (com o `code_verifier` que só o servidor conhece) e lê a identidade.
  // Lança em qualquer falha — quem chama transforma em `provider_error`.
  exchange(params: { code: string; codeVerifier: string }): Promise<ProviderIdentity>
}
