import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { AuthRepository } from './auth.repository.js'
import { sendSmsOtp, sendEmailOtp } from './otp.service.js'
import type { RegisterBody, RegisterCourierBody } from './auth.schema.js'

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

  async sendOtp(userId: string, channel: 'sms' | 'email', dest: string): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      const devCode = process.env.OTP_DEV_CODE ?? '1234'
      const existing = await this.repo.findActiveOtp(userId)
      if (!existing) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
        await this.repo.createOtp({ userId, code: this.hashValue(devCode), channel, expiresAt })
      }
      return
    }

    // Pitfall 5: reuse existing non-expired OTP to avoid duplicate sends
    const existing = await this.repo.findActiveOtp(userId)
    if (existing) return

    const code = this.generateOtpCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    await this.repo.createOtp({ userId, code: this.hashValue(code), channel, expiresAt })

    if (channel === 'sms') {
      await sendSmsOtp(dest, code)
    } else {
      await sendEmailOtp(dest, code)
    }
  }

  async createSessionForUser(
    userId: string,
    deviceId: string,
  ): Promise<{ session: Awaited<ReturnType<AuthRepository['createSession']>>; rawToken: string }> {
    const { raw, hash } = this.generateSessionToken()
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    const session = await this.repo.createSession({ userId, token: hash, deviceId, expiresAt })
    return { session, rawToken: raw }
  }

  async verifyOtpAndCreateSession(
    userId: string,
    code: string,
    deviceId: string,
  ): Promise<
    | { error: string; status: 401 }
    | { session: Awaited<ReturnType<AuthRepository['createSession']>>; rawToken: string }
  > {
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

    await this.repo.markOtpUsed(otp.id)

    // Device mismatch detection: revoke sessions from other devices
    const activeSessions = await this.repo.findActiveSessionsByUserId(userId)
    for (const session of activeSessions) {
      if (session.deviceId !== deviceId) {
        await this.repo.revokeSession(session.id)
      }
    }

    return this.createSessionForUser(userId, deviceId)
  }

  async register(
    body: RegisterBody,
  ): Promise<{ userId: string } | { error: string; status: 409 }> {
    const { phone, email, channel, name, cpf, birthDate, condominiumId, apartment, block } = body

    if (phone) {
      const existing = await this.repo.findUserByPhone(phone)
      if (existing) return { error: 'Telefone já cadastrado', status: 409 }
    }
    if (email) {
      const existing = await this.repo.findUserByEmail(email)
      if (existing) return { error: 'Email já cadastrado', status: 409 }
    }

    const user = await this.repo.createUser({
      name,
      cpf,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      phone,
      email,
      role: 'CLIENT',
      condominiumId,
      apartment,
      block,
    })

    const dest = (channel === 'sms' ? phone : email)!
    await this.sendOtp(user.id, channel, dest)
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
