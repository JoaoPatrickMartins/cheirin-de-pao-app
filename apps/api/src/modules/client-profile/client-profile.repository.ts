import { FastifyInstance } from 'fastify'

export class ClientProfileRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } })
  }

  updateProfile(
    id: string,
    data: { name?: string; birthDate?: Date; condominiumId?: string; apartment?: string; block?: string },
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        birthDate: true,
        condominiumId: true,
        apartment: true,
        block: true,
        phone: true,
        email: true,
        cpf: true,
        creditBalance: true,
      },
    })
  }

  updateContact(id: string, data: { phone?: string; email?: string }) {
    return this.prisma.user.update({ where: { id }, data })
  }

  findCondominium(id: string) {
    return this.prisma.condominium.findUnique({ where: { id } })
  }

  findActiveSchedule(userId: string) {
    return this.prisma.schedule.findFirst({ where: { userId, isActive: true } })
  }

  deactivateSchedules(userId: string) {
    return this.prisma.schedule.updateMany({ where: { userId, isActive: true }, data: { isActive: false } })
  }

  findActiveContactChangeOtp(userId: string) {
    return this.prisma.otpCode.findFirst({
      where: { userId, usedAt: { isSet: false }, expiresAt: { gt: new Date() }, purpose: 'CONTACT_CHANGE' },
      orderBy: { createdAt: 'desc' },
    })
  }

  createContactChangeOtp(data: { userId: string; code: string; channel: string; expiresAt: Date }) {
    return this.prisma.otpCode.create({ data: { ...data, purpose: 'CONTACT_CHANGE' } })
  }

  markOtpUsed(id: string) {
    return this.prisma.otpCode.update({ where: { id }, data: { usedAt: new Date() } })
  }

  checkContactConflict(field: 'phone' | 'email', value: string) {
    return this.prisma.user.findFirst({ where: { [field]: value } })
  }

  // Leitura focada do estado do onboarding (fonte de verdade).
  findOnboarding(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, onboardingCompletedAt: true },
    })
  }

  // Gravação por id único → sempre persiste (sem guarda de where frágil).
  // A idempotência (preservar a data original) é decidida no service.
  setOnboardingCompleted(id: string, at: Date) {
    return this.prisma.user.update({
      where: { id },
      data: { onboardingCompletedAt: at },
      select: { id: true, onboardingCompletedAt: true },
    })
  }
}
