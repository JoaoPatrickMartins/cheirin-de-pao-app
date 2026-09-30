import { FastifyInstance } from 'fastify'
import { PaymentStatus, PaymentPurpose } from '@prisma/client'
import { toMilli } from '@cheirin-de-pao/shared'
import { withWriteConflictRetry } from '../../lib/tx-retry.js'

export class PaymentsRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  createPayment(data: {
    userId: string
    amount: number
    method: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'
    status: PaymentStatus
    mercadoPagoId?: string
    stripePaymentIntentId?: string
    comboId?: string
    customQuantity?: number
    purpose?: PaymentPurpose
  }) {
    return this.prisma.payment.create({ data })
  }

  findPaymentById(id: string) {
    return this.prisma.payment.findUnique({ where: { id } })
  }

  updatePaymentStatus(id: string, status: PaymentStatus) {
    return this.prisma.payment.update({ where: { id }, data: { status } })
  }

  findPaymentByMercadoPagoId(mpId: string) {
    return this.prisma.payment.findFirst({ where: { mercadoPagoId: mpId } })
  }

  findPaymentByStripePaymentIntentId(stripePaymentIntentId: string) {
    return this.prisma.payment.findFirst({ where: { stripePaymentIntentId } })
  }

  /**
   * Marca o pagamento como PAID e credita os pães da compra — as duas coisas juntas, e no máximo
   * UMA vez por pagamento.
   *
   * A trava é o próprio Payment: o `updateMany` guardado por status só casa para quem chegar
   * primeiro. Webhook do Mercado Pago, webhook do Stripe, pull de reconciliação e a cobrança
   * síncrona do cartão salvo disputam o mesmo pagamento — antes cada um conferia o status num
   * objeto lido ANTES e depois creditava, então dois ao mesmo tempo creditavam em dobro. Dentro da
   * transação, ou o pagamento vira PAID com o crédito, ou nada acontece.
   *
   * REFUNDED fica de fora de propósito: um `succeeded` reentregue depois do estorno não devolve os
   * pães. FAILED entra porque o cliente pode refazer o mesmo PaymentIntent com outro cartão.
   *
   * @returns `true` só para quem creditou — é quem deve avisar o admin.
   */
  claimAndCreditPurchase(paymentId: string, userId: string, quantity: number): Promise<boolean> {
    // Dois caminhos no MESMO pagamento ao mesmo tempo: o Mongo aborta um deles com conflito de
    // escrita (P2034). Repetir é o que o Prisma recomenda — na volta, o perdedor já lê PAID e sai
    // sem creditar.
    return withWriteConflictRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const claimed = await tx.payment.updateMany({
          where: { id: paymentId, status: { in: ['PENDING', 'FAILED'] } },
          data: { status: 'PAID' },
        })
        if (claimed.count === 0) return false

        await tx.creditTransaction.create({
          data: {
            userId,
            type: 'PURCHASE',
            quantityMilli: toMilli(quantity),
            referenceId: paymentId,
            description: `Compra de ${quantity} ${quantity === 1 ? 'pãozin' : 'pãezins'}`,
          },
        })
        await tx.user.update({
          where: { id: userId },
          data: { creditMilli: { increment: toMilli(quantity) } },
        })
        return true
      }),
    )
  }
}
