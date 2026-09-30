// Adaptador do Google — só a nossa cola sobre a google-auth-library (a lib é simulada).
import { vi } from 'vitest'

const getToken = vi.fn()
const verifyIdToken = vi.fn()
const generateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?x=1')

vi.mock('google-auth-library', () => ({
  CodeChallengeMethod: { S256: 'S256', Plain: 'plain' },
  OAuth2Client: vi.fn().mockImplementation(function () {
    return { getToken, verifyIdToken, generateAuthUrl }
  }),
}))

import { createGoogleProvider } from '../modules/social-auth/providers/google.js'
import { readSocialConfig } from '../modules/social-auth/social-auth.config.js'

const CONFIG = {
  clientId: 'client-id.apps.googleusercontent.com',
  clientSecret: 'segredo',
  redirectUri: 'http://localhost:5173/api/auth/social/google/callback',
}

beforeEach(() => {
  getToken.mockReset()
  verifyIdToken.mockReset()
})

describe('createGoogleProvider', () => {
  it('pede só openid/email/profile, com PKCE S256 e escolha de conta', () => {
    createGoogleProvider(CONFIG).buildAuthUrl({ state: 'st', codeChallenge: 'cc' })
    expect(generateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: ['openid', 'email', 'profile'],
        state: 'st',
        code_challenge: 'cc',
        code_challenge_method: 'S256',
        prompt: 'select_account',
      }),
    )
  })

  it('troca o código com o verifier e valida o id_token contra o NOSSO client id', async () => {
    getToken.mockResolvedValue({ tokens: { id_token: 'id.token' } })
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: '123', email: ' Marina@Gmail.com ', email_verified: true, name: 'Marina Ribeiro' }),
    })

    const identity = await createGoogleProvider(CONFIG).exchange({ code: 'code', codeVerifier: 'verifier' })

    expect(getToken).toHaveBeenCalledWith({ code: 'code', codeVerifier: 'verifier', redirect_uri: CONFIG.redirectUri })
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'id.token', audience: CONFIG.clientId })
    expect(identity).toEqual({ providerUserId: '123', email: 'marina@gmail.com', emailVerified: true, name: 'Marina Ribeiro' })
  })

  it('email_verified ausente conta como NÃO verificado', async () => {
    getToken.mockResolvedValue({ tokens: { id_token: 'id.token' } })
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: '123', email: 'a@b.com' }) })
    expect((await createGoogleProvider(CONFIG).exchange({ code: 'c', codeVerifier: 'v' })).emailVerified).toBe(false)
  })

  it('sem id_token → lança (vira provider_error)', async () => {
    getToken.mockResolvedValue({ tokens: {} })
    await expect(createGoogleProvider(CONFIG).exchange({ code: 'c', codeVerifier: 'v' })).rejects.toThrow()
  })

  it('id_token inválido (aud de outro app) → lança', async () => {
    getToken.mockResolvedValue({ tokens: { id_token: 'id.token' } })
    verifyIdToken.mockRejectedValue(new Error('Wrong recipient, payload audience != requiredAudience'))
    await expect(createGoogleProvider(CONFIG).exchange({ code: 'c', codeVerifier: 'v' })).rejects.toThrow('Wrong recipient')
  })
})

describe('readSocialConfig', () => {
  it('liga o Google só com client id + secret + URL pública da API (sem barra no fim)', () => {
    const on = readSocialConfig({
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'sec',
      API_PUBLIC_URL: 'https://api.cheirindepao.com.br/',
      APP_PUBLIC_URL: 'https://app.cheirindepao.com.br/',
    })
    expect(on.google?.redirectUri).toBe('https://api.cheirindepao.com.br/auth/social/google/callback')
    expect(on.appBaseUrl).toBe('https://app.cheirindepao.com.br')

    expect(readSocialConfig({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'sec' }).google).toBeNull()
    expect(readSocialConfig({ GOOGLE_CLIENT_ID: 'id', API_PUBLIC_URL: 'https://x' }).google).toBeNull()
  })

  it('sem APP_PUBLIC_URL, volta para o CORS_ORIGIN', () => {
    expect(readSocialConfig({ CORS_ORIGIN: 'https://app.cheirindepao.com.br' }).appBaseUrl).toBe('https://app.cheirindepao.com.br')
  })
})
