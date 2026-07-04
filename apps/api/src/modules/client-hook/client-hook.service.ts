import { FastifyInstance } from 'fastify'

/**
 * ClientHookService — solicitação do gancho de porta pelo próprio cliente.
 *
 * Fluxo (pós-primeiro-pedido): o app exibe um modal explicando o gancho e o
 * cliente confirma o recebimento. A confirmação apenas marca hookRequestedAt;
 * a entrega física é registrada depois pelo Admin (módulo admin-hooks).
 */
export class ClientHookService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Status do gancho para decidir se o app deve pedir o consentimento.
   * needsConsent = já fez ao menos 1 pedido E ainda não solicitou o gancho.
   *
   * @throws { statusCode: 404 } se o usuário não for CLIENT
   */
  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, hookRequestedAt: true, hookDeliveredAt: true },
    })
    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }

    const ordersCount = await this.prisma.order.count({ where: { userId } })
    const hasOrdered = ordersCount > 0

    return {
      hasOrdered,
      hookRequestedAt: user.hookRequestedAt,
      hookDeliveredAt: user.hookDeliveredAt,
      needsConsent: hasOrdered && user.hookRequestedAt == null,
    }
  }

  /**
   * Registra a confirmação do gancho pelo cliente (idempotente — só grava se
   * ainda não solicitado, preservando o hookRequestedAt original).
   *
   * @throws { statusCode: 404 } se o usuário não for CLIENT
   */
  async requestHook(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, hookRequestedAt: true },
    })
    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }

    if (user.hookRequestedAt) {
      return { hookRequestedAt: user.hookRequestedAt }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { hookRequestedAt: new Date() },
      select: { hookRequestedAt: true },
    })
    return { hookRequestedAt: updated.hookRequestedAt }
  }
}
