import { FastifyInstance } from 'fastify'
import { PaymentsRepository } from './payments.repository.js'
import { StripeService } from './stripe.service.js'
import { MercadoPagoPixService } from './mercadopago-pix.service.js'
import { creditForPayment } from './credit-payment.js'
import { effectiveComboPrice } from '../../lib/combo-pricing.js'
import { notifyAdminsCreditPurchase } from './notify-credit-purchase.js'

export class PaymentsService {
  private repo: PaymentsRepository
  private stripe: StripeService
  private mp: MercadoPagoPixService

  constructor(private fastify: FastifyInstance) {
    this.repo = new PaymentsRepository(fastify)
    this.stripe = new StripeService(fastify)
    this.mp = new MercadoPagoPixService(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  private async resolveAmount(comboId?: string, customQuantity?: number): Promise<{
    amount: number
    quantity: number
    description: string
  }> {
    if (comboId) {
      const combo = await this.prisma.combo.findUnique({ where: { id: comboId } })
      if (!combo) throw { error: 'Combo não encontrado', status: 404 }
      // Aplica a promoção ativa (se houver) para cobrar exatamente o preço exibido.
      const promo = await this.prisma.promotion.findFirst({
        where: { comboId, isActive: true },
        orderBy: { createdAt: 'desc' },
      })
      const amount = effectiveComboPrice(combo.price, promo)
      return { amount, quantity: combo.quantity, description: `Compra ${combo.name} — Cheirin de Pão` }
    }
    if (customQuantity) {
      const setting = await this.prisma.setting.findUnique({ where: { key: 'avulsoUnit' } })
      if (!setting) throw { error: 'Configuração de preço avulso não encontrada', status: 500 }
      const unitPrice = parseFloat(setting.value)
      const amount = Math.round(unitPrice * customQuantity * 100) / 100
      return { amount, quantity: customQuantity, description: `Compra avulsa de ${customQuantity} pão(es) — Cheirin de Pão` }
    }
    throw { error: 'comboId ou customQuantity obrigatório', status: 400 }
  }

  private metadata(userId: string, comboId?: string, customQuantity?: number): Record<string, string> {
    const m: Record<string, string> = { userId }
    if (comboId) m.comboId = comboId
    if (customQuantity) m.customQuantity = String(customQuantity)
    return m
  }

  // ── Pix (Mercado Pago) ─────────────────────────────────────────────────────
  // O Pix roda no Mercado Pago (o cartão continua no Stripe). O crédito ocorre depois,
  // via webhook do MP OU via reconciliação no getStatus (pull) — ambos idempotentes.
  async createPix(params: { comboId?: string; customQuantity?: number; userId: string }) {
    const { comboId, customQuantity, userId } = params
    const { amount, description } = await this.resolveAmount(comboId, customQuantity)

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw { error: 'Usuário não encontrado', status: 404 }

    const pix = await this.mp.createPix({
      amount,
      description,
      payerEmail: user.email,
      payerName: user.name,
      metadata: this.metadata(userId, comboId, customQuantity),
    })

    const payment = await this.repo.createPayment({
      userId,
      amount,
      method: 'PIX',
      status: 'PENDING',
      mercadoPagoId: pix.id,
      comboId,
      customQuantity,
    })

    return {
      paymentId: payment.id,
      status: 'pending' as const,
      pixCopyPaste: pix.qrCode,
      // data-URI direto: a tela usa em <img src>. base64 vazio → string vazia (sem quebrar).
      pixQrCodeUrl: pix.qrCodeBase64 ? `data:image/png;base64,${pix.qrCodeBase64}` : '',
      expiresAt: pix.expiresAt,
    }
  }

  // ── Cartão ─────────────────────────────────────────────────────────────────
  // savedCardId  → cobrança off_session (SEM CVV), aprovação síncrona → crédito imediato.
  // cartão novo  → cria PaymentIntent e devolve clientSecret para o front confirmar (Elements).
  async createCard(params: {
    savedCardId?: string
    saveCard?: boolean
    comboId?: string
    customQuantity?: number
    userId: string
  }) {
    const { savedCardId, saveCard = false, comboId, customQuantity, userId } = params
    const { amount, quantity, description } = await this.resolveAmount(comboId, customQuantity)
    const customerId = await this.stripe.getOrCreateCustomer(userId)

    // ── Cartão salvo: off_session, sem CVV ──────────────────────────────────
    if (savedCardId) {
      const card = await this.prisma.savedCard.findUnique({ where: { id: savedCardId } })
      // IDOR: 404 mesmo se existe mas é de outro usuário
      if (!card || card.userId !== userId) throw { error: 'Cartão não encontrado', status: 404 }
      if (!card.stripePaymentMethodId) throw { error: 'Cartão sem vínculo de pagamento', status: 400 }

      const intent = await this.stripe.chargeOffSession({
        customerId,
        paymentMethodId: card.stripePaymentMethodId,
        amount,
        description,
        metadata: this.metadata(userId, comboId, customQuantity),
      })

      const payment = await this.repo.createPayment({
        userId,
        amount,
        method: 'CREDIT_CARD',
        status: 'PENDING',
        stripePaymentIntentId: intent.id,
        comboId,
        customQuantity,
      })

      // Cartão é aprovado de forma síncrona → credita já (webhook é rede de segurança,
      // que ignora pagamentos já PAID — sem risco de crédito em dobro).
      if (intent.status === 'succeeded') {
        await this.repo.creditUserBalance(userId, quantity, payment.id)
        await this.repo.updatePaymentStatus(payment.id, 'PAID')
        await notifyAdminsCreditPurchase(this.fastify, { userId, quantity, amount })
        return { paymentId: payment.id, status: 'approved' as const }
      }
      // 'processing' (raro p/ cartão) → aguarda webhook
      return { paymentId: payment.id, status: 'pending' as const }
    }

    // ── Cartão novo: PaymentIntent + clientSecret (confirmação no front via Elements) ─
    const intent = await this.stripe.createCardIntent({
      customerId,
      amount,
      description,
      saveCard,
      metadata: this.metadata(userId, comboId, customQuantity),
    })
    const payment = await this.repo.createPayment({
      userId,
      amount,
      method: 'CREDIT_CARD',
      status: 'PENDING',
      stripePaymentIntentId: intent.id,
      comboId,
      customQuantity,
    })
    return { paymentId: payment.id, status: 'pending' as const, clientSecret: intent.client_secret }
  }

  /**
   * Recarga automática (sem CVV) usada no corte da agenda.
   * Cobra o combo configurado em autoRecharge no cartão padrão via off_session e
   * credita sincronamente. Self-validating: retorna ok=false (com motivo) se a recarga
   * estiver inativa, sem consentimento, sem cartão padrão, ou se o cartão recusar.
   */
  async chargeAutoRecharge(userId: string): Promise<{ ok: boolean; reason?: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) return { ok: false, reason: 'user' }

    const ar = user.autoRecharge as { active?: boolean; comboId?: string } | null
    if (!ar?.active || !ar.comboId) return { ok: false, reason: 'inactive' }
    // Consentimento explícito é obrigatório para cobrar sem CVV (off_session)
    if (!user.offSessionConsentAt) return { ok: false, reason: 'consent' }
    // Rede de segurança: nunca cobrar num combo desativado (a desativação já desliga
    // o autoRecharge, mas isto cobre configs antigas que escaparam da cascata).
    const combo = await this.prisma.combo.findUnique({ where: { id: ar.comboId } })
    if (!combo || combo.isActive === false) return { ok: false, reason: 'combo_inactive' }

    const card = await this.prisma.savedCard.findFirst({ where: { userId, isDefault: true } })
    if (!card?.stripePaymentMethodId) return { ok: false, reason: 'no_card' }

    try {
      const res = await this.createCard({ savedCardId: card.id, comboId: ar.comboId, userId })
      return { ok: res.status === 'approved' }
    } catch (err) {
      this.fastify.log.warn({ userId, err }, '[auto-recharge] cobrança recusada')
      return { ok: false, reason: 'declined' }
    }
  }

  async getStatus(paymentId: string, userId: string): Promise<{
    status: 'pending' | 'approved' | 'rejected'
    creditBalance?: number
  }> {
    let payment = await this.repo.findPaymentById(paymentId)
    if (!payment || payment.userId !== userId) {
      throw { error: 'Pagamento não encontrado', status: 404 }
    }

    // Reconciliação por pull: se é um Pix (MP) ainda pendente, consulta o MP e credita
    // aqui mesmo — faz o Pix funcionar SEM depender de webhook público (localhost/CPF).
    // Idempotente: creditForPayment ignora pagamentos já PAID.
    if (payment.status === 'PENDING' && payment.method === 'PIX' && payment.mercadoPagoId) {
      try {
        const mp = await this.mp.getPayment(payment.mercadoPagoId)
        if (mp.status === 'approved') {
          await creditForPayment(this.fastify, payment)
        } else if (mp.status === 'rejected' || mp.status === 'cancelled') {
          await this.repo.updatePaymentStatus(payment.id, 'FAILED')
        }
        payment = await this.repo.findPaymentById(paymentId) // reflete o status atualizado
      } catch (err) {
        // Falha ao consultar o MP não deve quebrar o polling — segue como pending.
        this.fastify.log.warn({ err, paymentId }, '[pix] reconciliação com o MP falhou')
      }
    }

    if (payment!.status === 'PAID') {
      const user = await this.prisma.user.findUnique({ where: { id: userId } })
      return { status: 'approved', creditBalance: user?.creditBalance ?? 0 }
    }
    if (payment!.status === 'FAILED' || payment!.status === 'REFUNDED') {
      return { status: 'rejected' }
    }
    return { status: 'pending' }
  }
}
