import { FastifyInstance } from 'fastify'
import { ScheduleBody } from './schedules.schema.js'

export class SchedulesRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  findActiveByUserId(userId: string) {
    return this.prisma.schedule.findFirst({
      where: { userId, isActive: true },
    })
  }

  upsert(userId: string, condominiumId: string, data: ScheduleBody) {
    return this.prisma.schedule.upsert({
      where: {
        userId_condominiumId: { userId, condominiumId },
      },
      update: {
        weeklyQty: data.weeklyQty,
        deliveryTime: data.deliveryTime,
        notifyReconfigure: data.notifyReconfigure,
        isActive: true,
      },
      create: {
        userId,
        condominiumId,
        weeklyQty: data.weeklyQty,
        deliveryTime: data.deliveryTime,
        notifyReconfigure: data.notifyReconfigure,
        isActive: true,
      },
    })
  }

  findAllActive() {
    return this.prisma.schedule.findMany({
      where: { isActive: true },
    })
  }

  findUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        creditBalance: true,
        condominiumId: true,
        autoRecharge: true,
        oneSignalPlayerId: true,
      },
    })
  }

  decrementCreditBalance(userId: string, amount: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { creditBalance: { decrement: amount } },
    })
  }
}
