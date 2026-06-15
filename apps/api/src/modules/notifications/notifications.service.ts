import { FastifyInstance } from 'fastify'

/**
 * NotificationsService — salva o player_id do OneSignal no User autenticado.
 *
 * T-04-03-05: userId vem do JWT (request.user.id) — nunca do body.
 * O endpoint é idempotente: salvar o mesmo playerId novamente não causa erro.
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
}
