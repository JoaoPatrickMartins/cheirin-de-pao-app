import { FastifyInstance } from 'fastify'
import { AdminPaymentsRepository } from './admin-payments.repository.js'
import { StripeService } from '../payments/stripe.service.js'

/**
 * AdminPaymentsService — lista de pagamentos e estorno via Stripe.
 *
 * PAY-03: lista de pagamentos com status
 * PAY-04: estorno (refund total do PaymentIntent) + $transaction atomica
 *
 * Segurança:
 * - T-07-05-01: role check ADMIN no controller
 * - T-07-05-02: verificar status=PAID antes de estornar; $transaction atomica
 * - T-07-05-03: findUnique com 404 antes de chamar o Stripe
 * - T-07-05-06: creditsToDebit calculado no server (D-04, D-05)
 */
export class AdminPaymentsService {
  private repo: AdminPaymentsRepository
  private stripe: StripeService

  constructor(private fastify: FastifyInstance) {
    this.repo = new AdminPaymentsRepository(fastify)
    this.stripe = new StripeService(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * list — lista todos os pagamentos com dados do usuário.
   *
   * PAY-03: lista somente leitura com status enum.
   */
  async list() {
    const payments = await this.repo.findAll()

    // Enriquecer com nome do user via findUnique por userId
    const results = await Promise.all(
      payments.map(async (payment) => {
        const user = await this.prisma.user.findUnique({
          where: { id: payment.userId },
          select: { id: true, name: true, email: true },
        })
        return { ...payment, user: user ?? undefined }
      }),
    )

    return results
  }

  /**
   * getById — detalhe completo de um pagamento + User.
   */
  async getById(id: string) {
    const payment = await this.repo.findById(id)
    if (!payment) {
      throw { statusCode: 404, message: 'Pagamento não encontrado' }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payment.userId },
      select: { id: true, name: true, email: true, phone: true },
    })

    return { ...payment, user: user ?? undefined }
  }

  /**
   * refund — processa estorno do pagamento via Stripe + $transaction atomica.
   *
   * Fluxo:
   * 1. Buscar Payment por id, 404 se não existir (T-07-05-03)
   * 2. Verificar status === 'PAID' — 400 se diferente (T-07-05-02)
   * 3. Verificar stripePaymentIntentId não nulo — 400 se nulo (T-07-05-03)
   * 4. Chamar stripe.refund(paymentIntentId) (estorno TOTAL)
   * 5. Calcular creditsToDebit = Math.min(paesQty, user.creditBalance) (D-05)
   * 6. $transaction: update Payment + create CreditTransaction + user.decrement (T-07-05-02)
   */
  async refund(id: string) {
    // 1. Buscar Payment — 404 se não existir (T-07-05-03)
    const payment = await this.repo.findById(id)
    if (!payment) {
      throw { statusCode: 404, message: 'Pagamento não encontrado' }
    }

    // 2. Verificar status === PAID (T-07-05-02)
    if (payment.status !== 'PAID') {
      throw {
        statusCode: 400,
        message: 'Pagamento não pode ser estornado: status atual é ' + payment.status,
      }
    }

    // 3. Verificar stripePaymentIntentId não nulo (T-07-05-03)
    if (!payment.stripePaymentIntentId) {
      throw { statusCode: 400, message: 'Pagamento sem ID do Stripe — não pode ser estornado' }
    }

    // 4. Estorno TOTAL no Stripe (PAY-04, D-04)
    await this.stripe.refund(payment.stripePaymentIntentId)

    // 5. Calcular creditsToDebit (D-05: debitar apenas créditos disponíveis)
    const userId = payment.userId
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw { statusCode: 404, message: 'Usuário não encontrado' }
    }

    let paesQty = 0
    if (payment.comboId) {
      const combo = await this.prisma.combo.findUnique({ where: { id: payment.comboId } })
      paesQty = combo?.quantity ?? 0
    } else if (payment.customQuantity) {
      paesQty = payment.customQuantity
    }

    const creditsToDebit = Math.min(paesQty, user.creditBalance)

    // 6. $transaction atomica: Payment.status=REFUNDED + CreditTransaction + user.decrement
    // (T-07-05-02: atomicidade evita debito duplo)
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id },
        data: { status: 'REFUNDED' },
      }),
      this.prisma.creditTransaction.create({
        data: {
          userId,
          type: 'REFUND',
          quantity: -creditsToDebit,
          referenceId: id,
          description: `Estorno de ${creditsToDebit} crédito(s) — pagamento ${id}`,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { creditBalance: { decrement: creditsToDebit } },
      }),
    ])

    return { refunded: true, paymentId: id, creditsDebited: creditsToDebit }
  }
}
