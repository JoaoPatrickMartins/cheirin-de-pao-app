import { FastifyInstance } from 'fastify'

export class CreditsRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  listActiveCombos() {
    return this.prisma.combo.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    })
  }

  getSettingByKey(key: string) {
    return this.prisma.setting.findUnique({ where: { key } })
  }

  getSettingsByKeys(keys: string[]) {
    return this.prisma.setting.findMany({ where: { key: { in: keys } } })
  }

  getCreditHistory(userId: string) {
    return this.prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  getUserById(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } })
  }

  updateUser(userId: string, data: Record<string, unknown>) {
    return this.prisma.user.update({ where: { id: userId }, data })
  }
}
