import { FastifyInstance } from 'fastify'

/**
 * CourierRepository — acesso a dados de Orders para o entregador.
 *
 * T-06-03: findTodayByCourierId filtra exclusivamente por courierId —
 * orders sem courierId ou com courierId diferente nunca retornam (COUR-01).
 */
export class CourierRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Busca ordens do entregador para hoje (range BRT fornecido).
   *
   * Filtra: courierId === courierId param, scheduledDate no range,
   * status IN ['SCHEDULED', 'OUT_FOR_DELIVERY'].
   */
  async findTodayByCourierId(courierId: string, start: Date, end: Date) {
    return this.prisma.order.findMany({
      where: {
        courierId,
        scheduledDate: { gte: start, lte: end },
        status: { in: ['SCHEDULED', 'OUT_FOR_DELIVERY'] },
      },
    })
  }

  /**
   * Busca uma order por ID.
   * Retorna null se nao encontrada.
   */
  async findById(id: string) {
    return this.prisma.order.findUnique({ where: { id } })
  }
}
