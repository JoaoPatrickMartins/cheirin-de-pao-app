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
    const isMultiSlot = 'days' in data && data.days !== undefined

    if (isMultiSlot) {
      return this.prisma.schedule.upsert({
        where: {
          userId_condominiumId: { userId, condominiumId },
        },
        update: {
          days: data.days,
          notifyReconfigure: data.notifyReconfigure,
          isActive: true,
        },
        create: {
          userId,
          condominiumId,
          days: data.days,
          notifyReconfigure: data.notifyReconfigure,
          isActive: true,
        },
      })
    }

    // Modo legado: weeklyQty + deliveryTime
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

  /** O ciclo (condomínio, slot, dia de entrega) já foi materializado? (marca persistida) */
  async isCycleMaterialized(condominiumId: string, slotId: string, deliveryDate: string): Promise<boolean> {
    const row = await this.prisma.materializedCycle.findFirst({
      where: { condominiumId, slotId, deliveryDate },
      select: { id: true },
    })
    return !!row
  }

  /** Marca o ciclo como materializado (idempotente via unique composto). */
  async markCycleMaterialized(condominiumId: string, slotId: string, deliveryDate: string): Promise<void> {
    await this.prisma.materializedCycle.upsert({
      where: { condominiumId_slotId_deliveryDate: { condominiumId, slotId, deliveryDate } },
      create: { condominiumId, slotId, deliveryDate },
      update: {},
    })
  }

  /** Remove marcas de ciclos antigos (entrega anterior a `beforeDate`, YYYY-MM-DD). */
  deleteCyclesBefore(beforeDate: string) {
    return this.prisma.materializedCycle.deleteMany({ where: { deliveryDate: { lt: beforeDate } } })
  }
}
