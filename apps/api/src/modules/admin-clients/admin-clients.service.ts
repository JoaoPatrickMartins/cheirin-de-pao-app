import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { TransactionType, NotificationType } from '@prisma/client'
import { NotificationsService } from '../notifications/notifications.service.js'

function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}

/**
 * AdminClientsService — lógica de negócio para gestão de clientes.
 *
 * T-07-03-04: blockToggle verifica role=CLIENT antes do toggle —
 *   admin não pode bloquear ADMIN ou COURIER via esse endpoint.
 * T-07-03-05: getDetail somente leitura — dados expostos apenas a ADMIN autenticado.
 * T-07-03-01: Role check ADMIN fica no controller.
 */
export class AdminClientsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Lista clientes com filtro opcional por condomínio.
   * Inclui lastPurchaseAt (último CreditTransaction PURCHASE).
   * Aceita N+1 no MVP para listas pequenas (conforme plano 07-03).
   */
  async list(condominiumId?: string) {
    const clients = await this.prisma.user.findMany({
      where: {
        role: 'CLIENT',
        ...(condominiumId ? { condominiumId } : {}),
      },
      select: {
        id: true,
        name: true,
        condominiumId: true,
        apartment: true,
        block: true,
        creditBalance: true,
        isBlocked: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })

    // N+1 aceitável no MVP para listas pequenas (documentado no plano)
    const clientsWithPurchase = await Promise.all(
      clients.map(async (client) => {
        const lastTx = await this.prisma.creditTransaction.findFirst({
          where: { userId: client.id, type: 'PURCHASE' },
          orderBy: { createdAt: 'desc' },
        })
        return {
          ...client,
          lastPurchaseAt: lastTx?.createdAt ?? null,
        }
      }),
    )

    return clientsWithPurchase
  }

  /**
   * Busca detalhe de um cliente com Schedule ativo e Orders dos últimos 30 dias.
   *
   * @throws { statusCode: 404 } se user não encontrado ou não é CLIENT
   */
  async getDetail(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })

    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }

    const since = new Date()
    since.setDate(since.getDate() - 30)

    const [schedule, recentOrders] = await Promise.all([
      this.prisma.schedule.findFirst({
        where: { userId: id, isActive: true },
      }),
      this.prisma.order.findMany({
        where: {
          userId: id,
          scheduledDate: { gte: since },
        },
        orderBy: { scheduledDate: 'desc' },
      }),
    ])

    return {
      client: user,
      schedule,
      recentOrders,
    }
  }

  /**
   * Alterna isBlocked de um cliente.
   *
   * T-07-03-04: Verifica role=CLIENT — admin não pode bloquear ADMIN ou COURIER.
   *
   * @throws { statusCode: 404 } se user não encontrado ou não é CLIENT
   */
  async blockToggle(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })

    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }

    return this.prisma.user.update({
      where: { id },
      data: { isBlocked: !user.isBlocked },
      select: {
        id: true,
        isBlocked: true,
      },
    })
  }

  /**
   * Concede créditos manualmente a um cliente.
   *
   * Fluxo:
   * 1. Valida quantity >= 1
   * 2. Verifica se cliente existe e tem role CLIENT
   * 3. Executa prisma.$transaction atômica (CreditTransaction.create + User.update increment)
   * 4. Dispara push OneSignal best-effort (falha ignorada)
   * 5. Persiste notificação in-app CREDIT_GRANTED obrigatoriamente (fora do try)
   * 6. Retorna updatedUser
   *
   * T-10-02-01: adminId extraído de fora (JWT), não do body.
   * T-10-02-02: quantity >= 1 validado aqui (dupla camada: Zod + service).
   * T-10-02-04: adminId e reason salvos no CreditTransaction para auditoria.
   * T-10-02-SC: push falha silenciosa — não bloqueia operação financeira.
   */
  async grantCredits(clientId: string, payload: { quantity: number; reason: string; adminId: string }) {
    const { quantity, reason, adminId } = payload

    // 1. Validar quantity >= 1
    if (quantity < 1) {
      throw { statusCode: 400, message: 'quantity deve ser >= 1' }
    }

    // 2. Verificar que o cliente existe e é CLIENT
    const user = await this.prisma.user.findUnique({ where: { id: clientId } })
    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }

    // 3. Transação atômica: CreditTransaction ADMIN_GRANT + User.creditBalance increment
    const [, updatedUser] = await this.prisma.$transaction([
      this.prisma.creditTransaction.create({
        data: { userId: clientId, type: TransactionType.ADMIN_GRANT, quantity, adminId, reason },
      }),
      this.prisma.user.update({
        where: { id: clientId },
        data: { creditBalance: { increment: quantity } },
      }),
    ])

    const total = updatedUser.creditBalance

    // 4. Push OneSignal — best-effort (falha silenciosa)
    if (user?.oneSignalPlayerId) {
      try {
        const osClient = createOsClient()
        const notification = new OneSignal.Notification()
        notification.app_id = process.env.ONESIGNAL_APP_ID!
        notification.include_subscription_ids = [user.oneSignalPlayerId]
        notification.headings = { pt: 'Pãezinhos chegando!' }
        notification.contents = { pt: `Você ganhou ${quantity} pão(es) de crédito. Novo saldo: ${total} pão(es).` }
        notification.data = { screen: 'home' }
        await osClient.createNotification(notification)
      } catch (pushErr) {
        this.fastify.log.warn({ err: pushErr }, '[admin-clients] falha ao enviar push — ignorado')
      }
    }

    // 5. Persistir notificação in-app obrigatoriamente — FORA do try do push (D-12, D-13)
    const notificationsService = new NotificationsService(this.fastify)
    await notificationsService.createAndTrim({
      userId: clientId,
      type: NotificationType.CREDIT_GRANTED,
      title: 'Pãezinhos chegando!',
      body: `Você ganhou ${quantity} pão(es) de crédito. Novo saldo: ${total} pão(es).`,
      actionRoute: '/client/home',
    })

    // 6. Retornar user atualizado
    return updatedUser
  }

  /**
   * Alias retroativo para blockToggle — compatibilidade com teste Wave 0.
   * blockClient sempre define isBlocked=true (bloquear).
   */
  async blockClient(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })

    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isBlocked: true },
      select: {
        id: true,
        isBlocked: true,
      },
    })
  }
}
