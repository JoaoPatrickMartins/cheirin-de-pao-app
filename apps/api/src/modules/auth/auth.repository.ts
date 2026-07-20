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

  findUserByCpf(cpf: string) {
    return this.prisma.user.findUnique({ where: { cpf } })
  }

  createUser(data: {
    name: string
    cpf: string
    birthDate?: Date
    phone?: string
    email?: string
    role?: 'CLIENT' | 'COURIER' | 'ADMIN'
    passwordHash?: string
    condominiumId?: string
    apartment?: string
    block?: string
  }) {
    return this.prisma.user.create({ data: { role: 'CLIENT', ...data } })
  }

  // Define/atualiza a senha (hash bcrypt) e registra o momento (auditoria).
  updatePassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordSetAt: new Date() },
    })
  }

  findActiveOtp(userId: string) {
    return this.prisma.otpCode.findFirst({
      where: {
        userId,
        usedAt: { isSet: false },
        expiresAt: { gt: new Date() },
        OR: [{ purpose: 'LOGIN' }, { purpose: { isSet: false } }],
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  createOtp(data: { userId: string; code: string; channel: string; expiresAt: Date; purpose?: string }) {
    return this.prisma.otpCode.create({ data })
  }

  // Marca como usados todos os OTPs de login ainda ativos do usuário, para que
  // um novo pedido de código (reenvio) gere e envie um código fresco.
  invalidateActiveLoginOtps(userId: string) {
    return this.prisma.otpCode.updateMany({
      where: {
        userId,
        usedAt: { isSet: false },
        expiresAt: { gt: new Date() },
        OR: [{ purpose: 'LOGIN' }, { purpose: { isSet: false } }],
      },
      data: { usedAt: new Date() },
    })
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

  // Revoga por id sem lançar se a sessão não existir (logout / rotação idempotente).
  revokeSessionById(id: string) {
    return this.prisma.session.updateMany({ where: { id }, data: { isRevoked: true } })
  }

  // Dados mínimos para claims do JWT + hasPassword. NÃO expor passwordHash em respostas.
  findUserAuthInfo(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true, passwordHash: true },
    })
  }

  updateSessionLastUsed(id: string) {
    return this.prisma.session.update({ where: { id }, data: { lastUsedAt: new Date() } })
  }
}
