import { FastifyInstance } from 'fastify'
import { CreateCourierBody, UpdateCourierBody } from './admin-couriers.schema.js'

export class AdminCouriersRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  findAll() {
    return this.prisma.user.findMany({
      where: { role: 'COURIER' },
      select: {
        id: true,
        name: true,
        cpf: true,
        phone: true,
        email: true,
        isBlocked: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })
  }

  findById(id: string) {
    return this.prisma.user.findFirst({
      where: { id },
      select: {
        id: true,
        name: true,
        cpf: true,
        phone: true,
        email: true,
        isBlocked: true,
        role: true,
        createdAt: true,
      },
    })
  }

  create(data: CreateCourierBody) {
    return this.prisma.user.create({
      data: {
        ...data,
        role: 'COURIER',
        creditBalance: 0,
      },
    })
  }

  update(id: string, data: UpdateCourierBody) {
    return this.prisma.user.update({ where: { id }, data })
  }

  toggleBlocked(id: string, isBlocked: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isBlocked },
      select: {
        id: true,
        name: true,
        isBlocked: true,
      },
    })
  }
}
