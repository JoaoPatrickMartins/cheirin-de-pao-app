import { FastifyInstance } from 'fastify'

export class AdminClientsRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  findAllClients(condominiumId?: string) {
    return this.prisma.user.findMany({
      where: {
        role: 'CLIENT',
        ...(condominiumId ? { condominiumId } : {}),
      },
      select: {
        id: true,
        name: true,
        condominiumId: true,
        apartment: true,
        block: true,
        creditBalance: true,
        isBlocked: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })
  }

  findClientById(id: string) {
    return this.prisma.user.findUnique({ where: { id } })
  }

  findActiveSchedule(userId: string) {
    return this.prisma.schedule.findFirst({
      where: { userId, isActive: true },
    })
  }

  findRecentOrders(userId: string, since: Date) {
    return this.prisma.order.findMany({
      where: {
        userId,
        scheduledDate: { gte: since },
      },
      orderBy: { scheduledDate: 'desc' },
    })
  }

  findLastPurchase(userId: string) {
    return this.prisma.creditTransaction.findFirst({
      where: { userId, type: 'PURCHASE' },
      orderBy: { createdAt: 'desc' },
    })
  }

  toggleBlocked(id: string, isBlocked: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isBlocked },
      select: {
        id: true,
        isBlocked: true,
      },
    })
  }
}
