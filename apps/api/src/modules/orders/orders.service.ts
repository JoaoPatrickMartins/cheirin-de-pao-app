import { FastifyInstance } from 'fastify'
import { NotificationType } from '@prisma/client'
import { CreateOrderBody } from './orders.schema.js'
import { isPastCutoffForDelivery, brtDateStr, brtNoonFromStr } from '../../lib/cutoff.js'
import { NotificationsService } from '../notifications/notifications.service.js'

/** Rótulo curto do cliente para avisos ao admin: "Nome · Apto 12B". */
function clientLabel(u: { name?: string | null; apartment?: string | null; block?: string | null }): string {
  const loc = [u.block, u.apartment].filter(Boolean).join(' ')
  return [u.name ?? 'Cliente', loc ? `Apto ${loc}` : null].filter(Boolean).join(' · ')
}

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
    // Nunca aceita datas no passado. "Hoje" é permitido, mas só se o corte do slot
    // escolhido ainda não passou (validação adiante). Sem slots para validar o corte,
    // o piso permanece "amanhã".
    const dateStr = data.scheduledDate.slice(0, 10)
    const todayStr = brtDateStr(new Date(), 0)
    const tomorrowStr = brtDateStr(new Date(), 1)
    if (dateStr < todayStr) {
      throw { statusCode: 400, message: 'Data inválida' }
    }
    // Armazena ao meio-dia BRT do dia escolhido (cai na janela correta de hoje/histórico)
    const scheduledDate = brtNoonFromStr(dateStr)

    // Enforçar horário de corte por slot. Quando um slot é escolhido (deliveryTime),
    // valida o corte DAQUELE slot para a data; senão (legado) aceita se houver ao menos
    // um slot ainda aberto. O slot resolvido é gravado em Order.deliveryTime.
    let deliveryTime: string | undefined = data.deliveryTime
    let slotId: string | undefined
    const ownerCondo = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { condominiumId: true },
    })
    const condo = ownerCondo?.condominiumId
      ? await this.prisma.condominium.findUnique({
          where: { id: ownerCondo.condominiumId },
          select: { deliverySlots: true },
        })
      : null
    const activeSlots = (condo?.deliverySlots ?? []).filter((s) => s.isActive)

    if (activeSlots.length > 0) {
      if (data.deliveryTime) {
        const slot = activeSlots.find((s) => s.time === data.deliveryTime)
        if (!slot) {
          throw { statusCode: 400, message: 'Horário de entrega indisponível' }
        }
        if (isPastCutoffForDelivery(slot.time, slot.cutoffTime, data.scheduledDate)) {
          throw { statusCode: 400, message: 'Prazo de pedido encerrado para este horário' }
        }
        deliveryTime = slot.time
        slotId = slot.slotId ?? slot.name
      } else {
        const stillOpen = activeSlots.some(
          (s) => !isPastCutoffForDelivery(s.time, s.cutoffTime, data.scheduledDate),
        )
        if (!stillOpen) {
          throw { statusCode: 400, message: 'Prazo de pedido encerrado para esta data' }
        }
      }
    } else if (dateStr < tomorrowStr) {
      // Sem slots para validar o corte → não permite "hoje".
      throw { statusCode: 400, message: 'Data inválida' }
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
      // condominiumId herdado do usuário — necessário para o agrupamento por
      // condomínio no painel admin (delivery-status / divisão de entregas).
      const newOrder = await tx.order.create({
        data: {
          userId,
          type: 'SINGLE',
          status: 'SCHEDULED',
          quantity: data.quantity,
          scheduledDate,
          ...(deliveryTime ? { deliveryTime } : {}),
          ...(slotId ? { slotId } : {}),
          ...(data.paymentId ? { paymentId: data.paymentId } : {}),
          ...(user.condominiumId ? { condominiumId: user.condominiumId } : {}),
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

    // Aviso ao admin — novo pedido de cliente (best-effort, nunca quebra o fluxo).
    try {
      const client = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, apartment: true, block: true },
      })
      await new NotificationsService(this.fastify).notifyAdmins({
        type: NotificationType.ADMIN_ORDER_PLACED,
        title: 'Novo pedido',
        body: `${clientLabel(client ?? {})} · ${paesLabel} · ${diaStr}/${mesStr}`,
        actionRoute: '/admin',
      })
    } catch (err) {
      this.fastify.log.warn({ err }, '[orders] falha ao notificar admin (pedido) — ignorado')
    }

    return order
  }

  /**
   * Cancela um pedido único (avulso) do próprio cliente, devolvendo os pães ao saldo.
   *
   * Só é permitido enquanto o horário de corte DAQUELE pedido não passou. Depois do corte
   * o pedido entra em separação/rota e o cancelamento deixa de ser possível.
   *
   * Validações (autoritativas — o frontend replica a checagem de corte só por UX):
   * 1. Pedido inexistente ou de outro usuário → 404 (não revela pedido alheio)
   * 2. type !== SINGLE → 422 (agendamentos recorrentes são geridos pela agenda)
   * 3. status !== SCHEDULED → 422 (já separado/entregue/cancelado)
   * 4. Corte do slot já passou → 422 com code CUTOFF_PASSED
   *
   * Efeito atômico: marca CANCELLED + devolve a quantidade ao creditBalance via
   * CreditTransaction REFUND. Idempotente por referenceId (2ª chamada não credita de novo).
   *
   * @throws { statusCode: 404 } pedido não encontrado
   * @throws { statusCode: 422, code?: 'CUTOFF_PASSED' } pedido não cancelável
   */
  async cancelSingleOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order || order.userId !== userId) {
      throw { statusCode: 404, message: 'Pedido não encontrado' }
    }
    if (order.type !== 'SINGLE') {
      throw { statusCode: 422, message: 'Apenas pedidos únicos podem ser cancelados por aqui' }
    }
    if (order.status !== 'SCHEDULED') {
      throw { statusCode: 422, message: 'Este pedido não pode mais ser cancelado' }
    }

    // Gate de corte: resolve o slot do pedido no condomínio do usuário e verifica se o corte
    // que governa a data de entrega já passou. Espelha a leitura de createSingleOrder.
    const deliveryDateStr = brtDateStr(order.scheduledDate)
    const ownerCondo = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { condominiumId: true },
    })
    const condo = ownerCondo?.condominiumId
      ? await this.prisma.condominium.findUnique({
          where: { id: ownerCondo.condominiumId },
          select: { deliverySlots: true },
        })
      : null
    const slots = condo?.deliverySlots ?? []
    // Casa por slotId (identificador estável); fallback pelo horário snapshot (deliveryTime).
    const slot =
      (order.slotId ? slots.find((s) => (s.slotId ?? s.name) === order.slotId) : undefined) ??
      (order.deliveryTime ? slots.find((s) => s.time === order.deliveryTime) : undefined)

    const cutoffPassed = slot
      ? isPastCutoffForDelivery(slot.time, slot.cutoffTime, deliveryDateStr)
      : // Fallback (pedido legado sem slot resolvível): permite só antes do dia da entrega.
        Date.now() >= order.scheduledDate.getTime()
    if (cutoffPassed) {
      throw {
        statusCode: 422,
        code: 'CUTOFF_PASSED',
        message: 'O horário de corte deste pedido já passou; o cancelamento não está mais disponível.',
      }
    }

    // Estorno idempotente por referenceId — evita duplo crédito se a rota for chamada 2×.
    const existingRefund = await this.prisma.creditTransaction.findFirst({
      where: { type: 'REFUND', referenceId: orderId },
    })

    const paesLabel = order.quantity === 1 ? '1 pão' : `${order.quantity} pães`
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: 'Cancelado pelo cliente',
        },
      })
      if (!existingRefund) {
        await tx.creditTransaction.create({
          data: {
            userId,
            type: 'REFUND',
            quantity: order.quantity,
            referenceId: orderId,
            description: `Cancelamento de pedido — ${paesLabel} devolvido(s)`,
          },
        })
        await tx.user.update({
          where: { id: userId },
          data: { creditBalance: { increment: order.quantity } },
        })
      }
    })

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true, name: true, apartment: true, block: true },
    })

    // Aviso ao admin — pedido cancelado pelo cliente (best-effort).
    try {
      const [, mesStr, diaStr] = deliveryDateStr.split('-')
      await new NotificationsService(this.fastify).notifyAdmins({
        type: NotificationType.ADMIN_ORDER_CANCELLED,
        title: 'Pedido cancelado',
        body: `${clientLabel(user ?? {})} · ${paesLabel} · ${diaStr}/${mesStr}`,
        actionRoute: '/admin',
      })
    } catch (err) {
      this.fastify.log.warn({ err }, '[orders] falha ao notificar admin (cancelamento) — ignorado')
    }

    return {
      id: orderId,
      status: 'CANCELLED' as const,
      refundedCredits: existingRefund ? 0 : order.quantity,
      creditBalance: user?.creditBalance ?? 0,
    }
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
   * Inclui pedidos CANCELLED (exibidos com o pill "Cancelado"); ordenados por scheduledDate desc.
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
      },
      orderBy: { scheduledDate: 'desc' },
    })
  }
}
