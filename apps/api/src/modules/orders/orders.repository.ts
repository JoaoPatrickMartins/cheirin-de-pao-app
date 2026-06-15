import { FastifyInstance } from 'fastify'

/**
 * OrdersRepository — acesso a dados de Orders.
 *
 * Nota: A reserva atômica de créditos (createSingleOrder) é implementada
 * inteiramente no OrdersService via prisma.$transaction. O repository expõe
 * apenas consultas simples que não requerem atomicidade.
 */
export class OrdersRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  async findById(id: string) {
    return this.prisma.order.findUnique({ where: { id } })
  }

  async findByUserId(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { scheduledDate: 'asc' },
    })
  }
}
