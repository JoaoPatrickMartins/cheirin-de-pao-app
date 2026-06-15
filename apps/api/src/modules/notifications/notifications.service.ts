import { FastifyInstance } from 'fastify'

/**
 * NotificationsService — gerencia notificações in-app e push token do OneSignal.
 *
 * T-04-03-05: userId vem do JWT (request.user.id) — nunca do body.
 * T-05-04: userId sempre de request.user!.id (JWT) — isolamento por usuário.
 * T-05-06: createAndTrim mantém máximo de 30 notificações por usuário (D-10).
 */
export class NotificationsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Salva o oneSignalPlayerId no User identificado por userId.
   *
   * Idempotente — se o playerId já for o mesmo valor, o update é no-op.
   *
   * @param userId  ID do usuário autenticado (extraído do JWT)
   * @param playerId  Subscription ID do OneSignal
   */
  async savePushToken(userId: string, playerId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { oneSignalPlayerId: playerId },
    })
  }

  /**
   * Retorna as últimas 30 notificações do usuário, ordenadas por createdAt desc.
   *
   * T-05-04: userId é sempre o argumento — nunca extraído de outro lugar.
   *
   * @param userId  ID do usuário autenticado (extraído do JWT no controller)
   */
  async getByUserId(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
  }

  /**
   * Marca todas as notificações isRead: false do usuário como lidas.
   *
   * T-05-04: userId é sempre o argumento — isolamento garantido.
   *
   * @param userId  ID do usuário autenticado (extraído do JWT no controller)
   */
  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })
  }

  /**
   * Cria uma nova notificação e realiza trim para manter máximo de 30 por usuário.
   *
   * T-05-06: deleteMany após create garante que o tamanho não cresce além de 30 (D-10).
   *
   * @param data  Dados da notificação a criar
   */
  async createAndTrim(data: {
    userId: string
    type: string
    title: string
    body: string
    actionRoute?: string
  }): Promise<void> {
    await this.prisma.notification.create({
      data: { ...data, isRead: false },
    })

    // Trim — D-10: máximo 30 notificações por usuário
    const all = await this.prisma.notification.findMany({
      where: { userId: data.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })

    if (all.length > 30) {
      const toDelete = all.slice(30).map((n: { id: string }) => n.id)
      await this.prisma.notification.deleteMany({ where: { id: { in: toDelete } } })
    }
  }

  /**
   * Retorna a contagem de notificações não lidas do usuário.
   *
   * T-05-04: userId é sempre o argumento — isolamento garantido.
   *
   * @param userId  ID do usuário autenticado (extraído do JWT no controller)
   */
  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    })
  }
}
