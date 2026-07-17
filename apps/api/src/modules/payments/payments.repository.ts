import { FastifyInstance } from 'fastify'
import { PaymentStatus, PaymentPurpose } from '@prisma/client'

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

  async creditUserBalance(userId: string, quantity: number, paymentId: string) {
    const [, updatedUser] = await this.prisma.$transaction([
      this.prisma.creditTransaction.create({
        data: {
          userId,
          type: 'PURCHASE',
          quantity,
          referenceId: paymentId,
          description: `Compra de ${quantity} crédito(s)`,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: quantity } },
      }),
    ])
    return updatedUser
  }
}
