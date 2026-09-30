import {
  SocialProviderSchema,
  SocialStartSchema,
  SocialClaimSchema,
  SocialLinkCodeVerifySchema,
} from '../schemas/social-auth'

const FLOW_ID = '66f1a2b3c4d5e6f708192a3b'
const SECRET = 'a'.repeat(43) // randomBytes(32) em base64url

describe('SocialProviderSchema', () => {
  it('aceita google', () => {
    expect(SocialProviderSchema.parse('google')).toBe('google')
  })

  it('recusa provedor que ainda não existe (facebook é fase futura)', () => {
    expect(SocialProviderSchema.safeParse('facebook').success).toBe(false)
  })
})

describe('SocialStartSchema', () => {
  it('assume intent=login quando não vem', () => {
    expect(SocialStartSchema.parse({ deviceId: 'dev-1' })).toEqual({ intent: 'login', deviceId: 'dev-1' })
  })

  it('recusa deviceId vazio', () => {
    expect(SocialStartSchema.safeParse({ intent: 'login', deviceId: '' }).success).toBe(false)
  })
})

describe('SocialClaimSchema', () => {
  it('aceita flowId + secret + deviceId', () => {
    expect(SocialClaimSchema.safeParse({ flowId: FLOW_ID, secret: SECRET, deviceId: 'dev-1' }).success).toBe(true)
  })

  it('recusa flowId que não é ObjectId', () => {
    expect(SocialClaimSchema.safeParse({ flowId: 'x', secret: SECRET, deviceId: 'dev-1' }).success).toBe(false)
  })

  it('recusa segredo curto demais', () => {
    expect(SocialClaimSchema.safeParse({ flowId: FLOW_ID, secret: 'curto', deviceId: 'dev-1' }).success).toBe(false)
  })
})

describe('SocialLinkCodeVerifySchema', () => {
  it('exige código de 4 dígitos', () => {
    const base = { flowId: FLOW_ID, secret: SECRET, deviceId: 'dev-1' }
    expect(SocialLinkCodeVerifySchema.safeParse({ ...base, code: '1234' }).success).toBe(true)
    expect(SocialLinkCodeVerifySchema.safeParse({ ...base, code: '123' }).success).toBe(false)
  })
})
