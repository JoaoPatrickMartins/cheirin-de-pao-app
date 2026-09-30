import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library'
import type { GoogleOAuthConfig } from '../social-auth.config.js'
import type { ProviderIdentity, SocialProviderAdapter } from './types.js'

// Só identidade: nada de escopo sensível (sem auditoria do Google) e nenhum token guardado (T-6).
const SCOPES = ['openid', 'email', 'profile']

export function createGoogleProvider(config: GoogleOAuthConfig): SocialProviderAdapter {
  const client = new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  })

  return {
    buildAuthUrl({ state, codeChallenge }) {
      return client.generateAuthUrl({
        scope: SCOPES,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
        // Deixa a pessoa escolher a conta em aparelho com mais de um Google logado.
        prompt: 'select_account',
        access_type: 'online',
      })
    },

    async exchange({ code, codeVerifier }): Promise<ProviderIdentity> {
      const { tokens } = await client.getToken({ code, codeVerifier, redirect_uri: config.redirectUri })
      if (!tokens.id_token) throw new Error('Google não devolveu id_token')

      // Confere assinatura, `aud` (o nosso client id), `iss` e validade.
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId })
      const payload = ticket.getPayload()
      if (!payload?.sub) throw new Error('id_token sem sub')

      return {
        providerUserId: payload.sub,
        email: payload.email ? payload.email.trim().toLowerCase() : null,
        emailVerified: payload.email_verified === true,
        name: payload.name?.trim() || payload.given_name?.trim() || null,
      }
    },
  }
}
