import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { FastifyInstance } from 'fastify'
import { AuthRepository } from './auth.repository.js'
import { sendEmailOtp } from './otp.service.js'
import type { RegisterBody, RegisterCourierBody } from './auth.schema.js'

const REFRESH_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000 // 90 dias
const BCRYPT_ROUNDS = 10

// Hash bcrypt fixo usado como "isca" no login quando o e-mail não existe ou não tem senha:
// mantém o tempo de resposta constante (anti-enumeração / timing attack).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('cheirin-de-pao-dummy-password', BCRYPT_ROUNDS)

type SessionUser = { id: string; role: string; name: string }

// Resultado de qualquer fluxo que autentica e emite tokens (login/OTP/reset/refresh).
export type AuthTokens = {
  accessToken: string
  refreshToken: string
  user: SessionUser
  hasPassword: boolean
}

type AuthError = { error: string; status: number }

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
    hasPassword: boolean,
  ): Promise<AuthTokens> {
    const { raw, hash } = this.generateSessionToken()
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_MS)
    const session = await this.repo.createSession({ userId: user.id, token: hash, deviceId, expiresAt })
    const accessToken = this.signAccessToken(user, session.id, deviceId)
    return { accessToken, refreshToken: raw, user, hasPassword }
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

    await this.revokeOtherDevices(userId, deviceId, res.user.role)
    return this.issueTokens(
      { id: res.user.id, role: res.user.role, name: res.user.name },
      deviceId,
      res.user.passwordHash != null,
    )
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

    // Rotaciona: revoga o refresh atual e emite um novo par para o mesmo device.
    await this.repo.revokeSession(session.id)
    return this.issueTokens(
      { id: user.id, role: user.role, name: user.name },
      deviceId,
      user.passwordHash != null,
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
    if (user.isBlocked) {
      return { error: 'Conta bloqueada. Fale com o suporte.', status: 403 }
    }

    await this.revokeOtherDevices(user.id, deviceId, user.role)
    return this.issueTokens(
      { id: user.id, role: user.role, name: user.name },
      deviceId,
      true,
    )
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

    await this.revokeOtherDevices(userId, deviceId, res.user.role)
    return this.issueTokens(
      { id: res.user.id, role: res.user.role, name: res.user.name },
      deviceId,
      true,
    )
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
    const { phone, email, name, cpf, birthDate, password, condominiumId, apartment, block } = body

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
    })

    await this.sendOtp(user.id, email)
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
