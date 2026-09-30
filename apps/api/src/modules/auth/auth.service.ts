import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { FastifyInstance } from 'fastify'
import { AuthRepository } from './auth.repository.js'
import { sendEmailOtp } from './otp.service.js'
import { attachReferralAtSignup, markReferralVerified } from '../../lib/referral.js'
import type { RegisterBody, RegisterCourierBody } from './auth.schema.js'

const REFRESH_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000 // 90 dias
const BCRYPT_ROUNDS = 10

// Hash bcrypt fixo usado como "isca" no login quando o e-mail não existe ou não tem senha:
// mantém o tempo de resposta constante (anti-enumeração / timing attack).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('cheirin-de-pao-dummy-password', BCRYPT_ROUNDS)

type SessionUser = { id: string; role: string; name: string }

// Resultado de qualquer fluxo que autentica e emite tokens (login/OTP/reset/refresh/Google).
export type AuthTokens = {
  accessToken: string
  refreshToken: string
  user: SessionUser
  hasPassword: boolean
  // true = conta sem senha E sem login social — o app força "defina sua senha". Conta criada pelo
  // Google não tem senha e mesmo assim entra (plano-login-social.md, T-7).
  mustSetPassword: boolean
}

// Estado da credencial que viaja com os tokens.
export type CredentialFlags = { hasPassword: boolean; mustSetPassword: boolean }

// Usuário com o mínimo para abrir uma sessão (claims do JWT + estado da senha).
export type SessionCandidate = SessionUser & { passwordHash: string | null }

type AuthError = { error: string; status: number }

// Conta bloqueada pelo admin. Vale para TODO caminho que emite tokens (senha, OTP, reset e refresh)
// — antes só o login por senha checava, e o bloqueado seguia entrando por código ou pelo refresh.
const BLOCKED_ERROR: AuthError = { error: 'Conta bloqueada. Fale com o suporte.', status: 403 }

export class AuthService {
  private repo: AuthRepository

  constructor(private fastify: FastifyInstance) {
    this.repo = new AuthRepository(fastify)
  }

  generateOtpCode(): string {
    // randomInt é CSPRNG: gera inteiro em [min, max) com segurança criptográfica
    return randomInt(1000, 10000).toString()
  }

  hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }

  generateSessionToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('hex')
    return { raw, hash: this.hashValue(raw) }
  }

  // OTP enviado apenas por e-mail neste primeiro momento. O segundo canal
  // (WhatsApp) será adicionado depois reaproveitando esta mecânica.
  async sendOtp(userId: string, email: string): Promise<void> {
    // Fallback manual: se o ADMIN gerou um código de acesso ainda ativo para
    // este usuário (channel 'admin-manual'), não invalida nem tenta enviar
    // e-mail — o cliente usa esse código. Assim o clique em "Enviar código"
    // funciona mesmo com o Resend fora do ar (que é justamente quando o admin
    // gera o código manual). Ver AdminClientsService.generateAccessCode.
    const activeOtp = await this.repo.findActiveOtp(userId)
    if (activeOtp?.channel === 'admin-manual') return

    if (process.env.NODE_ENV === 'development') {
      const devCode = process.env.OTP_DEV_CODE ?? '1234'
      const existing = await this.repo.findActiveOtp(userId)
      if (!existing) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
        await this.repo.createOtp({ userId, code: this.hashValue(devCode), channel: 'email', expiresAt })
      }
      return
    }

    // Cada pedido reenvia um código novo: invalida os OTPs de login ainda
    // ativos (o código é armazenado hasheado, então não há como reenviar o
    // mesmo) e gera um fresco. Abuso é contido pelo rate limit da rota (5/min).
    await this.repo.invalidateActiveLoginOtps(userId)

    const code = this.generateOtpCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    await this.repo.createOtp({ userId, code: this.hashValue(code), channel: 'email', expiresAt })

    await sendEmailOtp(email, code)
  }

  // Gera um OTP de login manual (ADMIN) com validade estendida, SEM enviar e-mail.
  // Usado como fallback quando o Resend está indisponível: o admin repassa o
  // código ao cliente, que o usa no fluxo normal de "Entrar com código no e-mail".
  // Marca channel 'admin-manual' (preservado por sendOtp) e purpose 'LOGIN' (para
  // ser encontrado por findActiveOtp/consumeOtp na verificação). Invalida OTPs de
  // login ativos anteriores para garantir um único código válido. Retorna o código
  // em texto claro — única vez em que ele fica visível (é gravado em SHA-256).
  async createManualOtp(userId: string, ttlMinutes: number): Promise<{ code: string; expiresAt: Date }> {
    await this.repo.invalidateActiveLoginOtps(userId)

    const code = this.generateOtpCode()
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)
    await this.repo.createOtp({
      userId,
      code: this.hashValue(code),
      channel: 'admin-manual',
      expiresAt,
      purpose: 'LOGIN',
    })

    return { code, expiresAt }
  }

  // Assina o access token JWT (vida curta — expiresIn definido no registro do plugin).
  // sid = id da Session (refresh) para permitir logout direcionado.
  private signAccessToken(user: SessionUser, sessionId: string, deviceId: string): string {
    return this.fastify.jwt.sign({
      sub: user.id,
      role: user.role,
      name: user.name,
      sid: sessionId,
      deviceId,
    })
  }

  // Cria a Session (refresh token opaco, hasheado) e emite o par access+refresh.
  async issueTokens(
    user: SessionUser,
    deviceId: string,
    flags: CredentialFlags,
  ): Promise<AuthTokens> {
    const { raw, hash } = this.generateSessionToken()
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_MS)
    const session = await this.repo.createSession({ userId: user.id, token: hash, deviceId, expiresAt })
    const accessToken = this.signAccessToken(user, session.id, deviceId)
    return { accessToken, refreshToken: raw, user, ...flags }
  }

  // hasPassword + mustSetPassword. Só consulta as contas sociais quando não há senha — o caso comum
  // (conta com senha) não paga a consulta.
  async credentialFlags(userId: string, passwordHash: string | null): Promise<CredentialFlags> {
    if (passwordHash != null) return { hasPassword: true, mustSetPassword: false }
    const socialAccounts = await this.repo.countSocialAccounts(userId)
    return { hasPassword: false, mustSetPassword: socialAccounts === 0 }
  }

  // Abre a sessão de um usuário já autenticado por qualquer caminho (senha, OTP, reset, Google):
  // sessão única por aparelho → tokens → 1º login conta para o Indique e Ganhe.
  // O bloqueio é checado ANTES por quem chama (cada caminho tem a sua ordem anti-enumeração).
  async startSession(user: SessionCandidate, deviceId: string): Promise<AuthTokens> {
    await this.revokeOtherDevices(user.id, deviceId, user.role)
    const flags = await this.credentialFlags(user.id, user.passwordHash)
    const tokens = await this.issueTokens({ id: user.id, role: user.role, name: user.name }, deviceId, flags)
    await markReferralVerified(this.fastify, user.id)
    return tokens
  }

  // Sessão única por dispositivo: revoga refresh tokens ativos de outros devices.
  // Exceção: ADMIN pode manter vários dispositivos logados ao mesmo tempo (a operação
  // é compartilhada por mais de um operador). Os demais papéis seguem sessão única.
  private async revokeOtherDevices(userId: string, deviceId: string, role: string): Promise<void> {
    if (role === 'ADMIN') return
    const activeSessions = await this.repo.findActiveSessionsByUserId(userId)
    for (const session of activeSessions) {
      if (session.deviceId !== deviceId) {
        await this.repo.revokeSession(session.id)
      }
    }
  }

  // Valida um OTP ativo (expiry + comparação timing-safe), marca como usado e
  // devolve os dados de auth do usuário. Reutilizado por login-OTP e reset de senha.
  private async consumeOtp(
    userId: string,
    code: string,
  ): Promise<{ user: { id: string; role: string; name: string; passwordHash: string | null } } | AuthError> {
    const otp = await this.repo.findActiveOtp(userId)
    if (!otp) return { error: 'OTP não encontrado ou expirado', status: 401 }

    // Pitfall 2: explicit expiry check
    if (otp.expiresAt < new Date()) return { error: 'OTP expirado', status: 401 }

    // Comparação segura contra timing attacks
    const expectedHash = Buffer.from(this.hashValue(code), 'hex')
    const actualHash = Buffer.from(otp.code, 'hex')
    const match =
      expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash)
    if (!match) return { error: 'Código inválido', status: 401 }

    const user = await this.repo.findUserAuthInfo(userId)
    if (!user) return { error: 'Usuário não encontrado', status: 404 }
    // Só depois de validar o código — quem não tem o código não descobre que a conta está
    // bloqueada (mesma ordem do login por senha). Cobre login por OTP e reset de senha.
    if (user.isBlocked) return BLOCKED_ERROR

    await this.repo.markOtpUsed(otp.id)
    return { user }
  }

  async verifyOtpAndCreateSession(
    userId: string,
    code: string,
    deviceId: string,
  ): Promise<AuthTokens | AuthError> {
    const res = await this.consumeOtp(userId, code)
    if ('error' in res) return res

    return this.startSession(res.user, deviceId)
  }

  // Rotação de refresh token — valida o refresh atual, revoga e emite um novo par.
  async refreshSession(refreshToken: string, deviceId: string): Promise<AuthTokens | AuthError> {
    const hash = this.hashValue(refreshToken)
    const session = await this.repo.findSessionByTokenHash(hash)
    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      return { error: 'Sessão inválida ou expirada', status: 401 }
    }
    if (session.deviceId !== deviceId) {
      return { error: 'Dispositivo alterado — faça login novamente', status: 401 }
    }

    const user = await this.repo.findUserAuthInfo(session.userId)
    if (!user) return { error: 'Usuário não encontrado', status: 404 }
    // Bloqueado: encerra esta sessão em vez de renová-la. O app trata qualquer falha do refresh
    // como sessão morta e desloga (apiFetch.doRefresh).
    if (user.isBlocked) {
      await this.repo.revokeSession(session.id)
      return BLOCKED_ERROR
    }

    // Rotaciona: revoga o refresh atual e emite um novo par para o mesmo device.
    await this.repo.revokeSession(session.id)
    return this.issueTokens(
      { id: user.id, role: user.role, name: user.name },
      deviceId,
      await this.credentialFlags(user.id, user.passwordHash),
    )
  }

  // Logout — revoga a Session (refresh) do token atual. Idempotente.
  async logout(sessionId: string): Promise<void> {
    await this.repo.revokeSessionById(sessionId)
  }

  // ── Senha (bcrypt) ────────────────────────────────────────────────────────
  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS)
  }

  verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  // Login por e-mail + senha. Resposta genérica + comparação com hash-isca quando
  // o e-mail não existe ou a conta ainda não tem senha (anti-enumeração + timing).
  async loginWithPassword(
    email: string,
    password: string,
    deviceId: string,
  ): Promise<AuthTokens | AuthError> {
    const user = await this.repo.findUserByEmail(email)
    const hashToCompare = user?.passwordHash ?? DUMMY_PASSWORD_HASH
    const passwordOk = await this.verifyPassword(password, hashToCompare)

    if (!user || !user.passwordHash || !passwordOk) {
      return { error: 'E-mail ou senha inválidos', status: 401 }
    }
    if (user.isBlocked) return BLOCKED_ERROR

    return this.startSession(user, deviceId)
  }

  // Define a senha no 1º acesso — permitido SOMENTE quando a conta ainda não tem senha.
  // Depois disso, troca só via reset (OTP) ou change (senha atual).
  async setPassword(userId: string, password: string): Promise<{ ok: true } | AuthError> {
    const user = await this.repo.findUserAuthInfo(userId)
    if (!user) return { error: 'Usuário não encontrado', status: 404 }
    if (user.passwordHash) {
      return { error: 'Senha já definida. Use a troca de senha.', status: 409 }
    }
    const hash = await this.hashPassword(password)
    await this.repo.updatePassword(userId, hash)
    return { ok: true }
  }

  // Recuperação via OTP: confirma o código e define a nova senha (atômico) + emite tokens.
  async resetPasswordWithOtp(
    userId: string,
    code: string,
    deviceId: string,
    newPassword: string,
  ): Promise<AuthTokens | AuthError> {
    const res = await this.consumeOtp(userId, code)
    if ('error' in res) return res

    const hash = await this.hashPassword(newPassword)
    await this.repo.updatePassword(userId, hash)

    return this.startSession({ ...res.user, passwordHash: hash }, deviceId)
  }

  // Troca de senha logado — exige a senha atual correta.
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true } | AuthError> {
    const user = await this.repo.findUserAuthInfo(userId)
    if (!user || !user.passwordHash) {
      // Conta sem senha ainda não pode "trocar" — deve usar setPassword via 1º acesso.
      return { error: 'Senha atual inválida', status: 401 }
    }
    const ok = await this.verifyPassword(currentPassword, user.passwordHash)
    if (!ok) return { error: 'Senha atual inválida', status: 401 }

    const hash = await this.hashPassword(newPassword)
    await this.repo.updatePassword(userId, hash)
    return { ok: true }
  }

  async register(
    body: RegisterBody,
  ): Promise<{ userId: string } | { error: string; status: 409 }> {
    const {
      phone, email, name, cpf, birthDate, password, condominiumId, apartment, block, complement,
      referralCode, referralSource,
    } = body

    const existingPhone = await this.repo.findUserByPhone(phone)
    if (existingPhone) return { error: 'Telefone já cadastrado', status: 409 }
    const existingEmail = await this.repo.findUserByEmail(email)
    if (existingEmail) return { error: 'Email já cadastrado', status: 409 }
    // CPF é @unique no schema. Sem esta checagem, um CPF repetido estourava no create
    // (P2002) e virava 500 "Erro interno" em vez de mensagem amigável.
    const existingCpf = await this.repo.findUserByCpf(cpf)
    if (existingCpf) return { error: 'CPF já cadastrado', status: 409 }

    const passwordHash = await this.hashPassword(password)

    const user = await this.repo.createUser({
      name,
      cpf,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      phone,
      email,
      passwordHash,
      role: 'CLIENT',
      condominiumId,
      apartment,
      block,
      complement,
    })

    // Indicação: best-effort por dentro (nunca lança) — código ruim ou programa desligado não
    // atrapalha o cadastro, só não vincula. O aviso a quem indicou espera o 1º login do amigo
    // (`markReferralVerified`), para não avisar de um cadastro abandonado antes do código.
    if (referralCode) {
      try {
        await attachReferralAtSignup(this.fastify, user, referralCode, referralSource ?? 'CODE')
      } catch (err) {
        // Segunda camada: o usuário JÁ foi criado — um 500 aqui faria o app pedir um cadastro que
        // não pode mais ser refeito (e-mail/CPF já existem).
        this.fastify.log.warn({ err, userId: user.id }, '[auth] vínculo da indicação falhou — ignorado')
      }
    }

    // O código de confirmação NÃO sai daqui: a tela chama POST /auth/otp/send logo depois do
    // cadastro (inclusive versões antigas do PWA em cache). Enviar nos dois lugares mandava dois
    // e-mails, e o 2º invalidava o 1º — quem digitava o código do primeiro e-mail via "Código
    // incorreto".
    return { userId: user.id }
  }

  async registerCourier(
    body: RegisterCourierBody,
  ): Promise<{ userId: string } | { error: string; status: 409 }> {
    const { name, cpf, phone, email } = body

    if (phone) {
      const existing = await this.repo.findUserByPhone(phone)
      if (existing) return { error: 'Telefone já cadastrado', status: 409 }
    }
    if (email) {
      const existing = await this.repo.findUserByEmail(email)
      if (existing) return { error: 'Email já cadastrado', status: 409 }
    }

    const user = await this.repo.createUser({ name, cpf, phone, email, role: 'COURIER' })
    return { userId: user.id }
  }
}
