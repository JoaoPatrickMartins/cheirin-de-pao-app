import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import type { SocialLoginFlow, SocialProvider } from '@prisma/client'
import type { SocialErrorCode, SocialIntent, SocialProviderSlug } from '@cheirin-de-pao/shared'
import { AuthService, type AuthTokens } from '../auth/auth.service.js'
import { sendEmailOtp } from '../auth/otp.service.js'
import { attachReferralAtSignup } from '../../lib/referral.js'
import { withWriteConflictRetry } from '../../lib/tx-retry.js'
import { readSocialConfig, type SocialConfig } from './social-auth.config.js'
import { createGoogleProvider } from './providers/google.js'
import type { ProviderIdentity, SocialProviderAdapter } from './providers/types.js'
import { SocialAuthRepository } from './social-auth.repository.js'
import type { SocialCompleteBody } from './social-auth.schema.js'

/**
 * Login social (Google) — plano: .projeto/docs/plano-login-social.md.
 *
 *   start ──► Google ──► callback (decide o desfecho e grava no fluxo) ──► app/?social=<flowId>
 *   claim (flowId + secret) ──► LOGGED_IN | NEEDS_SIGNUP | NEEDS_LINK | LINKED | ERROR | PENDING
 *
 * O resultado fica no servidor e só quem tem o `secret` (o app que iniciou) o busca. É isso que faz o
 * PWA do iPhone funcionar: o Google abre numa janela do Safari com armazenamento separado, e o app
 * instalado busca o resultado quando volta para a tela.
 */

const FLOW_TTL_MS = 60 * 60 * 1000 // 60 min — dá tempo de preencher o cadastro "Quase lá"
const LINK_CODE_TTL_MS = 10 * 60 * 1000 // 10 min, como o OTP de login
export const MAX_LINK_ATTEMPTS = 5 // senha + código do vínculo, somados

const PROVIDER_ENUM: Record<SocialProviderSlug, SocialProvider> = { google: 'GOOGLE' }
const PROVIDER_SLUG: Record<SocialProvider, SocialProviderSlug> = { GOOGLE: 'google' }

// Estados do fluxo (SocialLoginFlow.status) e desfechos (SocialLoginFlow.outcome).
const PENDING = 'PENDING'
const RESOLVED = 'RESOLVED'
const CONSUMED = 'CONSUMED'
const ERROR = 'ERROR'
type Outcome = 'LOGIN' | 'SIGNUP' | 'LINK_REQUIRED' | 'LINKED'

export type ClaimResult =
  | { status: 'PENDING' }
  | ({ status: 'LOGGED_IN' } & AuthTokens)
  | { status: 'NEEDS_SIGNUP'; prefill: { name: string; email: string; provider: SocialProviderSlug } }
  | { status: 'NEEDS_LINK'; maskedEmail: string; canUsePassword: boolean }
  | { status: 'LINKED'; provider: SocialProviderSlug }
  | { status: 'ERROR'; code: SocialErrorCode }

// Erro de campo nos passos do vínculo (L6): a tela mostra no próprio campo, o fluxo segue vivo.
export type LinkFieldError = {
  fieldError: 'code_wrong' | 'code_expired' | 'no_code' | 'password_wrong' | 'too_many'
  attemptsLeft: number
}

export type HttpError = { error: string; status: number }

type Decision =
  | { status: typeof RESOLVED; outcome: Outcome; matchedUserId?: string }
  | { status: typeof ERROR; errorCode: SocialErrorCode }

type SessionUser = NonNullable<Awaited<ReturnType<SocialAuthRepository['findSessionUser']>>>

export type ProviderFactory = (slug: SocialProviderSlug, config: SocialConfig) => SocialProviderAdapter | null

const defaultProviderFactory: ProviderFactory = (slug, config) =>
  slug === 'google' && config.google ? createGoogleProvider(config.google) : null

function randomToken(): string {
  return randomBytes(32).toString('base64url') // 43 chars — também serve de code_verifier (43–128)
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

function sameHash(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex')
  const b = Buffer.from(bHex, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002'
}

/** "marina.ribeiro@gmail.com" → "ma•••@gmail.com" (o L6 mostra de quem é a conta sem expor o e-mail). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '•••'
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)
  return `${visible}•••@${domain}`
}

const ok = (outcome: Outcome, matchedUserId?: string): Decision => ({ status: RESOLVED, outcome, matchedUserId })
const fail = (errorCode: SocialErrorCode): Decision => ({ status: ERROR, errorCode })
const errorResult = (code: SocialErrorCode): ClaimResult => ({ status: 'ERROR', code })

export class SocialAuthService {
  private repo: SocialAuthRepository
  private auth: AuthService

  constructor(
    private fastify: FastifyInstance,
    private providerFactory: ProviderFactory = defaultProviderFactory,
  ) {
    this.repo = new SocialAuthRepository(fastify)
    this.auth = new AuthService(fastify)
  }

  private config(): SocialConfig {
    return readSocialConfig()
  }

  private provider(slug: SocialProviderSlug): SocialProviderAdapter | null {
    return this.providerFactory(slug, this.config())
  }

  /** Quais provedores estão configurados — o app só mostra o botão dos ligados (T-5). */
  providers(): Record<SocialProviderSlug, boolean> {
    return { google: this.provider('google') != null }
  }

  // ── start ────────────────────────────────────────────────────────────────
  async start(
    slug: SocialProviderSlug,
    intent: SocialIntent,
    deviceId: string,
    linkUserId?: string,
  ): Promise<{ flowId: string; secret: string; authUrl: string } | HttpError> {
    const provider = this.provider(slug)
    if (!provider) return { error: 'Login com o Google indisponível no momento.', status: 404 }

    const state = randomToken()
    const secret = randomToken()
    const codeVerifier = randomToken()

    const flow = await this.repo.createFlow({
      provider: PROVIDER_ENUM[slug],
      intent,
      stateHash: sha256Hex(state),
      codeVerifier,
      secretHash: sha256Hex(secret),
      deviceId,
      linkUserId: linkUserId ?? null,
      status: PENDING,
      attempts: 0,
      expiresAt: new Date(Date.now() + FLOW_TTL_MS),
    })

    return { flowId: flow.id, secret, authUrl: provider.buildAuthUrl({ state, codeChallenge: pkceChallenge(codeVerifier) }) }
  }

  // ── callback ─────────────────────────────────────────────────────────────
  /** Devolve a URL para onde redirecionar o navegador (sempre a raiz do app — T-4). */
  async handleCallback(
    slug: SocialProviderSlug,
    query: { code?: string; state?: string; error?: string },
  ): Promise<string> {
    const appBase = this.config().appBaseUrl
    const lost = `${appBase}/?social_error=expired`
    if (!query.state) return lost

    const flow = await this.repo.findFlowByStateHash(sha256Hex(query.state))
    // `state` é de uso único: depois do 1º callback o fluxo sai de PENDING e este passo recusa.
    if (!flow || flow.status !== PENDING || flow.expiresAt < new Date() || flow.provider !== PROVIDER_ENUM[slug]) {
      return lost
    }
    const back = `${appBase}/?social=${flow.id}`

    const decide = async (decision: Decision, identity?: ProviderIdentity) => {
      await this.repo.transitionFlow(flow.id, PENDING, {
        ...decision,
        ...(identity && {
          providerUserId: identity.providerUserId,
          providerEmail: identity.email,
          emailVerified: identity.emailVerified,
          name: identity.name,
        }),
      })
      return back
    }

    if (query.error) return decide(fail(query.error === 'access_denied' ? 'cancelled' : 'provider_error'))
    const provider = this.provider(slug)
    if (!query.code || !provider) return decide(fail('provider_error'))

    let identity: ProviderIdentity
    try {
      identity = await provider.exchange({ code: query.code, codeVerifier: flow.codeVerifier })
    } catch (err) {
      // Só a mensagem: nunca logar code, state ou token.
      this.fastify.log.warn({ provider: slug, reason: (err as Error)?.message }, '[social-auth] troca do código falhou')
      return decide(fail('provider_error'))
    }

    const decision =
      flow.intent === 'link' && flow.linkUserId
        ? await this.resolveConnect(flow.provider, flow.linkUserId, identity)
        : await this.resolveLogin(flow.provider, identity)
    return decide(decision, identity)
  }

  // Regras do plano, §5.1.
  private async resolveLogin(provider: SocialProvider, identity: ProviderIdentity): Promise<Decision> {
    const account = await this.repo.findAccount(provider, identity.providerUserId)
    if (account) {
      const owner = await this.repo.findSessionUser(account.userId)
      if (owner) return owner.role === 'CLIENT' ? ok('LOGIN', owner.id) : fail('not_client')
      // Vínculo órfão (o usuário não existe mais): some com ele, senão o cadastro novo bateria no índice único.
      await this.repo.deleteAccountById(account.id)
    }

    if (!identity.emailVerified || !identity.email) return fail('email_unverified')

    const existing = await this.repo.findUserByEmailInsensitive(identity.email)
    if (existing) return existing.role === 'CLIENT' ? ok('LINK_REQUIRED', existing.id) : fail('not_client')
    return ok('SIGNUP')
  }

  // Conectar pelo Perfil (§5.2): a pessoa já está logada, então não pede confirmação.
  private async resolveConnect(provider: SocialProvider, userId: string, identity: ProviderIdentity): Promise<Decision> {
    const account = await this.repo.findAccount(provider, identity.providerUserId)
    if (account) return account.userId === userId ? ok('LINKED') : fail('already_linked')

    if (await this.repo.findAccountOfUser(userId, provider)) return fail('provider_taken')

    try {
      await this.repo.createAccount({ userId, provider, providerUserId: identity.providerUserId, email: identity.email })
    } catch (err) {
      if (isUniqueViolation(err)) return fail('already_linked')
      throw err
    }
    return ok('LINKED')
  }

  // ── claim ────────────────────────────────────────────────────────────────
  // Carrega o fluxo e prova que quem chama é o app que o iniciou. Qualquer falha vira "expirou":
  // não conta a um curioso se o flowId existe.
  private async loadFlow(flowId: string, secret: string, deviceId?: string): Promise<SocialLoginFlow | null> {
    const flow = await this.repo.findFlowById(flowId)
    if (!flow) return null
    if (!sameHash(sha256Hex(secret), flow.secretHash)) return null
    if (flow.expiresAt < new Date()) return null
    if (deviceId !== undefined && flow.deviceId !== deviceId) return null
    return flow
  }

  async claim(flowId: string, secret: string, deviceId: string): Promise<ClaimResult> {
    const flow = await this.loadFlow(flowId, secret, deviceId)
    if (!flow) return errorResult('expired')

    if (flow.status === PENDING) return { status: 'PENDING' }
    if (flow.status === ERROR) return errorResult((flow.errorCode as SocialErrorCode) ?? 'provider_error')
    if (flow.status !== RESOLVED) return errorResult('expired') // CONSUMED: os tokens já foram entregues

    const slug = PROVIDER_SLUG[flow.provider]
    switch (flow.outcome as Outcome) {
      case 'LOGIN': {
        const user = flow.matchedUserId ? await this.repo.findSessionUser(flow.matchedUserId) : null
        return this.finishLogin(flow, user)
      }
      case 'SIGNUP':
        return {
          status: 'NEEDS_SIGNUP',
          prefill: { name: flow.name ?? '', email: flow.providerEmail ?? '', provider: slug },
        }
      case 'LINK_REQUIRED': {
        const user = flow.matchedUserId ? await this.repo.findSessionUser(flow.matchedUserId) : null
        if (!user?.email) return errorResult('expired')
        return { status: 'NEEDS_LINK', maskedEmail: maskEmail(user.email), canUsePassword: user.passwordHash != null }
      }
      case 'LINKED': {
        const won = await this.repo.transitionFlow(flow.id, RESOLVED, { status: CONSUMED })
        return won ? { status: 'LINKED', provider: slug } : errorResult('expired')
      }
      default:
        return errorResult('expired')
    }
  }

  // Emite os tokens UMA vez: quem vence a troca RESOLVED→CONSUMED leva; o outro (polling + volta do
  // app ao mesmo tempo) recebe "expirou" — o app já está logado e ignora.
  private async finishLogin(flow: SocialLoginFlow, user: SessionUser | null): Promise<ClaimResult> {
    if (!user || user.role !== 'CLIENT') {
      await this.repo.updateFlow(flow.id, { status: ERROR, errorCode: 'not_client' })
      return errorResult('not_client')
    }
    if (user.isBlocked) {
      await this.repo.updateFlow(flow.id, { status: ERROR, errorCode: 'blocked' })
      return errorResult('blocked')
    }

    const won = await this.repo.transitionFlow(flow.id, RESOLVED, { status: CONSUMED })
    if (!won) return errorResult('expired')

    const tokens = await this.auth.startSession(user, flow.deviceId)
    if (flow.providerUserId) await this.repo.touchAccountLogin(flow.provider, flow.providerUserId)
    return { status: 'LOGGED_IN', ...tokens }
  }

  // ── vínculo com conta existente (D-2) ────────────────────────────────────
  private async loadLinkFlow(flowId: string, secret: string, deviceId?: string) {
    const flow = await this.loadFlow(flowId, secret, deviceId)
    if (!flow || flow.status !== RESOLVED || flow.outcome !== 'LINK_REQUIRED' || !flow.matchedUserId) return null
    return flow
  }

  private tooMany(flow: SocialLoginFlow): boolean {
    return (flow.attempts ?? 0) >= MAX_LINK_ATTEMPTS
  }

  // Estourou as tentativas: o fluxo morre ("Comece de novo").
  private async expire(flow: SocialLoginFlow): Promise<LinkFieldError> {
    await this.repo.updateFlow(flow.id, { status: ERROR, errorCode: 'expired' })
    return { fieldError: 'too_many', attemptsLeft: 0 }
  }

  private async failedAttempt(flow: SocialLoginFlow, fieldError: 'code_wrong' | 'password_wrong'): Promise<LinkFieldError> {
    const { attempts } = await this.repo.incrementAttempts(flow.id)
    const used = attempts ?? MAX_LINK_ATTEMPTS
    if (used >= MAX_LINK_ATTEMPTS) return this.expire(flow)
    return { fieldError, attemptsLeft: MAX_LINK_ATTEMPTS - used }
  }

  /** Manda o código SEMPRE para o e-mail da conta encontrada — o cliente não escolhe o destino. */
  async sendLinkCode(flowId: string, secret: string): Promise<{ ok: true; maskedEmail: string } | ClaimResult | LinkFieldError> {
    const flow = await this.loadLinkFlow(flowId, secret)
    if (!flow) return errorResult('expired')
    if (this.tooMany(flow)) return this.expire(flow)

    const user = await this.repo.findSessionUser(flow.matchedUserId!)
    if (!user?.email) return errorResult('expired')

    // Em desenvolvimento, o mesmo código fixo do OTP de login, sem mandar e-mail (AuthService.sendOtp).
    const isDev = process.env.NODE_ENV === 'development'
    const code = isDev ? (process.env.OTP_DEV_CODE ?? '1234') : this.auth.generateOtpCode()
    await this.repo.updateFlow(flow.id, {
      codeHash: sha256Hex(code),
      codeTarget: user.email,
      codeExpiresAt: new Date(Date.now() + LINK_CODE_TTL_MS),
    })
    if (!isDev) await sendEmailOtp(user.email, code)

    return { ok: true, maskedEmail: maskEmail(user.email) }
  }

  async verifyLinkCode(flowId: string, secret: string, deviceId: string, code: string): Promise<ClaimResult | LinkFieldError> {
    const flow = await this.loadLinkFlow(flowId, secret, deviceId)
    if (!flow) return errorResult('expired')
    if (this.tooMany(flow)) return this.expire(flow)
    if (!flow.codeHash || !flow.codeExpiresAt) return { fieldError: 'no_code', attemptsLeft: MAX_LINK_ATTEMPTS - (flow.attempts ?? 0) }
    if (flow.codeExpiresAt < new Date()) return { fieldError: 'code_expired', attemptsLeft: MAX_LINK_ATTEMPTS - (flow.attempts ?? 0) }
    if (!sameHash(sha256Hex(code), flow.codeHash)) return this.failedAttempt(flow, 'code_wrong')

    const user = await this.repo.findSessionUser(flow.matchedUserId!)
    return this.linkAndLogin(flow, user)
  }

  async linkWithPassword(flowId: string, secret: string, deviceId: string, password: string): Promise<ClaimResult | LinkFieldError> {
    const flow = await this.loadLinkFlow(flowId, secret, deviceId)
    if (!flow) return errorResult('expired')
    if (this.tooMany(flow)) return this.expire(flow)

    const user = await this.repo.findSessionUser(flow.matchedUserId!)
    // Conta sem senha só confirma por código (o L6 nem mostra o campo); conta como tentativa errada.
    const passwordOk = user?.passwordHash ? await this.auth.verifyPassword(password, user.passwordHash) : false
    if (!passwordOk) return this.failedAttempt(flow, 'password_wrong')

    return this.linkAndLogin(flow, user)
  }

  // Confirmado (senha ou código): liga o Google à conta e entra. Bloqueio/perfil checados ANTES de
  // gravar o vínculo — conta bloqueada não ganha um Google.
  private async linkAndLogin(flow: SocialLoginFlow, user: SessionUser | null): Promise<ClaimResult> {
    if (!user || user.role !== 'CLIENT') return this.finishLogin(flow, user)
    if (user.isBlocked) return this.finishLogin(flow, user)
    if (!flow.providerUserId) return errorResult('expired')

    const current = await this.repo.findAccountOfUser(user.id, flow.provider)
    if (current && current.providerUserId !== flow.providerUserId) {
      await this.repo.updateFlow(flow.id, { status: ERROR, errorCode: 'provider_taken' })
      return errorResult('provider_taken')
    }
    if (!current) {
      try {
        await this.repo.createAccount({
          userId: user.id,
          provider: flow.provider,
          providerUserId: flow.providerUserId,
          email: flow.providerEmail,
        })
      } catch (err) {
        if (!isUniqueViolation(err)) throw err
        await this.repo.updateFlow(flow.id, { status: ERROR, errorCode: 'already_linked' })
        return errorResult('already_linked')
      }
    }
    return this.finishLogin(flow, user)
  }

  // ── cadastro pelo Google ("Quase lá") ────────────────────────────────────
  async complete(body: SocialCompleteBody): Promise<ClaimResult | HttpError> {
    const flow = await this.loadFlow(body.flowId, body.secret, body.deviceId)
    if (
      !flow ||
      flow.status !== RESOLVED ||
      flow.outcome !== 'SIGNUP' ||
      flow.emailVerified !== true ||
      !flow.providerEmail ||
      !flow.providerUserId
    ) {
      return errorResult('expired')
    }

    // Mesmas mensagens do POST /auth/register — o app já sabe mostrá-las.
    if (await this.repo.findAccount(flow.provider, flow.providerUserId)) {
      return { error: 'Essa conta Google já tem cadastro. Entre com o Google.', status: 409 }
    }
    if (await this.repo.findUserByEmailInsensitive(flow.providerEmail)) return { error: 'Email já cadastrado', status: 409 }
    if (await this.repo.findUserByPhone(body.phone)) return { error: 'Telefone já cadastrado', status: 409 }
    if (await this.repo.findUserByCpf(body.cpf)) return { error: 'CPF já cadastrado', status: 409 }

    let user: { id: string; name: string; role: string }
    try {
      user = await withWriteConflictRetry(() =>
        this.repo.createClientWithAccount(
          {
            name: body.name.trim(),
            cpf: body.cpf,
            birthDate: new Date(body.birthDate),
            phone: body.phone,
            email: flow.providerEmail!,
            condominiumId: body.condominiumId,
            apartment: body.apartment,
            block: body.block,
            complement: body.complement,
          },
          { provider: flow.provider, providerUserId: flow.providerUserId!, email: flow.providerEmail },
        ),
      )
    } catch (err) {
      // Corrida entre a checagem acima e a gravação (outra aba, mesmo CPF/telefone/Google).
      if (isUniqueViolation(err)) return { error: 'Esses dados já têm cadastro. Tente entrar.', status: 409 }
      throw err
    }

    await this.repo.transitionFlow(flow.id, RESOLVED, { status: CONSUMED })

    // Indicação: best-effort, como no /auth/register — nunca derruba um cadastro já criado.
    if (body.referralCode) {
      try {
        await attachReferralAtSignup(this.fastify, user, body.referralCode, body.referralSource ?? 'CODE')
      } catch (err) {
        this.fastify.log.warn({ err, userId: user.id }, '[social-auth] vínculo da indicação falhou — ignorado')
      }
    }

    // O e-mail veio verificado do Google: o 1º login é agora (conta para o Indique e Ganhe).
    const tokens = await this.auth.startSession({ id: user.id, role: user.role, name: user.name, passwordHash: null }, flow.deviceId)
    return { status: 'LOGGED_IN', ...tokens }
  }

  // ── contas conectadas (Perfil) ───────────────────────────────────────────
  async listAccounts(userId: string) {
    const accounts = await this.repo.listAccounts(userId)
    return accounts.map((a) => ({ provider: PROVIDER_SLUG[a.provider], email: a.email, linkedAt: a.linkedAt }))
  }

  // Sempre permitido: a conta tem e-mail, e o código no e-mail continua entrando (§5.3).
  async disconnect(userId: string, slug: SocialProviderSlug): Promise<void> {
    await this.repo.deleteAccountOfUser(userId, PROVIDER_ENUM[slug])
  }
}
