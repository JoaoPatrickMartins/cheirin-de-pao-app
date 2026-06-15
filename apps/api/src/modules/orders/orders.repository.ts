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

  /**
   * Busca o pedido de hoje para o usuário dentro do intervalo BRT fornecido.
   * Exclui pedidos com status CANCELLED.
   */
  async findTodayByUserId(userId: string, start: Date, end: Date) {
    return this.prisma.order.findFirst({
      where: { userId, scheduledDate: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
    })
  }

  /**
   * Busca o histórico de pedidos a partir de uma data de corte.
   * Exclui pedidos com status CANCELLED; ordenados por scheduledDate desc.
   */
  async findHistoryByUserId(userId: string, since: Date) {
    return this.prisma.order.findMany({
      where: { userId, scheduledDate: { gte: since }, status: { not: 'CANCELLED' } },
      orderBy: { scheduledDate: 'desc' },
    })
  }
}
