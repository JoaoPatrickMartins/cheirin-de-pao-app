// Login com Google — regras do plano (.projeto/docs/plano-login-social.md, §5 e §7.4).
// Banco em memória + provedor falso: o que se testa aqui é a decisão, não o Google.
import { vi } from 'vitest'
import bcrypt from 'bcryptjs'
import type { FastifyInstance } from 'fastify'

vi.mock('../lib/referral.js', () => ({
  attachReferralAtSignup: vi.fn().mockResolvedValue(null),
  markReferralVerified: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../modules/auth/otp.service.js', () => ({
  sendEmailOtp: vi.fn().mockResolvedValue(undefined),
}))

import { SocialAuthService, maskEmail, MAX_LINK_ATTEMPTS } from '../modules/social-auth/social-auth.service.js'
import type { ProviderIdentity, SocialProviderAdapter } from '../modules/social-auth/providers/types.js'
import { attachReferralAtSignup, markReferralVerified } from '../lib/referral.js'
import { sendEmailOtp } from '../modules/auth/otp.service.js'

type Row = Record<string, any>

// ── banco em memória (só o que o módulo usa) ────────────────────────────────
function createStore() {
  const flows = new Map<string, Row>()
  const accounts: Row[] = []
  const users = new Map<string, Row>()
  const sessions: Row[] = []
  let seq = 0
  const id = (p: string) => `${p}${++seq}`.padEnd(24, '0').slice(0, 24)

  const matchFlow = (where: Row) =>
    where.id ? flows.get(where.id) : [...flows.values()].find((f) => f.stateHash === where.stateHash)

  const findAccount = (where: Row) => {
    if (where.provider_providerUserId) {
      const k = where.provider_providerUserId
      return accounts.find((a) => a.provider === k.provider && a.providerUserId === k.providerUserId) ?? null
    }
    if (where.userId_provider) {
      const k = where.userId_provider
      return accounts.find((a) => a.userId === k.userId && a.provider === k.provider) ?? null
    }
    return null
  }

  const createAccount = ({ data }: { data: Row }) => {
    const clash = accounts.some(
      (a) =>
        (a.provider === data.provider && a.providerUserId === data.providerUserId) ||
        (a.userId === data.userId && a.provider === data.provider),
    )
    if (clash) return Promise.reject(Object.assign(new Error('unique'), { code: 'P2002' }))
    const row = { id: id('acct'), linkedAt: new Date(), lastLoginAt: null, ...data }
    accounts.push(row)
    return Promise.resolve(row)
  }

  const prisma: Row = {
    socialLoginFlow: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { id: id('flow'), createdAt: new Date(), ...data }
        flows.set(row.id, row)
        return row
      }),
      findUnique: vi.fn(async ({ where }: { where: Row }) => matchFlow(where) ?? null),
      update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = flows.get(where.id)!
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && 'increment' in (v as Row)) row[k] = (row[k] ?? 0) + (v as Row).increment
          else row[k] = v
        }
        return row
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = flows.get(where.id)
        if (!row || (where.status && row.status !== where.status)) return { count: 0 }
        Object.assign(row, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)))
        return { count: 1 }
      }),
    },
    socialAccount: {
      findUnique: vi.fn(async ({ where }: { where: Row }) => findAccount(where)),
      create: vi.fn(createAccount),
      deleteMany: vi.fn(async ({ where }: { where: Row }) => {
        const before = accounts.length
        for (let i = accounts.length - 1; i >= 0; i--) {
          const a = accounts[i]
          if ((where.id && a.id === where.id) || (where.userId && a.userId === where.userId && a.provider === where.provider)) {
            accounts.splice(i, 1)
          }
        }
        return { count: before - accounts.length }
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findMany: vi.fn(async ({ where }: { where: Row }) => accounts.filter((a) => a.userId === where.userId)),
      count: vi.fn(async ({ where }: { where: Row }) => accounts.filter((a) => a.userId === where.userId).length),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: Row }) => {
        if (where.id) return users.get(where.id) ?? null
        const [key, value] = Object.entries(where)[0]
        return [...users.values()].find((u) => u[key] === value) ?? null
      }),
      findFirst: vi.fn(async ({ where }: { where: Row }) => {
        const wanted = String(where.email.equals).toLowerCase()
        return [...users.values()].find((u) => u.email?.toLowerCase() === wanted) ?? null
      }),
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { id: id('user'), passwordHash: null, isBlocked: false, ...data }
        users.set(row.id, row)
        return row
      }),
    },
    session: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { id: id('sess'), ...data }
        sessions.push(row)
        return row
      }),
      update: vi.fn(async () => ({})),
    },
  }
  prisma.$transaction = vi.fn(async (fn: (tx: Row) => Promise<unknown>) => fn(prisma))

  const fastify = {
    prisma,
    jwt: { sign: vi.fn().mockReturnValue('signed.jwt.token'), verify: vi.fn() },
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  } as unknown as FastifyInstance

  const addUser = (u: Row) => {
    const row = { id: id('user'), role: 'CLIENT', name: 'Marina Ribeiro', passwordHash: null, isBlocked: false, ...u }
    users.set(row.id, row)
    return row
  }

  return { fastify, prisma, flows, accounts, users, sessions, addUser }
}

// ── Google falso ─────────────────────────────────────────────────────────────
const MARINA: ProviderIdentity = {
  providerUserId: 'google-sub-1',
  email: 'marina.ribeiro@gmail.com',
  emailVerified: true,
  name: 'Marina Ribeiro',
}

function fakeGoogle(identity: ProviderIdentity | Error = MARINA) {
  const adapter: SocialProviderAdapter = {
    buildAuthUrl: vi.fn(({ state, codeChallenge }) => `https://accounts.google.test/auth?state=${state}&cc=${codeChallenge}`),
    exchange: vi.fn(async () => {
      if (identity instanceof Error) throw identity
      return identity
    }),
  }
  return adapter
}

function setup(identity?: ProviderIdentity | Error, opts: { configured?: boolean } = {}) {
  const store = createStore()
  const google = fakeGoogle(identity)
  const service = new SocialAuthService(store.fastify, () => (opts.configured === false ? null : google))
  return { ...store, google, service }
}

const DEVICE = 'device-1'

// Faz o caminho inteiro até o Google devolver: start → callback. Devolve o que o app guardaria.
async function roundTrip(ctx: ReturnType<typeof setup>, intent: 'login' | 'link' = 'login', linkUserId?: string) {
  const started = await ctx.service.start('google', intent, DEVICE, linkUserId)
  if ('error' in started) throw new Error('start falhou')
  const state = new URL(started.authUrl).searchParams.get('state')!
  const redirect = await ctx.service.handleCallback('google', { code: 'auth-code', state })
  return { ...started, redirect }
}

beforeEach(() => {
  vi.mocked(attachReferralAtSignup).mockClear()
  vi.mocked(markReferralVerified).mockClear()
  vi.mocked(sendEmailOtp).mockClear()
  process.env.APP_PUBLIC_URL = 'http://app.test'
})

describe('maskEmail', () => {
  it('mostra 2 letras + domínio', () => {
    expect(maskEmail('marina.ribeiro@gmail.com')).toBe('ma•••@gmail.com')
  })
  it('e-mail curto mostra 1 letra', () => {
    expect(maskEmail('ab@x.com')).toBe('a•••@x.com')
  })
})

describe('SocialAuthService — start', () => {
  it('guarda só hashes do state e do segredo, PKCE no servidor, tentativas zeradas', async () => {
    const ctx = setup()
    const started = await ctx.service.start('google', 'login', DEVICE)
    if ('error' in started) throw new Error()

    const flow = ctx.flows.get(started.flowId)!
    const state = new URL(started.authUrl).searchParams.get('state')!
    expect(flow.stateHash).not.toBe(state)
    expect(flow.secretHash).not.toBe(started.secret)
    expect(flow.codeVerifier).toHaveLength(43)
    expect(flow).toMatchObject({ status: 'PENDING', intent: 'login', deviceId: DEVICE, attempts: 0 })
    expect(flow.expiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * 60 * 1000)
  })

  it('Google não configurado → 404 e o botão some (providers false)', async () => {
    const ctx = setup(undefined, { configured: false })
    expect(await ctx.service.start('google', 'login', DEVICE)).toEqual(expect.objectContaining({ status: 404 }))
    expect(ctx.service.providers()).toEqual({ google: false })
  })
})

describe('SocialAuthService — callback (decisão, §5.1)', () => {
  it('state desconhecido → volta para o app com social_error=expired', async () => {
    const ctx = setup()
    expect(await ctx.service.handleCallback('google', { code: 'x', state: 'nao-existe' })).toBe(
      'http://app.test/?social_error=expired',
    )
  })

  it('cancelou no Google → ERROR cancelled, e o state não serve de novo', async () => {
    const ctx = setup()
    const started = await ctx.service.start('google', 'login', DEVICE)
    if ('error' in started) throw new Error()
    const state = new URL(started.authUrl).searchParams.get('state')!

    expect(await ctx.service.handleCallback('google', { error: 'access_denied', state })).toBe(
      `http://app.test/?social=${started.flowId}`,
    )
    expect(await ctx.service.claim(started.flowId, started.secret, DEVICE)).toEqual({ status: 'ERROR', code: 'cancelled' })
    expect(await ctx.service.handleCallback('google', { code: 'x', state })).toBe('http://app.test/?social_error=expired')
  })

  it('falha ao trocar o código → provider_error', async () => {
    const ctx = setup(new Error('invalid_grant'))
    const { flowId, secret } = await roundTrip(ctx)
    expect(await ctx.service.claim(flowId, secret, DEVICE)).toEqual({ status: 'ERROR', code: 'provider_error' })
  })

  it('e-mail sem cadastro → NEEDS_SIGNUP com nome e e-mail do Google', async () => {
    const ctx = setup()
    const { flowId, secret } = await roundTrip(ctx)
    expect(await ctx.service.claim(flowId, secret, DEVICE)).toEqual({
      status: 'NEEDS_SIGNUP',
      prefill: { name: 'Marina Ribeiro', email: 'marina.ribeiro@gmail.com', provider: 'google' },
    })
  })

  it('e-mail não verificado pelo Google → email_unverified', async () => {
    const ctx = setup({ ...MARINA, emailVerified: false })
    const { flowId, secret } = await roundTrip(ctx)
    expect(await ctx.service.claim(flowId, secret, DEVICE)).toEqual({ status: 'ERROR', code: 'email_unverified' })
  })

  it('e-mail de cliente existente (sem diferenciar maiúsculas) → NEEDS_LINK (D-2)', async () => {
    const ctx = setup()
    ctx.addUser({ email: 'Marina.Ribeiro@Gmail.com', passwordHash: 'hash' })
    const { flowId, secret } = await roundTrip(ctx)
    expect(await ctx.service.claim(flowId, secret, DEVICE)).toEqual({
      status: 'NEEDS_LINK',
      maskedEmail: 'Ma•••@Gmail.com',
      canUsePassword: true,
    })
    expect(ctx.accounts).toHaveLength(0) // nada conectado antes da confirmação
  })

  it('e-mail de entregador/admin → not_client', async () => {
    const ctx = setup()
    ctx.addUser({ email: MARINA.email, role: 'COURIER' })
    const { flowId, secret } = await roundTrip(ctx)
    expect(await ctx.service.claim(flowId, secret, DEVICE)).toEqual({ status: 'ERROR', code: 'not_client' })
  })

  it('vínculo órfão (usuário não existe mais) é descartado e segue para o cadastro', async () => {
    const ctx = setup()
    ctx.accounts.push({ id: 'acct-orfa', userId: 'sumiu', provider: 'GOOGLE', providerUserId: MARINA.providerUserId })
    const { flowId, secret } = await roundTrip(ctx)
    expect((await ctx.service.claim(flowId, secret, DEVICE)).status).toBe('NEEDS_SIGNUP')
    expect(ctx.accounts).toHaveLength(0)
  })
})

describe('SocialAuthService — claim', () => {
  function withLinkedClient(ctx: ReturnType<typeof setup>, user: Record<string, unknown> = {}) {
    const client = ctx.addUser({ email: 'outro@exemplo.com', ...user })
    ctx.accounts.push({ id: 'acct1', userId: client.id, provider: 'GOOGLE', providerUserId: MARINA.providerUserId })
    return client
  }

  it('já conectado → LOGGED_IN (sem senha e sem ser forçado a criar uma)', async () => {
    const ctx = setup()
    const client = withLinkedClient(ctx)
    const { flowId, secret } = await roundTrip(ctx)

    const result = await ctx.service.claim(flowId, secret, DEVICE)

    expect(result).toMatchObject({
      status: 'LOGGED_IN',
      accessToken: 'signed.jwt.token',
      hasPassword: false,
      mustSetPassword: false,
      user: { id: client.id, role: 'CLIENT' },
    })
    expect(markReferralVerified).toHaveBeenCalledWith(ctx.fastify, client.id)
  })

  it('tokens saem UMA vez: o segundo claim (polling + volta do app) recebe expirou', async () => {
    const ctx = setup()
    withLinkedClient(ctx)
    const { flowId, secret } = await roundTrip(ctx)

    expect((await ctx.service.claim(flowId, secret, DEVICE)).status).toBe('LOGGED_IN')
    expect(await ctx.service.claim(flowId, secret, DEVICE)).toEqual({ status: 'ERROR', code: 'expired' })
    expect(ctx.sessions).toHaveLength(1)
  })

  it('conta bloqueada → blocked, sem sessão', async () => {
    const ctx = setup()
    withLinkedClient(ctx, { isBlocked: true })
    const { flowId, secret } = await roundTrip(ctx)
    expect(await ctx.service.claim(flowId, secret, DEVICE)).toEqual({ status: 'ERROR', code: 'blocked' })
    expect(ctx.sessions).toHaveLength(0)
  })

  it('segredo errado ou outro aparelho → expirou (não revela nada)', async () => {
    const ctx = setup()
    withLinkedClient(ctx)
    const { flowId, secret } = await roundTrip(ctx)
    expect(await ctx.service.claim(flowId, 'x'.repeat(43), DEVICE)).toEqual({ status: 'ERROR', code: 'expired' })
    expect(await ctx.service.claim(flowId, secret, 'outro-aparelho')).toEqual({ status: 'ERROR', code: 'expired' })
    expect(ctx.sessions).toHaveLength(0)
  })

  it('antes de o Google devolver → PENDING', async () => {
    const ctx = setup()
    const started = await ctx.service.start('google', 'login', DEVICE)
    if ('error' in started) throw new Error()
    expect(await ctx.service.claim(started.flowId, started.secret, DEVICE)).toEqual({ status: 'PENDING' })
  })
})

describe('SocialAuthService — vínculo com conta existente (D-2)', () => {
  async function linkRequired(passwordHash: string | null = null) {
    const ctx = setup()
    const client = ctx.addUser({ email: MARINA.email, passwordHash })
    const flow = await roundTrip(ctx)
    return { ctx, client, ...flow }
  }

  it('código vai para o e-mail DA CONTA e, certo, conecta e entra', async () => {
    const { ctx, client, flowId, secret } = await linkRequired()

    expect(await ctx.service.sendLinkCode(flowId, secret)).toEqual({ ok: true, maskedEmail: 'ma•••@gmail.com' })
    const [to, code] = vi.mocked(sendEmailOtp).mock.calls[0]
    expect(to).toBe(MARINA.email)

    const result = await ctx.service.verifyLinkCode(flowId, secret, DEVICE, code)

    expect(result).toMatchObject({ status: 'LOGGED_IN', user: { id: client.id } })
    expect(ctx.accounts).toEqual([expect.objectContaining({ userId: client.id, providerUserId: MARINA.providerUserId })])
  })

  it('código errado conta tentativa; na 5ª o fluxo acaba (too_many)', async () => {
    const { ctx, flowId, secret } = await linkRequired()
    await ctx.service.sendLinkCode(flowId, secret)

    expect(await ctx.service.verifyLinkCode(flowId, secret, DEVICE, '0000')).toEqual({ fieldError: 'code_wrong', attemptsLeft: 4 })
    for (let i = 2; i < MAX_LINK_ATTEMPTS; i++) await ctx.service.verifyLinkCode(flowId, secret, DEVICE, '0000')
    expect(await ctx.service.verifyLinkCode(flowId, secret, DEVICE, '0000')).toEqual({ fieldError: 'too_many', attemptsLeft: 0 })
    expect(await ctx.service.claim(flowId, secret, DEVICE)).toEqual({ status: 'ERROR', code: 'expired' })
    expect(ctx.accounts).toHaveLength(0)
  })

  it('código vencido → code_expired (sem gastar tentativa)', async () => {
    const { ctx, flowId, secret } = await linkRequired()
    await ctx.service.sendLinkCode(flowId, secret)
    ctx.flows.get(flowId)!.codeExpiresAt = new Date(Date.now() - 1000)
    const [, code] = vi.mocked(sendEmailOtp).mock.calls[0]
    expect(await ctx.service.verifyLinkCode(flowId, secret, DEVICE, code)).toEqual({ fieldError: 'code_expired', attemptsLeft: 5 })
  })

  it('senha certa conecta e entra; errada devolve tentativas restantes', async () => {
    const hash = bcrypt.hashSync('Senha123', 4)
    const { ctx, client, flowId, secret } = await linkRequired(hash)

    expect(await ctx.service.linkWithPassword(flowId, secret, DEVICE, 'errada')).toEqual({ fieldError: 'password_wrong', attemptsLeft: 4 })
    const result = await ctx.service.linkWithPassword(flowId, secret, DEVICE, 'Senha123')
    expect(result).toMatchObject({ status: 'LOGGED_IN', hasPassword: true, user: { id: client.id } })
  })

  it('conta sem senha: a via da senha nunca passa (só código)', async () => {
    const { ctx, flowId, secret } = await linkRequired(null)
    expect(await ctx.service.linkWithPassword(flowId, secret, DEVICE, 'qualquer')).toEqual({ fieldError: 'password_wrong', attemptsLeft: 4 })
  })

  it('conta que já tem OUTRO Google → provider_taken', async () => {
    const { ctx, client, flowId, secret } = await linkRequired()
    ctx.accounts.push({ id: 'acct-velha', userId: client.id, provider: 'GOOGLE', providerUserId: 'outro-sub' })
    await ctx.service.sendLinkCode(flowId, secret)
    const [, code] = vi.mocked(sendEmailOtp).mock.calls[0]
    expect(await ctx.service.verifyLinkCode(flowId, secret, DEVICE, code)).toEqual({ status: 'ERROR', code: 'provider_taken' })
  })
})

describe('SocialAuthService — cadastro pelo Google (complete)', () => {
  const PROFILE = {
    name: 'Marina Ribeiro',
    cpf: '52998224725',
    birthDate: '1990-05-10T00:00:00.000Z',
    phone: '11990001234',
    condominiumId: '66f1a2b3c4d5e6f708192a3b',
    apartment: '42',
  }

  it('cria o cliente sem senha, já com o Google, e entra sem ser forçado a criar senha', async () => {
    const ctx = setup()
    const { flowId, secret } = await roundTrip(ctx)

    const result = await ctx.service.complete({ ...PROFILE, flowId, secret, deviceId: DEVICE })

    expect(result).toMatchObject({ status: 'LOGGED_IN', hasPassword: false, mustSetPassword: false })
    const [user] = [...ctx.users.values()]
    expect(user).toMatchObject({ email: MARINA.email, role: 'CLIENT', creditMilli: 0, cpf: PROFILE.cpf })
    expect(user.passwordHash).toBeNull()
    expect(ctx.accounts).toEqual([expect.objectContaining({ userId: user.id, providerUserId: MARINA.providerUserId })])
    expect(markReferralVerified).toHaveBeenCalledWith(ctx.fastify, user.id)
    // fluxo consumido: não dá para cadastrar de novo com o mesmo flowId
    expect(await ctx.service.complete({ ...PROFILE, flowId, secret, deviceId: DEVICE })).toEqual({ status: 'ERROR', code: 'expired' })
  })

  it('indicação vai junto, e falha nela não derruba o cadastro', async () => {
    const ctx = setup()
    vi.mocked(attachReferralAtSignup).mockRejectedValueOnce(new Error('boom'))
    const { flowId, secret } = await roundTrip(ctx)

    const result = await ctx.service.complete({ ...PROFILE, flowId, secret, deviceId: DEVICE, referralCode: 'JOAO7K2F', referralSource: 'LINK' })

    expect(result).toMatchObject({ status: 'LOGGED_IN' })
    expect(attachReferralAtSignup).toHaveBeenCalledWith(ctx.fastify, expect.objectContaining({ id: expect.any(String) }), 'JOAO7K2F', 'LINK')
  })

  it('CPF que já tem conta → 409 com a mensagem do cadastro, e o fluxo continua vivo', async () => {
    const ctx = setup()
    ctx.addUser({ email: 'outra@exemplo.com', cpf: PROFILE.cpf })
    const { flowId, secret } = await roundTrip(ctx)

    expect(await ctx.service.complete({ ...PROFILE, flowId, secret, deviceId: DEVICE })).toEqual({ error: 'CPF já cadastrado', status: 409 })
    expect(ctx.flows.get(flowId)!.status).toBe('RESOLVED')
  })

  it('fluxo que não é de cadastro (ex.: vínculo) → expirou', async () => {
    const ctx = setup()
    ctx.addUser({ email: MARINA.email })
    const { flowId, secret } = await roundTrip(ctx)
    expect(await ctx.service.complete({ ...PROFILE, flowId, secret, deviceId: DEVICE })).toEqual({ status: 'ERROR', code: 'expired' })
  })
})

describe('SocialAuthService — conectar pelo Perfil (§5.2)', () => {
  it('conecta à conta logada sem pedir confirmação → LINKED', async () => {
    const ctx = setup()
    const client = ctx.addUser({ email: 'email-diferente@exemplo.com' })
    const { flowId, secret } = await roundTrip(ctx, 'link', client.id)

    expect(await ctx.service.claim(flowId, secret, DEVICE)).toEqual({ status: 'LINKED', provider: 'google' })
    expect(ctx.accounts).toEqual([expect.objectContaining({ userId: client.id, email: MARINA.email })])
  })

  it('Google já ligado a outro cadastro → already_linked', async () => {
    const ctx = setup()
    const client = ctx.addUser({ email: 'a@exemplo.com' })
    ctx.accounts.push({ id: 'acct-outro', userId: 'outro-cliente', provider: 'GOOGLE', providerUserId: MARINA.providerUserId })
    const { flowId, secret } = await roundTrip(ctx, 'link', client.id)
    expect(await ctx.service.claim(flowId, secret, DEVICE)).toEqual({ status: 'ERROR', code: 'already_linked' })
  })

  it('cliente que já tem outro Google → provider_taken', async () => {
    const ctx = setup()
    const client = ctx.addUser({ email: 'a@exemplo.com' })
    ctx.accounts.push({ id: 'acct-meu', userId: client.id, provider: 'GOOGLE', providerUserId: 'outro-sub' })
    const { flowId, secret } = await roundTrip(ctx, 'link', client.id)
    expect(await ctx.service.claim(flowId, secret, DEVICE)).toEqual({ status: 'ERROR', code: 'provider_taken' })
  })

  it('desconectar remove o vínculo e a lista volta vazia', async () => {
    const ctx = setup()
    const client = ctx.addUser({ email: 'a@exemplo.com' })
    ctx.accounts.push({ id: 'acct-meu', userId: client.id, provider: 'GOOGLE', providerUserId: 'sub', email: 'a@gmail.com', linkedAt: new Date() })

    expect(await ctx.service.listAccounts(client.id)).toEqual([expect.objectContaining({ provider: 'google', email: 'a@gmail.com' })])
    await ctx.service.disconnect(client.id, 'google')
    expect(await ctx.service.listAccounts(client.id)).toEqual([])
  })
})
