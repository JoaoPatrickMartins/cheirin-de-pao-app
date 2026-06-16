import { FastifyInstance } from 'fastify'

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
