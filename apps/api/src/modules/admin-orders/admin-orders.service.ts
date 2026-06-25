import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { NotificationType } from '@prisma/client'
import { getGlobalDeliverySlots } from '../../lib/delivery-slots.js'
import { dayKeyOf, type DayKey } from '../../lib/cutoff.js'
import { projectScheduleForDate } from '../../lib/schedule-projection.js'

/**
 * Mapa de transições de estado válidas para pedidos.
 *
 * T-05-02: Qualquer transição fora deste mapa lança statusCode 422 antes do update.
 * Transições permitidas:
 *   SCHEDULED → OUT_FOR_DELIVERY
 *   OUT_FOR_DELIVERY → DELIVERED
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
}

function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}

/**
 * AdminOrdersService — lógica de negócio para gestão de pedidos pelo Admin.
 *
 * Responsabilidades:
 * - Validar e executar transições de status (SCHEDULED → OUT_FOR_DELIVERY → DELIVERED)
 * - Disparar push OneSignal ao marcar DELIVERED (best-effort — D-06)
 * - Persistir Notification no banco com trim de 30 por usuário (D-10, T-05-03)
 *
 * Nota: createAndTrim é implementado internamente (sem depender do Plan 02)
 * para garantir independência dos planos Wave 1.
 */
export class AdminOrdersService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Atualiza o status de um pedido com validação de transição.
   *
   * @throws { statusCode: 404, message: 'Pedido não encontrado' } se order não existe
   * @throws { statusCode: 422, message: 'Transição inválida: ...' } se transição não permitida
   */
  async updateOrderStatus(orderId: string, newStatus: string): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })

    if (!order) {
      throw { statusCode: 404, message: 'Pedido não encontrado' }
    }

    const allowed = VALID_TRANSITIONS[order.status] ?? []
    if (!allowed.includes(newStatus)) {
      throw {
        statusCode: 422,
        message: `Transição inválida: ${order.status} → ${newStatus}`,
      }
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus as 'OUT_FOR_DELIVERY' | 'DELIVERED' },
    })

    if (newStatus === 'DELIVERED') {
      await this.notifyAndPersist(order)
    }
  }

  /**
   * Dispara push OneSignal (best-effort) e persiste Notification ao DELIVERED.
   *
   * D-06: Falha do push é silenciosa — não bloqueia o fluxo.
   * Persist é obrigatório e acontece fora do try do push.
   */
  private async notifyAndPersist(order: {
    id: string
    userId: string
    quantity: number
  }): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { oneSignalPlayerId: true },
    })

    // 1. Push best-effort (D-06)
    if (user?.oneSignalPlayerId) {
      try {
        const osClient = createOsClient()
        const notification = new OneSignal.Notification()
        notification.app_id = process.env.ONESIGNAL_APP_ID!
        notification.include_subscription_ids = [user.oneSignalPlayerId]
        notification.headings = { pt: 'Entrega realizada! 🎉' }
        notification.contents = {
          pt: `Seus ${order.quantity} pães foram entregues. Bom apetite!`,
        }
        notification.data = { screen: 'pedidos' }
        await osClient.createNotification(notification)
      } catch (pushErr) {
        this.fastify.log.warn(
          { orderId: order.id, userId: order.userId, err: pushErr },
          '[admin-orders] falha ao enviar push de entrega — ignorado',
        )
      }
    }

    // 2. Persist Notification obrigatório — fora do try do push
    await this.createAndTrim({
      userId: order.userId,
      type: 'DELIVERY_DONE',
      title: 'Entrega realizada',
      body: `Seus ${order.quantity} pães foram entregues. Bom apetite!`,
      actionRoute: '/client/pedidos',
    })
  }

  /**
   * Atribui um entregador a orders em batch.
   *
   * D-11/D-13: Atribuicao em batch via orderIds ou por condominiumId+date.
   * T-06-04: Role check ADMIN fica no controller.
   *
   * @param courierId ID do entregador a ser atribuido
   * @param opts orderIds (lista explicita) OU condominiumId+date (query em 2 etapas)
   */
  async assignCourier(
    courierId: string,
    opts: {
      orderIds?: string[]
      condominiumId?: string
      date?: string
    },
  ): Promise<{ count: number }> {
    if (opts.orderIds && opts.orderIds.length > 0) {
      // Atribuicao direta por lista de IDs
      const result = await this.prisma.order.updateMany({
        where: { id: { in: opts.orderIds } },
        data: { courierId },
      })
      return { count: result.count }
    }

    if (opts.condominiumId && opts.date) {
      // Atribuicao por condominiumId + date (query em 2 etapas)
      const date = new Date(opts.date)
      const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
      const endOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))

      // Etapa 1: buscar orders do condominio na data
      const orders = await this.prisma.order.findMany({
        where: {
          condominiumId: opts.condominiumId,
          scheduledDate: { gte: startOfDay, lte: endOfDay },
        },
        select: { id: true },
      })

      if (orders.length === 0) return { count: 0 }

      // Etapa 2: atualizar courierId nas orders encontradas
      const result = await this.prisma.order.updateMany({
        where: { id: { in: orders.map((o: { id: string }) => o.id) } },
        data: { courierId },
      })
      return { count: result.count }
    }

    throw { statusCode: 400, message: 'Informe orderIds ou condominiumId+date para atribuicao' }
  }

  /**
   * Retorna KPIs do painel admin para o dia atual (BRT).
   *
   * T-07-06-01: preHandler authenticate + role check ADMIN garantem que apenas admins acessam.
   * KPIs: breadsTodayCount, revenueToday, clientsCount, condominiumsCount, deliverySlots, revenueByType.
   */
  async getDashboard(): Promise<{
    breadsTodayCount: number
    breadsTodayProjected: number
    breadsTomorrowCount: number
    breadsTomorrowProjected: number
    breadsByWeekday: number[]
    revenueToday: number
    breadsTodayTrendPct: number
    revenueTrendPct: number
    clientsCount: number
    clientsNewCount: number
    condominiumsCount: number
    deliverySlots: Array<{ slotId: string; label: string; time: string; cutoffTime: string }>
    revenueByType: { combos: number; avulso: number }
  }> {
    // Calcular início e fim do dia em BRT (UTC-3)
    const now = new Date()
    const nowBrtString = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    // nowBrtString ex: "15/06/2026" → converter para Date UTC de início do dia
    const [day, month, year] = nowBrtString.split('/')
    const startOfDayBrt = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 3, 0, 0, 0)) // BRT = UTC-3, então início do dia BRT = 03:00 UTC
    const endOfDayBrt = new Date(startOfDayBrt.getTime() + 24 * 60 * 60 * 1000 - 1)
    // Janela de amanhã BRT (para o card "Pedido de amanhã")
    const startOfTomorrowBrt = new Date(startOfDayBrt.getTime() + 24 * 60 * 60 * 1000)
    const endOfTomorrowBrt = new Date(startOfTomorrowBrt.getTime() + 24 * 60 * 60 * 1000 - 1)
    // Janela de ontem BRT (para os deltas reais dos badges)
    const startOfYesterdayBrt = new Date(startOfDayBrt.getTime() - 24 * 60 * 60 * 1000)
    const endOfYesterdayBrt = new Date(startOfDayBrt.getTime() - 1)
    // Meio-dia BRT de hoje/amanhã (seguro p/ projeção da agenda — cai dentro do dia)
    const todayNoonBrt = new Date(startOfDayBrt.getTime() + 12 * 60 * 60 * 1000)
    const tomorrowNoonBrt = new Date(todayNoonBrt.getTime() + 24 * 60 * 60 * 1000)
    // Semana corrente (segunda→domingo) em BRT, para o gráfico "Fornadas por dia"
    const dow = startOfDayBrt.getUTCDay() // 0=Dom..6=Sáb (mesmo dia BRT às 03:00 UTC)
    const daysFromMonday = (dow + 6) % 7
    const weekStart = new Date(startOfDayBrt.getTime() - daysFromMonday * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
    // 7 dias atrás (para "novos clientes")
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
      orderAgg,
      orderTomorrowAgg,
      orderYesterdayAgg,
      paymentAgg,
      paymentYesterdayAgg,
      clientsCount,
      clientsNewCount,
      condominiumsCount,
      deliverySlotsConfig,
      comboPaidPayments,
      avulsoPaidPayments,
      weekOrders,
      projToday,
      projTomorrow,
    ] = await Promise.all([
      // breadsTodayCount
      this.prisma.order.aggregate({
        _sum: { quantity: true },
        where: { scheduledDate: { gte: startOfDayBrt, lte: endOfDayBrt }, status: { not: 'CANCELLED' } },
      }),
      // breadsTomorrowCount — base do card "Pedido de amanhã"
      this.prisma.order.aggregate({
        _sum: { quantity: true },
        where: { scheduledDate: { gte: startOfTomorrowBrt, lte: endOfTomorrowBrt }, status: { not: 'CANCELLED' } },
      }),
      // breads de ontem (delta do card "Pães hoje")
      this.prisma.order.aggregate({
        _sum: { quantity: true },
        where: { scheduledDate: { gte: startOfYesterdayBrt, lte: endOfYesterdayBrt }, status: { not: 'CANCELLED' } },
      }),
      // revenueToday
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID', createdAt: { gte: startOfDayBrt, lte: endOfDayBrt } },
      }),
      // revenue de ontem (delta do card "Receita do dia")
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID', createdAt: { gte: startOfYesterdayBrt, lte: endOfYesterdayBrt } },
      }),
      // clientsCount
      this.prisma.user.count({ where: { role: 'CLIENT', isBlocked: false } }),
      // clientsNewCount — novos clientes nos últimos 7 dias (delta do card "Clientes")
      this.prisma.user.count({ where: { role: 'CLIENT', createdAt: { gte: sevenDaysAgo } } }),
      // condominiumsCount
      this.prisma.condominium.count({ where: { isActive: true } }),
      // deliverySlots (config global — cutoffTime por slot)
      getGlobalDeliverySlots(this.prisma),
      // revenueByType — combos (comboId != null)
      this.prisma.payment.findMany({
        where: { status: 'PAID', createdAt: { gte: startOfDayBrt, lte: endOfDayBrt }, comboId: { not: null } },
        select: { amount: true },
      }),
      // revenueByType — avulso (customQuantity != null)
      // NB: usamos customQuantity em vez de `comboId: null` porque pagamentos avulsos
      // são criados SEM o campo comboId (unset no Mongo), e `comboId: null` no Prisma
      // não casa com campos ausentes — só com null explícito.
      this.prisma.payment.findMany({
        where: { status: 'PAID', createdAt: { gte: startOfDayBrt, lte: endOfDayBrt }, customQuantity: { not: null } },
        select: { amount: true },
      }),
      // pedidos da semana corrente (gráfico "Fornadas por dia")
      this.prisma.order.findMany({
        where: { scheduledDate: { gte: weekStart, lte: weekEnd }, status: { not: 'CANCELLED' } },
        select: { scheduledDate: true, quantity: true },
      }),
      // projeção da agenda (previstos não materializados) — hoje e amanhã
      projectScheduleForDate(this.prisma, todayNoonBrt),
      projectScheduleForDate(this.prisma, tomorrowNoonBrt),
    ])

    const combosRevenue = (comboPaidPayments as { amount: number }[]).reduce((s, p) => s + p.amount, 0)
    const avulsoRevenue = (avulsoPaidPayments as { amount: number }[]).reduce((s, p) => s + p.amount, 0)

    // Série por dia da semana (seg..dom) a partir dos pedidos materializados da semana
    const WEEKDAY_INDEX: Record<DayKey, number> = { seg: 0, ter: 1, qua: 2, qui: 3, sex: 4, sab: 5, dom: 6 }
    const breadsByWeekday = [0, 0, 0, 0, 0, 0, 0]
    for (const o of weekOrders as { scheduledDate: Date; quantity: number }[]) {
      breadsByWeekday[WEEKDAY_INDEX[dayKeyOf(o.scheduledDate)]] += o.quantity
    }

    const breadsToday = (orderAgg._sum?.quantity as number | null) ?? 0
    const breadsYesterday = (orderYesterdayAgg._sum?.quantity as number | null) ?? 0
    const revenueToday = (paymentAgg._sum?.amount as number | null) ?? 0
    const revenueYesterday = (paymentYesterdayAgg._sum?.amount as number | null) ?? 0
    const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0)

    return {
      breadsTodayCount: breadsToday,
      breadsTodayProjected: projToday.total,
      breadsTomorrowCount: (orderTomorrowAgg._sum?.quantity as number | null) ?? 0,
      breadsTomorrowProjected: projTomorrow.total,
      breadsByWeekday,
      revenueToday,
      breadsTodayTrendPct: pct(breadsToday, breadsYesterday),
      revenueTrendPct: pct(revenueToday, revenueYesterday),
      clientsCount,
      clientsNewCount,
      condominiumsCount,
      deliverySlots: deliverySlotsConfig
        .filter((s) => s.isActive)
        .map((s) => ({ slotId: s.slotId, label: s.label, time: s.time, cutoffTime: s.cutoffTime })),
      revenueByType: { combos: combosRevenue, avulso: avulsoRevenue },
    }
  }

  /**
   * Retorna o status de entregas do dia agrupadas por condomínio.
   *
   * Busca Orders com scheduledDate=hoje BRT (status != CANCELLED), agrupa por condominiumId.
   * Para cada grupo: nome do condomínio, total agendado, total DELIVERED, orderIds.
   * orderIds é necessário para o frontend chamar assign-courier em batch (07-09).
   */
  async getDeliveryStatus(): Promise<
    {
      condominiumId: string
      condominiumName: string
      scheduled: number
      delivered: number
      orderIds: string[]
    }[]
  > {
    const now = new Date()
    const nowBrtString = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const [day, month, year] = nowBrtString.split('/')
    const startOfDayBrt = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 3, 0, 0, 0))
    const endOfDayBrt = new Date(startOfDayBrt.getTime() + 24 * 60 * 60 * 1000 - 1)

    const orders = await this.prisma.order.findMany({
      where: {
        scheduledDate: { gte: startOfDayBrt, lte: endOfDayBrt },
        status: { not: 'CANCELLED' },
      },
      select: { id: true, condominiumId: true, status: true },
    })

    if (orders.length === 0) return []

    // Agrupar por condominiumId
    const grouped = new Map<string, { scheduled: number; delivered: number; orderIds: string[] }>()
    for (const order of orders as { id: string; condominiumId: string | null; status: string }[]) {
      const condoId = order.condominiumId ?? 'unknown'
      if (!grouped.has(condoId)) {
        grouped.set(condoId, { scheduled: 0, delivered: 0, orderIds: [] })
      }
      const group = grouped.get(condoId)!
      group.scheduled += 1
      if (order.status === 'DELIVERED') group.delivered += 1
      group.orderIds.push(order.id)
    }

    // Buscar nomes dos condomínios
    const condominiumIds = Array.from(grouped.keys()).filter((id) => id !== 'unknown')
    const condominiums = await this.prisma.condominium.findMany({
      where: { id: { in: condominiumIds } },
      select: { id: true, name: true },
    })
    const condominiumNameMap = new Map<string, string>(
      (condominiums as { id: string; name: string }[]).map((c) => [c.id, c.name]),
    )

    return Array.from(grouped.entries()).map(([condominiumId, data]) => ({
      condominiumId,
      condominiumName: condominiumNameMap.get(condominiumId) ?? condominiumId,
      scheduled: data.scheduled,
      delivered: data.delivered,
      orderIds: data.orderIds,
    }))
  }

  /**
   * Gera sugestão de divisão de entregas entre entregadores ativos.
   *
   * Algoritmo greedy (D-10): ordena condomínios por quantity desc, aloca cada um
   * ao entregador com menor total acumulado no momento (balanceamento hibrido).
   *
   * Busca Orders de amanhã BRT (nao CANCELLED) agrupadas por condominiumId.
   * Retorna: [{ courierId, courierName, condominiums: [...], total }]
   */
  async getDivisionSuggestion(): Promise<
    {
      courierId: string
      courierName: string
      condominiums: { condominiumId: string; condominiumName: string; quantity: number }[]
      total: number
    }[]
  > {
    // Buscar entregadores ativos
    const couriers = await this.prisma.user.findMany({
      where: { role: 'COURIER', isBlocked: false },
      select: { id: true, name: true },
    })

    if ((couriers as { id: string; name: string }[]).length === 0) return []

    // Calcular amanhã em BRT
    const now = new Date()
    const nowBrtString = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const [day, month, year] = nowBrtString.split('/')
    const startOfTodayBrt = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 3, 0, 0, 0))
    const startOfTomorrowBrt = new Date(startOfTodayBrt.getTime() + 24 * 60 * 60 * 1000)
    const endOfTomorrowBrt = new Date(startOfTomorrowBrt.getTime() + 24 * 60 * 60 * 1000 - 1)

    const orders = await this.prisma.order.findMany({
      where: {
        scheduledDate: { gte: startOfTomorrowBrt, lte: endOfTomorrowBrt },
        status: { not: 'CANCELLED' },
      },
      select: { condominiumId: true, quantity: true },
    })

    if ((orders as { condominiumId: string | null; quantity: number }[]).length === 0) return []

    // Agrupar por condominiumId e somar quantity
    const condoMap = new Map<string, number>()
    for (const order of orders as { condominiumId: string | null; quantity: number }[]) {
      const condoId = order.condominiumId ?? 'unknown'
      condoMap.set(condoId, (condoMap.get(condoId) ?? 0) + order.quantity)
    }

    // Buscar nomes dos condomínios
    const condominiumIds = Array.from(condoMap.keys()).filter((id) => id !== 'unknown')
    const condominiums = await this.prisma.condominium.findMany({
      where: { id: { in: condominiumIds } },
      select: { id: true, name: true },
    })
    const condominiumNameMap = new Map<string, string>(
      (condominiums as { id: string; name: string }[]).map((c) => [c.id, c.name]),
    )

    // Ordenar condomínios por quantity desc
    const sortedCondos = Array.from(condoMap.entries())
      .map(([condominiumId, quantity]) => ({
        condominiumId,
        condominiumName: condominiumNameMap.get(condominiumId) ?? condominiumId,
        quantity,
      }))
      .sort((a, b) => b.quantity - a.quantity)

    // Algoritmo greedy: inicializar contadores por entregador
    const courierList = (couriers as { id: string; name: string }[]).map((c) => ({
      courierId: c.id,
      courierName: c.name,
      condominiums: [] as { condominiumId: string; condominiumName: string; quantity: number }[],
      total: 0,
    }))

    for (const condo of sortedCondos) {
      // Encontrar entregador com menor total
      let minIdx = 0
      for (let i = 1; i < courierList.length; i++) {
        if (courierList[i].total < courierList[minIdx].total) minIdx = i
      }
      courierList[minIdx].condominiums.push(condo)
      courierList[minIdx].total += condo.quantity
    }

    // Retornar todos os entregadores ativos — inclusive os sem condomínio sugerido.
    // A sugestão greedy acima já balanceia a carga; manter os entregadores vazios
    // permite que o admin reatribua condomínios manualmente (drag-and-drop no front).
    return courierList
  }

  /**
   * Cria uma Notification e aplica trim de 30 por usuário.
   *
   * T-05-03: Máximo 30 notificações por userId — deleteMany com ids da fatia [30:].
   */
  async createAndTrim(data: {
    userId: string
    type: NotificationType
    title: string
    body: string
    actionRoute?: string
  }): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        actionRoute: data.actionRoute,
        isRead: false,
      },
    })

    // Trim — D-10: máximo 30 notificações por usuário
    const all = await this.prisma.notification.findMany({
      where: { userId: data.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })

    if (all.length > 30) {
      const toDelete = all.slice(30).map((n: { id: string }) => n.id)
      await this.prisma.notification.deleteMany({
        where: { id: { in: toDelete } },
      })
    }
  }
}
