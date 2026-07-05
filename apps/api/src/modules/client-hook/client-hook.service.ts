import { FastifyInstance } from 'fastify'
import { NotificationType } from '@prisma/client'
import { NotificationsService } from '../notifications/notifications.service.js'

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
      select: { role: true, hookRequestedAt: true, name: true, apartment: true, block: true },
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

    // Aviso ao admin — só na transição (não solicitado → solicitado). Best-effort.
    try {
      const loc = [user.block, user.apartment].filter(Boolean).join(' ')
      await new NotificationsService(this.fastify).notifyAdmins({
        type: NotificationType.ADMIN_HOOK_REQUESTED,
        title: 'Solicitação de gancho',
        body: `${user.name ?? 'Cliente'}${loc ? ` · Apto ${loc}` : ''} confirmou o recebimento do gancho.`,
        actionRoute: '/admin',
      })
    } catch (err) {
      this.fastify.log.warn({ err }, '[client-hook] falha ao notificar admin — ignorado')
    }

    return { hookRequestedAt: updated.hookRequestedAt }
  }
}
