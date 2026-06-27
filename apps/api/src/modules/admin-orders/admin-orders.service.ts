import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { NotificationType, OrderStatus, Prisma } from '@prisma/client'
import { getGlobalDeliverySlots } from '../../lib/delivery-slots.js'
import { dayKeyOf, type DayKey, brtDateStr, brtNoonFromStr, brtDayRange } from '../../lib/cutoff.js'
import { projectScheduleForDate } from '../../lib/schedule-projection.js'

/**
 * Mapa de transições de estado válidas para pedidos.
 *
 * T-05-02: Qualquer transição fora deste mapa lança statusCode 422 antes do update.
 * Ciclo de vida v2 (corte → separação → entrega → desfecho):
 *   SCHEDULED        → SEPARATED | OUT_FOR_DELIVERY | CANCELLED
 *   SEPARATED        → OUT_FOR_DELIVERY | DELIVERED | NOT_DELIVERED | SCHEDULED (desfazer) | CANCELLED
 *   OUT_FOR_DELIVERY → DELIVERED | NOT_DELIVERED | CANCELLED
 *
 * Nota: SCHEDULED→OUT_FOR_DELIVERY e OUT_FOR_DELIVERY→DELIVERED são mantidos por
 * compatibilidade. O gate da Entrega passa a exigir SEPARATED (ver admin-separation).
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['SEPARATED', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  SEPARATED: ['OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED', 'SCHEDULED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'NOT_DELIVERED', 'CANCELLED'],
}

const DEFAULT_SLOT_LABELS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde' }
function fallbackSlotLabel(slotId: string): string {
  if (!slotId) return 'Sem horário'
  return DEFAULT_SLOT_LABELS[slotId] ?? slotId.charAt(0).toUpperCase() + slotId.slice(1)
}

/** Linha do ledger de pedidos (verificação geral + histórico + limbo). */
export interface LedgerRow {
  orderId: string
  userId: string
  clientName: string
  condominiumId: string
  condominiumName: string
  block: string
  apartment: string
  quantity: number
  slotId: string
  slotLabel: string
  type: string
  status: string
  scheduledDate: string
  courierId: string
  courierName: string
  separatedAt: string
  deliveredAt: string
  failedAt: string
  failureReason: string
  cancelReason: string
  refunded: boolean
}

/** Filtros do ledger de pedidos. */
export interface LedgerFilters {
  from?: string
  to?: string
  status?: string[]
  condominiumId?: string
  courierId?: string
  q?: string
  limit?: number
  skip?: number
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
   * Registra o marco de tempo correspondente (separatedAt/deliveredAt/failedAt/cancelledAt)
   * e o motivo (failureReason/cancelReason) quando aplicável — garante rastreabilidade
   * e evita pedidos "no limbo".
   *
   * @param reason motivo obrigatório do ponto de vista de negócio para NOT_DELIVERED/CANCELLED
   * @throws { statusCode: 404, message: 'Pedido não encontrado' } se order não existe
   * @throws { statusCode: 422, message: 'Transição inválida: ...' } se transição não permitida
   */
  async updateOrderStatus(orderId: string, newStatus: string, reason?: string): Promise<void> {
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

    const now = new Date()
    const data: Prisma.OrderUpdateInput = { status: newStatus as OrderStatus }
    switch (newStatus) {
      case 'SEPARATED':
        data.separatedAt = now
        break
      case 'DELIVERED':
        data.deliveredAt = now
        break
      case 'NOT_DELIVERED':
        data.failedAt = now
        data.failureReason = reason ?? null
        break
      case 'CANCELLED':
        data.cancelledAt = now
        data.cancelReason = reason ?? null
        break
      case 'SCHEDULED':
        // desfazer separação — limpa o marco
        data.separatedAt = null
        break
    }

    await this.prisma.order.update({ where: { id: orderId }, data })

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
      // Atribuicao direta por lista de IDs — gate: só pedidos separados ou já em rota
      const result = await this.prisma.order.updateMany({
        where: { id: { in: opts.orderIds }, status: { in: ['SEPARATED', 'OUT_FOR_DELIVERY'] } },
        data: { courierId },
      })
      return { count: result.count }
    }

    if (opts.condominiumId && opts.date) {
      // Atribuicao por condominiumId + date (query em 2 etapas)
      const date = new Date(opts.date)
      const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
      const endOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))

      // Etapa 1: buscar orders do condominio na data — gate: só separados ou já em rota
      const orders = await this.prisma.order.findMany({
        where: {
          condominiumId: opts.condominiumId,
          scheduledDate: { gte: startOfDay, lte: endOfDay },
          status: { in: ['SEPARATED', 'OUT_FOR_DELIVERY'] },
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
    stuckCount: number
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
      stuckCount,
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
      // pedidos "no limbo": data passada e ainda sem desfecho
      this.prisma.order.count({
        where: {
          scheduledDate: { lt: startOfDayBrt },
          status: { in: ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY'] },
        },
      }),
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
      stuckCount: stuckCount as number,
    }
  }

  /**
   * Retorna o status de entregas do dia agrupadas por condomínio.
   *
   * Gate da separação: busca Orders de hoje BRT já no estágio de entrega
   * (SEPARATED/OUT_FOR_DELIVERY/DELIVERED/NOT_DELIVERED), agrupa por condominiumId.
   * Para cada grupo: nome do condomínio, total no pipeline, total DELIVERED, orderIds.
   * orderIds é necessário para o frontend chamar assign-courier em batch (07-09).
   */
  /** Janela do dia BRT para a data informada (YYYY-MM-DD); default = hoje. */
  private resolveDayRange(dateStr?: string): { start: Date; end: Date } {
    const ds = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : brtDateStr(new Date(), 0)
    return brtDayRange(brtNoonFromStr(ds))
  }

  async getDeliveryStatus(slotId?: string, dateStr?: string): Promise<
    {
      condominiumId: string
      condominiumName: string
      scheduled: number
      delivered: number
      orderIds: string[]
    }[]
  > {
    const { start, end } = this.resolveDayRange(dateStr)

    const orders = await this.prisma.order.findMany({
      where: {
        scheduledDate: { gte: start, lte: end },
        // Gate da separação: a operação de entrega só enxerga pedidos já SEPARADOS (e além).
        // Pedidos SCHEDULED (ainda não separados) e CANCELLED ficam de fora.
        status: { in: ['SEPARATED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED'] },
        // Pipeline por turno: quando informado, filtra só o slot.
        ...(slotId ? { slotId } : {}),
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
   * Gate da separação: busca Orders de HOJE BRT com status=SEPARATED (já separados e
   * liberados para entrega), agrupadas por condominiumId. Pedidos ainda não separados
   * não entram na divisão.
   * Retorna: [{ courierId, courierName, condominiums: [...], total }]
   */
  async getDivisionSuggestion(slotId?: string, dateStr?: string): Promise<
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

    // Divisão opera sobre as entregas já separadas do dia/turno selecionado.
    // Pipeline por turno: quando informado o slotId, a divisão é só daquele turno
    // (entregador nunca recebe manhã+tarde misturados).
    const { start, end } = this.resolveDayRange(dateStr)

    const orders = await this.prisma.order.findMany({
      where: {
        scheduledDate: { gte: start, lte: end },
        // Gate da separação — só pedidos separados entram na divisão entre entregadores
        status: 'SEPARATED',
        ...(slotId ? { slotId } : {}),
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
   * _enrichOrders — enriquece pedidos com nome do cliente, condomínio, label do slot,
   * entregador e flag de estorno. Campos nulos viram '' (evita strip do response schema).
   */
  private async _enrichOrders(
    orders: Array<{
      id: string
      userId: string
      quantity: number
      slotId: string | null
      type: string
      status: string
      condominiumId: string | null
      courierId: string | null
      scheduledDate: Date
      separatedAt: Date | null
      deliveredAt: Date | null
      failedAt: Date | null
      failureReason: string | null
      cancelReason: string | null
    }>,
  ): Promise<LedgerRow[]> {
    if (orders.length === 0) return []

    const userIds = [...new Set(orders.map((o) => o.userId))]
    const condoIds = [...new Set(orders.map((o) => o.condominiumId).filter((c): c is string => !!c))]
    const courierIds = [...new Set(orders.map((o) => o.courierId).filter((c): c is string => !!c))]
    const orderIds = orders.map((o) => o.id)

    const [users, condos, couriers, refunds] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, apartment: true, block: true },
      }),
      this.prisma.condominium.findMany({
        where: { id: { in: condoIds } },
        select: { id: true, name: true, deliverySlots: true },
      }),
      courierIds.length
        ? this.prisma.user.findMany({ where: { id: { in: courierIds } }, select: { id: true, name: true } })
        : Promise.resolve([] as { id: string; name: string }[]),
      this.prisma.creditTransaction.findMany({
        where: { type: 'REFUND', referenceId: { in: orderIds } },
        select: { referenceId: true },
      }),
    ])

    const userById = new Map(users.map((u) => [u.id, u]))
    const condoById = new Map(condos.map((c) => [c.id, c]))
    const courierById = new Map(couriers.map((c) => [c.id, c]))
    const refundedSet = new Set(refunds.map((r) => r.referenceId).filter((id): id is string => !!id))

    const slotLabelFor = (condoId: string | null, slotId: string): string => {
      const condo = condoId ? condoById.get(condoId) : undefined
      const slot = condo?.deliverySlots?.find((s) => s.slotId === slotId || s.name === slotId)
      return slot?.label ?? fallbackSlotLabel(slotId)
    }

    return orders.map((o) => {
      const u = userById.get(o.userId)
      const slotId = o.slotId ?? ''
      return {
        orderId: o.id,
        userId: o.userId,
        clientName: u?.name ?? 'Cliente',
        condominiumId: o.condominiumId ?? '',
        condominiumName: (o.condominiumId && condoById.get(o.condominiumId)?.name) || '—',
        block: u?.block ?? '',
        apartment: u?.apartment ?? '',
        quantity: o.quantity,
        slotId,
        slotLabel: slotLabelFor(o.condominiumId, slotId),
        type: o.type,
        status: o.status,
        scheduledDate: o.scheduledDate.toISOString(),
        courierId: o.courierId ?? '',
        courierName: (o.courierId && courierById.get(o.courierId)?.name) || '',
        separatedAt: o.separatedAt ? o.separatedAt.toISOString() : '',
        deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : '',
        failedAt: o.failedAt ? o.failedAt.toISOString() : '',
        failureReason: o.failureReason ?? '',
        cancelReason: o.cancelReason ?? '',
        refunded: refundedSet.has(o.id),
      }
    })
  }

  /** Colunas selecionadas para montar uma LedgerRow. */
  private get _ledgerSelect() {
    return {
      id: true,
      userId: true,
      quantity: true,
      slotId: true,
      type: true,
      status: true,
      condominiumId: true,
      courierId: true,
      scheduledDate: true,
      separatedAt: true,
      deliveredAt: true,
      failedAt: true,
      failureReason: true,
      cancelReason: true,
    } as const
  }

  /**
   * getLedger — verificação geral de pedidos (futuros + histórico) com filtros.
   * Garante que nenhum pedido fique invisível: lista todos por data/status/condomínio/
   * entregador/busca, paginado.
   */
  async getLedger(filters: LedgerFilters): Promise<{ rows: LedgerRow[]; total: number; hasMore: boolean }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (filters.from || filters.to) {
      where.scheduledDate = {}
      if (filters.from) where.scheduledDate.gte = new Date(filters.from)
      if (filters.to) where.scheduledDate.lte = new Date(filters.to)
    }
    if (filters.status && filters.status.length > 0) where.status = { in: filters.status }
    if (filters.condominiumId) where.condominiumId = filters.condominiumId
    if (filters.courierId) where.courierId = filters.courierId

    if (filters.q && filters.q.trim()) {
      const q = filters.q.trim()
      const matched = await this.prisma.user.findMany({
        where: {
          OR: [{ name: { contains: q, mode: 'insensitive' } }, { apartment: { contains: q, mode: 'insensitive' } }],
        },
        select: { id: true },
      })
      const ids = matched.map((m) => m.id)
      if (ids.length === 0) return { rows: [], total: 0, hasMore: false }
      where.userId = { in: ids }
    }

    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
    const skip = Math.max(filters.skip ?? 0, 0)

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { scheduledDate: 'desc' },
        take: limit,
        skip,
        select: this._ledgerSelect,
      }),
      this.prisma.order.count({ where }),
    ])

    const rows = await this._enrichOrders(orders)
    return { rows, total, hasMore: skip + orders.length < total }
  }

  /**
   * getStuck — pedidos "no limbo": data de entrega já passou e ainda não tiveram
   * desfecho (não entregue, não cancelado). Base do alerta no Painel e do filtro Parados.
   */
  async getStuck(): Promise<{ rows: LedgerRow[]; count: number }> {
    const now = new Date()
    const nowBrtString = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const [day, month, year] = nowBrtString.split('/')
    const startOfTodayBrt = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 3, 0, 0, 0))

    const where = {
      scheduledDate: { lt: startOfTodayBrt },
      status: { in: ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY'] as OrderStatus[] },
    }

    const [orders, count] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { scheduledDate: 'asc' },
        take: 200,
        select: this._ledgerSelect,
      }),
      this.prisma.order.count({ where }),
    ])

    const rows = await this._enrichOrders(orders)
    return { rows, count }
  }

  /**
   * refundOrder — estorna os créditos de um pedido (atalho do detalhe do pedido).
   * Cria CreditTransaction REFUND + incrementa o saldo. Idempotente: bloqueia 2º estorno.
   */
  async refundOrder(orderId: string, adminId: string, reason?: string): Promise<{ id: string; refundedCredits: number; creditBalance: number }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) {
      throw { statusCode: 404, message: 'Pedido não encontrado' }
    }

    const existing = await this.prisma.creditTransaction.findFirst({
      where: { type: 'REFUND', referenceId: orderId },
      select: { id: true },
    })
    if (existing) {
      throw { statusCode: 409, message: 'Este pedido já foi estornado' }
    }

    await this.prisma.$transaction([
      this.prisma.creditTransaction.create({
        data: {
          userId: order.userId,
          type: 'REFUND',
          quantity: order.quantity,
          referenceId: orderId,
          description: `Estorno de pedido — ${order.quantity} crédito(s) devolvido(s)`,
          adminId,
          reason,
        },
      }),
      this.prisma.user.update({
        where: { id: order.userId },
        data: { creditBalance: { increment: order.quantity } },
      }),
    ])

    const user = await this.prisma.user.findUnique({ where: { id: order.userId }, select: { creditBalance: true } })
    return { id: orderId, refundedCredits: order.quantity, creditBalance: user?.creditBalance ?? 0 }
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
