import { FastifyInstance } from 'fastify'
import { CreateOrderBody } from './orders.schema.js'

/**
 * Fuso horário do Brasil (UTC-3) para cálculo do "amanhã".
 * D-05 do CONTEXT.md: horário de corte hard-coded 21h.
 * A validação de "amanhã" usa UTC-3 para alinhar com o timezone dos clientes.
 */
const BRAZIL_OFFSET_HOURS = 3

/** Retorna a data de "amanhã" em UTC-3 (meia-noite local) */
function getTomorrowUTC3(): Date {
  const nowUTC = Date.now()
  // Ajusta para UTC-3
  const nowBrazil = nowUTC - BRAZIL_OFFSET_HOURS * 60 * 60 * 1000
  const todayBrazil = new Date(nowBrazil)
  // Extrai data local (Y, M, D)
  const year = todayBrazil.getUTCFullYear()
  const month = todayBrazil.getUTCMonth()
  const day = todayBrazil.getUTCDate()
  // Meia-noite de amanhã em UTC-3 = meia-noite do próximo dia UTC-3
  // Convertido de volta para UTC: meia-noite UTC-3 = 03:00 UTC
  return new Date(Date.UTC(year, month, day + 1, BRAZIL_OFFSET_HOURS, 0, 0, 0))
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
    const scheduledDate = new Date(data.scheduledDate)
    const tomorrow = getTomorrowUTC3()

    // T-04-03-02: Rejeita datas no passado ou hoje
    if (scheduledDate < tomorrow) {
      throw { statusCode: 400, message: 'Data inválida' }
    }

    // T-04-03-04: Reserva atômica — verifica saldo, debita e cria Order/CreditTransaction
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
          description: `Pedido avulso #${newOrder.id}`,
        },
      })

      return newOrder
    })

    return order
  }
}
