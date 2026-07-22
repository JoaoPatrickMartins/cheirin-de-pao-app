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
   * status === 'OUT_FOR_DELIVERY' — o entregador só enxerga o que o admin já
   * APROVOU/despachou na divisão (aprovação faz SEPARATED → OUT_FOR_DELIVERY).
   * Pedidos ainda não aprovados (SCHEDULED/SEPARATED) e finalizados
   * (DELIVERED/NOT_DELIVERED) ficam fora da rota ativa.
   */
  async findTodayByCourierId(courierId: string, start: Date, end: Date) {
    return this.prisma.order.findMany({
      where: {
        courierId,
        scheduledDate: { gte: start, lte: end },
        status: 'OUT_FOR_DELIVERY',
      },
    })
  }

  /**
   * Busca as entregas JÁ concluídas do entregador para hoje (range BRT).
   *
   * Filtra: courierId === param, scheduledDate no range, status finalizado
   * (DELIVERED ou NOT_DELIVERED). Alimenta a aba "Realizadas" — diferente da rota
   * ativa (OUT_FOR_DELIVERY), estas persistem e sobrevivem ao recarregar a tela.
   */
  async findTodayCompletedByCourierId(courierId: string, start: Date, end: Date) {
    return this.prisma.order.findMany({
      where: {
        courierId,
        scheduledDate: { gte: start, lte: end },
        status: { in: ['DELIVERED', 'NOT_DELIVERED'] },
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
