import { FastifyInstance } from 'fastify'

/**
 * AdminPaymentsRepository — acesso a dados de pagamentos para o admin.
 *
 * Padrão baseado em payments.repository.ts.
 */
export class AdminPaymentsRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * findAll — lista todos os pagamentos ordenados por data decrescente.
   * Retorna dados brutos; o service enriquece com nome do user.
   */
  findAll() {
    return this.prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * findById — busca um pagamento por ID.
   */
  findById(id: string) {
    return this.prisma.payment.findUnique({ where: { id } })
  }

  /**
   * updateStatus — atualiza o status de um pagamento.
   */
  updateStatus(id: string, status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED') {
    return this.prisma.payment.update({ where: { id }, data: { status } })
  }
}
