import { FastifyInstance } from 'fastify'

export class AuthRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  findUserByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } })
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } })
  }

  createUser(data: {
    name: string
    cpf: string
    birthDate?: Date
    phone?: string
    email?: string
    role?: 'CLIENT' | 'COURIER' | 'ADMIN'
    condominiumId?: string
    apartment?: string
    block?: string
  }) {
    return this.prisma.user.create({ data: { role: 'CLIENT', ...data } })
  }

  findActiveOtp(userId: string) {
    return this.prisma.otpCode.findFirst({
      where: { userId, usedAt: { isSet: false }, expiresAt: { gt: new Date() }, purpose: { in: [null, 'LOGIN'] } },
      orderBy: { createdAt: 'desc' },
    })
  }

  createOtp(data: { userId: string; code: string; channel: string; expiresAt: Date; purpose?: string }) {
    return this.prisma.otpCode.create({ data })
  }

  markOtpUsed(id: string) {
    return this.prisma.otpCode.update({ where: { id }, data: { usedAt: new Date() } })
  }

  findActiveSessionsByUserId(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
    })
  }

  createSession(data: { userId: string; token: string; deviceId: string; expiresAt: Date }) {
    return this.prisma.session.create({ data })
  }

  findSessionByTokenHash(hash: string) {
    return this.prisma.session.findUnique({ where: { token: hash } })
  }

  revokeSession(id: string) {
    return this.prisma.session.update({ where: { id }, data: { isRevoked: true } })
  }

  updateSessionLastUsed(id: string) {
    return this.prisma.session.update({ where: { id }, data: { lastUsedAt: new Date() } })
  }
}
