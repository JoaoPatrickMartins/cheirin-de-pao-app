import { FastifyInstance } from 'fastify'
import { CreateOrderBody } from './orders.schema.js'
import { isPastCutoffForDelivery, brtDateStr, brtNoonFromStr } from '../../lib/cutoff.js'

/**
 * Fuso horário do Brasil (UTC-3) para cálculo do "amanhã".
 * D-05 do CONTEXT.md: horário de corte hard-coded 21h.
 * A validação de "amanhã" usa UTC-3 para alinhar com o timezone dos clientes.
 */
const BRAZIL_OFFSET_HOURS = 3

/**
 * Retorna o intervalo de "hoje" em UTC-3 como par de datas UTC.
 *
 * Meia-noite BRT (UTC-3) equivale a 03:00 UTC.
 * Fim do dia BRT (23:59:59.999) equivale a 02:59:59.999 UTC do dia seguinte.
 */
function getTodayRange(): { start: Date; end: Date } {
  const nowUTC = Date.now()
  const nowBrazil = nowUTC - BRAZIL_OFFSET_HOURS * 60 * 60 * 1000
  const todayBrazil = new Date(nowBrazil)
  const year = todayBrazil.getUTCFullYear()
  const month = todayBrazil.getUTCMonth()
  const day = todayBrazil.getUTCDate()
  // Meia-noite BRT em UTC = 03:00 UTC do mesmo dia calendário
  const start = new Date(Date.UTC(year, month, day, BRAZIL_OFFSET_HOURS, 0, 0, 0))
  // 23:59:59.999 BRT em UTC = 02:59:59.999 UTC do dia seguinte
  const end = new Date(Date.UTC(year, month, day + 1, BRAZIL_OFFSET_HOURS - 1, 59, 59, 999))
  return { start, end }
}

/**
 * OrdersService — lógica de negócio de pedidos avulsos.
 *
 * Implementa reserva atômica de créditos via prisma.$transaction:
 * - T-04-03-01: userId vem do JWT (nunca do body)
 * - T-04-03-02: scheduledDate validado >= amanhã UTC-3
 * - T-04-03-04: $transaction garante consistência no MVP
 */
export class OrdersService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Cria um pedido avulso com reserva atômica de créditos.
   *
   * Fluxo:
   * 1. Valida scheduledDate >= amanhã (UTC-3)
   * 2. Dentro de $transaction:
   *    a. Busca usuário e verifica saldo
   *    b. Decrementa creditBalance
   *    c. Cria Order (type: SINGLE, status: SCHEDULED)
   *    d. Cria CreditTransaction (type: DELIVERY, quantity negativo)
   *
   * @throws { statusCode: 400, message: 'Data inválida' } se data no passado
   * @throws { statusCode: 400, message: 'Créditos insuficientes' } se saldo < quantity
   */
  async createSingleOrder(userId: string, data: CreateOrderBody) {
    // T-04-03-02: Rejeita datas no passado ou hoje — compara "YYYY-MM-DD" ao amanhã BRT
    // (comparação por string evita off-by-one de fuso que rejeitava o próprio "amanhã").
    const dateStr = data.scheduledDate.slice(0, 10)
    const tomorrowStr = brtDateStr(new Date(), 1)
    if (dateStr < tomorrowStr) {
      throw { statusCode: 400, message: 'Data inválida' }
    }
    // Armazena ao meio-dia BRT do dia escolhido (cai na janela correta de hoje/histórico)
    const scheduledDate = brtNoonFromStr(dateStr)

    // Enforçar horário de corte por slot: a data só é aceita enquanto houver ao menos
    // um slot do condomínio ainda aberto para entrega naquela data (corte não passou).
    const ownerCondo = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { condominiumId: true },
    })
    if (ownerCondo?.condominiumId) {
      const condo = await this.prisma.condominium.findUnique({
        where: { id: ownerCondo.condominiumId },
        select: { deliverySlots: true },
      })
      const activeSlots = (condo?.deliverySlots ?? []).filter((s) => s.isActive)
      if (activeSlots.length > 0) {
        const stillOpen = activeSlots.some(
          (s) => !isPastCutoffForDelivery(s.time, s.cutoffTime, data.scheduledDate),
        )
        if (!stillOpen) {
          throw { statusCode: 400, message: 'Prazo de pedido encerrado para esta data' }
        }
      }
    }

    // T-04-03-04: Reserva atômica — verifica saldo, debita e cria Order/CreditTransaction
    // Descrição amigável para o extrato (sem ID interno): "Pedido avulso · N pães · DD/MM"
    const paesLabel = data.quantity === 1 ? '1 pão' : `${data.quantity} pães`
    const [, mesStr, diaStr] = dateStr.split('-')
    const avulsoDesc = `Pedido avulso · ${paesLabel} · ${diaStr}/${mesStr}`

    const order = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } })

      if (!user || user.creditBalance < data.quantity) {
        throw { statusCode: 400, message: 'Créditos insuficientes' }
      }

      // Debitar créditos
      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { decrement: data.quantity } },
      })

      // Criar Order (type SINGLE, status SCHEDULED)
      const newOrder = await tx.order.create({
        data: {
          userId,
          type: 'SINGLE',
          status: 'SCHEDULED',
          quantity: data.quantity,
          scheduledDate,
        },
      })

      // Registrar movimentação de créditos (negativo = débito)
      await tx.creditTransaction.create({
        data: {
          userId,
          type: 'DELIVERY',
          quantity: -data.quantity,
          referenceId: newOrder.id,
          description: avulsoDesc,
        },
      })

      return newOrder
    })

    return order
  }

  /**
   * Retorna o pedido do dia atual para o usuário, considerando timezone BRT (UTC-3).
   *
   * T-05-05: userId vem do JWT — preHandler: [fastify.authenticate] na rota.
   * Retorna null se não houver pedido agendado para hoje (não CANCELLED).
   */
  async getTodayOrder(userId: string) {
    const { start, end } = getTodayRange()
    return this.prisma.order.findFirst({
      where: {
        userId,
        scheduledDate: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
    })
  }

  /**
   * Retorna a PRÓXIMA entrega futura do usuário (de amanhã em diante), considerando BRT.
   * Usado como fallback no card da Home quando não há entrega hoje.
   * Exclui CANCELLED/DELIVERED; ordena por data ascendente (a mais próxima primeiro).
   */
  async getNextOrder(userId: string) {
    const { end } = getTodayRange() // fim do dia BRT de hoje → gt = amanhã em diante
    return this.prisma.order.findFirst({
      where: {
        userId,
        scheduledDate: { gt: end },
        status: { in: ['SCHEDULED', 'OUT_FOR_DELIVERY'] },
      },
      orderBy: { scheduledDate: 'asc' },
    })
  }

  /**
   * Retorna o histórico de pedidos dos últimos N dias para o usuário.
   *
   * T-05-05: userId vem do JWT — preHandler: [fastify.authenticate] na rota.
   * Exclui pedidos CANCELLED; ordenados por scheduledDate desc.
   *
   * @param userId  ID do usuário autenticado
   * @param days    Número de dias para trás (default: 30)
   */
  async getOrderHistory(userId: string, days: number = 30) {
    const since = new Date()
    since.setDate(since.getDate() - days)
    return this.prisma.order.findMany({
      where: {
        userId,
        scheduledDate: { gte: since },
        status: { not: 'CANCELLED' },
      },
      orderBy: { scheduledDate: 'desc' },
    })
  }
}
