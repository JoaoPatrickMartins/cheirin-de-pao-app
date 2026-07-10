import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { Prisma, TransactionType, NotificationType } from '@prisma/client'
import { NotificationsService } from '../notifications/notifications.service.js'

/** Parâmetros de listagem de clientes (busca, filtro, ordenação, paginação). */
export interface ListClientsParams {
  q?: string
  condominiumId?: string
  status?: 'all' | 'blocked' | 'active' | 'no-credits'
  sort?: 'name' | 'credits' | 'lastPurchase' | 'recent'
  page?: number
  limit?: number
}

/** Campos editáveis do cadastro do cliente pelo admin. */
export interface UpdateClientPayload {
  name?: string
  phone?: string
  email?: string
  cpf?: string
  birthDate?: string
  condominiumId?: string
  apartment?: string
  block?: string
}

/**
 * Soma de pãezinhos por semana a partir da agenda ativa.
 * Suporta tanto o formato multi-slot (days = { slotId: { dia: qtd } }) quanto
 * o legado (weeklyQty = { dia: qtd }).
 */
function sumScheduleWeekly(schedule: {
  isActive?: boolean
  days?: unknown
  weeklyQty?: unknown
} | null): number {
  if (!schedule || schedule.isActive === false) return 0
  const days = schedule.days as Record<string, Record<string, number>> | null | undefined
  if (days && Object.keys(days).length > 0) {
    let total = 0
    for (const wq of Object.values(days)) {
      for (const q of Object.values(wq ?? {})) total += Number(q) || 0
    }
    return total
  }
  const weeklyQty = schedule.weeklyQty as Record<string, number> | null | undefined
  if (weeklyQty) {
    return Object.values(weeklyQty).reduce((acc, q) => acc + (Number(q) || 0), 0)
  }
  return 0
}

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
   * Lista clientes com busca, filtro de status, ordenação e paginação.
   *
   * Busca (q): casa nome/e-mail (case-insensitive) e CPF/telefone (por dígitos).
   * Filtros: condominiumId + status (all | blocked | active | no-credits).
   * Ordenação: name | credits | recent (createdAt) no banco; lastPurchase em memória.
   * lastPurchaseAt vem do último CreditTransaction PURCHASE — resolvido em UMA
   * query agregada (in: ids), eliminando o N+1 anterior (1 query por cliente).
   *
   * Retorna { items, total, page, limit }. A paginação é aplicada em memória
   * (escala adequada ao volume atual; mover para skip/take + lastPurchaseAt
   * denormalizado quando a base crescer).
   */
  async list(params: ListClientsParams = {}) {
    const { q, condominiumId, status = 'all', sort = 'name', page = 1, limit = 20 } = params

    const where: Prisma.UserWhereInput = { role: 'CLIENT' }
    if (condominiumId) where.condominiumId = condominiumId
    if (status === 'blocked') where.isBlocked = true
    else if (status === 'active') where.isBlocked = false
    else if (status === 'no-credits') where.creditBalance = { lte: 0 }

    const term = q?.trim()
    if (term) {
      const digits = term.replace(/\D/g, '')
      const or: Prisma.UserWhereInput[] = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term } },
      ]
      if (digits) {
        or.push({ cpf: { contains: digits } })
        or.push({ phone: { contains: digits } })
      }
      where.OR = or
    }

    const orderBy: Prisma.UserOrderByWithRelationInput =
      sort === 'credits'
        ? { creditBalance: 'desc' }
        : sort === 'recent'
          ? { createdAt: 'desc' }
          : { name: 'asc' }

    const clients = await this.prisma.user.findMany({
      where,
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
      orderBy,
    })

    // Resolve lastPurchaseAt em UMA query (elimina o N+1)
    const lastByUser = new Map<string, Date>()
    const ids = clients.map((c) => c.id)
    if (ids.length > 0) {
      const purchases = await this.prisma.creditTransaction.findMany({
        where: { userId: { in: ids }, type: 'PURCHASE' },
        select: { userId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
      for (const p of purchases) {
        if (!lastByUser.has(p.userId)) lastByUser.set(p.userId, p.createdAt)
      }
    }

    let withPurchase = clients.map((c) => ({
      ...c,
      lastPurchaseAt: lastByUser.get(c.id) ?? null,
    }))

    if (sort === 'lastPurchase') {
      withPurchase = withPurchase.sort((a, b) => {
        const ta = a.lastPurchaseAt ? a.lastPurchaseAt.getTime() : 0
        const tb = b.lastPurchaseAt ? b.lastPurchaseAt.getTime() : 0
        return tb - ta
      })
    }

    const total = withPurchase.length
    const start = (page - 1) * limit
    const items = withPurchase.slice(start, start + limit)

    return { items, total, page, limit }
  }

  /**
   * Busca detalhe de um cliente com agenda ativa, pedidos recentes (30 dias),
   * condomínio e métricas agregadas (total gasto, pães entregues, nº de pedidos,
   * pães/semana agendados). Somente leitura — para suporte e auditoria.
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

    const [schedule, recentOrders, condominium, paymentAgg, deliveredAgg, ordersCount] =
      await Promise.all([
        // Busca a agenda do cliente independente de isActive — para que agendas
        // pausadas continuem visíveis no detalhe (e o admin possa retomá-las).
        this.prisma.schedule.findFirst({ where: { userId: id } }),
        this.prisma.order.findMany({
          where: { userId: id, scheduledDate: { gte: since } },
          orderBy: { scheduledDate: 'desc' },
        }),
        user.condominiumId
          ? this.prisma.condominium.findUnique({
              where: { id: user.condominiumId },
              select: { id: true, name: true },
            })
          : Promise.resolve(null),
        this.prisma.payment.aggregate({
          where: { userId: id, status: 'PAID' },
          _sum: { amount: true },
          _count: true,
        }),
        this.prisma.order.aggregate({
          where: { userId: id, status: 'DELIVERED' },
          _sum: { quantity: true },
          _count: true,
        }),
        this.prisma.order.count({ where: { userId: id } }),
      ])

    const metrics = {
      totalSpent: paymentAgg._sum.amount ?? 0,
      paymentsCount: paymentAgg._count,
      breadsDelivered: deliveredAgg._sum.quantity ?? 0,
      deliveredOrders: deliveredAgg._count,
      ordersCount,
      weeklyBreads: sumScheduleWeekly(schedule),
    }

    // Nome do admin que bloqueou (contexto de auditoria do bloqueio atual)
    let blockedByName: string | null = null
    if (user.blockedById) {
      const admin = await this.prisma.user.findUnique({
        where: { id: user.blockedById },
        select: { name: true },
      })
      blockedByName = admin?.name ?? null
    }

    return {
      client: user,
      schedule,
      recentOrders,
      condominium,
      metrics,
      blockedByName,
    }
  }

  /**
   * Atualiza o cadastro do cliente (admin — controle total).
   * Normaliza telefone/CPF via Zod (no controller) antes de chegar aqui.
   *
   * @throws { statusCode: 404 } se user não encontrado ou não é CLIENT
   * @throws { statusCode: 409 } se phone/email/cpf colidir com outro usuário
   */
  async updateClient(id: string, payload: UpdateClientPayload) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }

    // Checa conflitos de unicidade (phone/email/cpf) com OUTROS usuários
    const uniqueChecks: { field: 'phone' | 'email' | 'cpf'; value: string }[] = []
    if (payload.phone !== undefined && payload.phone !== user.phone) uniqueChecks.push({ field: 'phone', value: payload.phone })
    if (payload.email !== undefined && payload.email !== user.email) uniqueChecks.push({ field: 'email', value: payload.email })
    if (payload.cpf !== undefined && payload.cpf !== user.cpf) uniqueChecks.push({ field: 'cpf', value: payload.cpf })

    for (const check of uniqueChecks) {
      const existing = await this.prisma.user.findFirst({
        where: { [check.field]: check.value, id: { not: id } },
        select: { id: true },
      })
      if (existing) {
        const labels = { phone: 'Telefone', email: 'E-mail', cpf: 'CPF' }
        throw { statusCode: 409, message: `${labels[check.field]} já cadastrado para outro cliente` }
      }
    }

    const data: Prisma.UserUpdateInput = {}
    if (payload.name !== undefined) data.name = payload.name
    if (payload.phone !== undefined) data.phone = payload.phone
    if (payload.email !== undefined) data.email = payload.email
    if (payload.cpf !== undefined) data.cpf = payload.cpf
    if (payload.birthDate !== undefined) data.birthDate = payload.birthDate ? new Date(payload.birthDate) : null
    if (payload.condominiumId !== undefined) data.condominiumId = payload.condominiumId
    if (payload.apartment !== undefined) data.apartment = payload.apartment
    if (payload.block !== undefined) data.block = payload.block

    return this.prisma.user.update({ where: { id }, data })
  }

  /** Garante que o id é de um CLIENT existente; senão lança 404. */
  private async assertClient(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }
  }

  /**
   * Extrato de créditos do cliente (CreditTransaction) — auditoria.
   * Resolve o nome do admin responsável em ADMIN_GRANT/REFUND (uma query batch).
   */
  async getCreditHistory(id: string, limit = 50) {
    await this.assertClient(id)

    const txs = await this.prisma.creditTransaction.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const adminIds = [...new Set(txs.map((t) => t.adminId).filter((v): v is string => !!v))]
    const adminMap = new Map<string, string>()
    if (adminIds.length > 0) {
      const admins = await this.prisma.user.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, name: true },
      })
      for (const a of admins) adminMap.set(a.id, a.name)
    }

    return txs.map((t) => ({
      id: t.id,
      type: t.type,
      quantity: t.quantity,
      description: t.description ?? null,
      reason: t.reason ?? null,
      referenceId: t.referenceId ?? null,
      adminName: t.adminId ? adminMap.get(t.adminId) ?? null : null,
      createdAt: t.createdAt,
    }))
  }

  /**
   * Pagamentos do cliente. Marca `refundable` (PAID + tem PaymentIntent Stripe)
   * para habilitar o estorno via POST /admin/payments/:id/refund.
   */
  async getPayments(id: string) {
    await this.assertClient(id)

    const payments = await this.prisma.payment.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    })

    const comboIds = [...new Set(payments.map((p) => p.comboId).filter((v): v is string => !!v))]
    const comboMap = new Map<string, { name: string; quantity: number }>()
    if (comboIds.length > 0) {
      const combos = await this.prisma.combo.findMany({
        where: { id: { in: comboIds } },
        select: { id: true, name: true, quantity: true },
      })
      for (const c of combos) comboMap.set(c.id, { name: c.name, quantity: c.quantity })
    }

    return payments.map((p) => {
      const combo = p.comboId ? comboMap.get(p.comboId) : null
      const quantity = combo ? combo.quantity : p.customQuantity ?? 0
      const label = combo ? combo.name : p.customQuantity != null ? 'Compra avulsa' : '—'
      return {
        id: p.id,
        amount: p.amount,
        method: p.method,
        status: p.status,
        label,
        quantity,
        refundable: p.status === 'PAID' && !!p.stripePaymentIntentId,
        createdAt: p.createdAt,
      }
    })
  }

  /**
   * Métodos de pagamento do cliente: cartões salvos (read-only) + configuração
   * de auto-recarga (com nome do combo, se houver).
   */
  async getPaymentMethods(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, autoRecharge: true },
    })
    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }

    const cards = await this.prisma.savedCard.findMany({
      where: { userId: id },
      orderBy: { isDefault: 'desc' },
    })

    const ar = (user.autoRecharge ?? null) as
      | { active?: boolean; mode?: string; weekday?: string; comboId?: string }
      | null
    let autoRecharge: { active: boolean; mode: string | null; weekday: string | null; comboName: string | null } | null =
      null
    if (ar) {
      let comboName: string | null = null
      if (ar.comboId) {
        const c = await this.prisma.combo.findUnique({ where: { id: ar.comboId }, select: { name: true } })
        comboName = c?.name ?? null
      }
      autoRecharge = { active: !!ar.active, mode: ar.mode ?? null, weekday: ar.weekday ?? null, comboName }
    }

    return {
      cards: cards.map((c) => ({
        id: c.id,
        brand: c.brand,
        lastFour: c.lastFour,
        expiresAt: c.expiresAt,
        isDefault: c.isDefault,
      })),
      autoRecharge,
    }
  }

  /**
   * Pedidos do cliente com dados de entrega (entregador, deliveredAt, confirmedAt).
   * Inclui pedidos CANCELLED. Para auditoria de entregas e cancelamentos.
   */
  async getOrders(id: string, limit = 50) {
    await this.assertClient(id)

    const orders = await this.prisma.order.findMany({
      where: { userId: id },
      orderBy: { scheduledDate: 'desc' },
      take: limit,
    })

    const orderIds = orders.map((o) => o.id)
    const courierIds = [...new Set(orders.map((o) => o.courierId).filter((v): v is string => !!v))]

    const [deliveries, couriers] = await Promise.all([
      orderIds.length > 0
        ? this.prisma.delivery.findMany({
            where: { orderId: { in: orderIds } },
            select: { orderId: true, deliveredAt: true, confirmedAt: true, status: true },
          })
        : Promise.resolve([]),
      courierIds.length > 0
        ? this.prisma.user.findMany({ where: { id: { in: courierIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ])

    const delByOrder = new Map(deliveries.map((d) => [d.orderId, d]))
    const courierName = new Map(couriers.map((c) => [c.id, c.name]))

    return orders.map((o) => {
      const d = delByOrder.get(o.id)
      return {
        id: o.id,
        type: o.type,
        quantity: o.quantity,
        status: o.status,
        scheduledDate: o.scheduledDate,
        slotId: o.slotId ?? null,
        deliveryTime: o.deliveryTime ?? null,
        courierName: o.courierId ? courierName.get(o.courierId) ?? null : null,
        deliveredAt: d?.deliveredAt ?? null,
        confirmedAt: d?.confirmedAt ?? null,
        deliveryStatus: d?.status ?? null,
      }
    })
  }

  /**
   * Cancela um pedido SCHEDULED do cliente. O crédito é debitado na criação do
   * pedido, então `refundCredits` controla se os créditos voltam ao cliente
   * (reversão atômica + CreditTransaction REFUND auditável).
   *
   * @throws 404 se cliente/pedido não encontrado; 422 se pedido não é SCHEDULED
   */
  async cancelOrder(clientId: string, orderId: string, refundCredits: boolean, adminId: string) {
    await this.assertClient(clientId)

    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order || order.userId !== clientId) {
      throw { statusCode: 404, message: 'Pedido não encontrado' }
    }
    if (order.status !== 'SCHEDULED') {
      throw { statusCode: 422, message: 'Apenas pedidos agendados podem ser cancelados' }
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } }),
    ]
    if (refundCredits) {
      ops.push(
        this.prisma.creditTransaction.create({
          data: {
            userId: clientId,
            type: TransactionType.REFUND,
            quantity: order.quantity,
            referenceId: orderId,
            description: `Cancelamento de pedido — ${order.quantity} crédito(s) devolvido(s)`,
            adminId,
          },
        }),
        this.prisma.user.update({
          where: { id: clientId },
          data: { creditBalance: { increment: order.quantity } },
        }),
      )
    }
    await this.prisma.$transaction(ops)

    const user = await this.prisma.user.findUnique({ where: { id: clientId }, select: { creditBalance: true } })
    return {
      id: orderId,
      status: 'CANCELLED',
      refundedCredits: refundCredits ? order.quantity : 0,
      creditBalance: user?.creditBalance ?? 0,
    }
  }

  /**
   * Ativa/pausa a agenda do cliente (isActive). Pausar interrompe a geração de
   * pedidos futuros (a projeção só considera agendas isActive=true); NÃO cancela
   * pedidos já criados.
   *
   * @throws 404 se cliente/agenda não encontrada
   */
  async setScheduleActive(clientId: string, isActive: boolean) {
    await this.assertClient(clientId)
    const schedule = await this.prisma.schedule.findFirst({ where: { userId: clientId } })
    if (!schedule) {
      throw { statusCode: 404, message: 'Agenda não encontrada' }
    }
    const updated = await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: { isActive },
    })
    return { id: updated.id, isActive: updated.isActive }
  }

  /** Sessões ativas do cliente (não revogadas e não expiradas). */
  async getSessions(clientId: string) {
    await this.assertClient(clientId)
    const sessions = await this.prisma.session.findMany({
      where: { userId: clientId, isRevoked: false, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, deviceId: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    })
    return sessions
  }

  /**
   * Revoga (força logout de) uma sessão do cliente.
   * @throws 404 se a sessão não existir ou não pertencer ao cliente
   */
  async revokeSession(clientId: string, sessionId: string) {
    await this.assertClient(clientId)
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } })
    if (!session || session.userId !== clientId) {
      throw { statusCode: 404, message: 'Sessão não encontrada' }
    }
    await this.prisma.session.update({ where: { id: sessionId }, data: { isRevoked: true } })
    return { id: sessionId, isRevoked: true }
  }

  /** Notas internas do admin sobre o cliente (mais recentes primeiro, com autor). */
  async getNotes(clientId: string) {
    await this.assertClient(clientId)
    const notes = await this.prisma.adminNote.findMany({
      where: { userId: clientId },
      orderBy: { createdAt: 'desc' },
    })
    const adminIds = [...new Set(notes.map((n) => n.adminId))]
    const adminMap = new Map<string, string>()
    if (adminIds.length > 0) {
      const admins = await this.prisma.user.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, name: true },
      })
      for (const a of admins) adminMap.set(a.id, a.name)
    }
    return notes.map((n) => ({
      id: n.id,
      body: n.body,
      adminName: adminMap.get(n.adminId) ?? null,
      createdAt: n.createdAt,
    }))
  }

  /** Cria uma nota interna sobre o cliente. */
  async addNote(clientId: string, body: string, adminId: string) {
    await this.assertClient(clientId)
    const note = await this.prisma.adminNote.create({
      data: { userId: clientId, adminId, body },
    })
    return { id: note.id, body: note.body, createdAt: note.createdAt }
  }

  /**
   * Exclui uma nota interna do cliente.
   * @throws 404 se a nota não existir ou não pertencer ao cliente
   */
  async deleteNote(clientId: string, noteId: string) {
    await this.assertClient(clientId)
    const note = await this.prisma.adminNote.findUnique({ where: { id: noteId } })
    if (!note || note.userId !== clientId) {
      throw { statusCode: 404, message: 'Nota não encontrada' }
    }
    await this.prisma.adminNote.delete({ where: { id: noteId } })
    return { id: noteId, deleted: true }
  }

  /**
   * Alterna isBlocked de um cliente.
   *
   * T-07-03-04: Verifica role=CLIENT — admin não pode bloquear ADMIN ou COURIER.
   *
   * @throws { statusCode: 404 } se user não encontrado ou não é CLIENT
   */
  async blockToggle(id: string, reason?: string, adminId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })

    if (!user || user.role !== 'CLIENT') {
      throw { statusCode: 404, message: 'Cliente não encontrado' }
    }

    const willBlock = !user.isBlocked
    return this.prisma.user.update({
      where: { id },
      data: willBlock
        ? { isBlocked: true, blockReason: reason ?? null, blockedAt: new Date(), blockedById: adminId ?? null }
        : { isBlocked: false, blockReason: null, blockedAt: null, blockedById: null },
      select: {
        id: true,
        isBlocked: true,
        blockReason: true,
        blockedAt: true,
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
