import { FastifyInstance } from 'fastify'
import { PaymentsRepository } from './payments.repository.js'
import { StripeService } from './stripe.service.js'
import { MercadoPagoPixService } from './mercadopago-pix.service.js'
import { creditForPayment } from './credit-payment.js'
import { fulfillSingleOrderFromMetadata } from './fulfill-single-order.js'
import { fulfillMarketOrder } from './fulfill-market-order.js'
import { effectiveComboPrice } from '../../lib/combo-pricing.js'
import { notifyAdminsCreditPurchase } from './notify-credit-purchase.js'
import { getGanchoConfig } from '../../lib/gancho-config.js'

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
  async createPix(params: {
    comboId?: string
    customQuantity?: number
    userId: string
    order?: { quantity: number; scheduledDate: string; deliveryTime?: string }
  }) {
    const { comboId, customQuantity, userId, order } = params
    const { amount, description } = await this.resolveAmount(comboId, customQuantity)

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw { error: 'Usuário não encontrado', status: 404 }

    // Metadata do MP. Para o Pedido único que paga a diferença, embute a intenção do pedido
    // (chaves snake_case) — lida na aprovação (webhook/pull) para criar a Order no servidor.
    const metadata = this.metadata(userId, comboId, customQuantity)
    if (order) {
      metadata.order_quantity = String(order.quantity)
      metadata.order_scheduled_date = order.scheduledDate
      if (order.deliveryTime) metadata.order_delivery_time = order.deliveryTime
    }

    const pix = await this.mp.createPix({
      amount,
      description,
      payerEmail: user.email,
      payerName: user.name,
      payerCpf: user.cpf,
      metadata,
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

  // ── Pix do gancho adicional (pago) ──────────────────────────────────────────
  // Cobra o preço configurado (ganchoPreco) via Pix. NÃO credita pães — o fulfillment
  // (credit-payment.ts, ramo purpose HOOK) coloca o HookRequest na fila do admin quando
  // o pagamento confirma (webhook MP ou reconciliação por pull em getStatus).
  async createHookPix(params: { userId: string }) {
    const { userId } = params
    const { preco } = await getGanchoConfig(this.prisma)

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw { error: 'Usuário não encontrado', status: 404 }

    const pix = await this.mp.createPix({
      amount: preco,
      description: 'Gancho de porta — Cheirin de Pão',
      payerEmail: user.email,
      payerName: user.name,
      payerCpf: user.cpf,
      metadata: { userId, purpose: 'hook' },
    })

    const payment = await this.repo.createPayment({
      userId,
      amount: preco,
      method: 'PIX',
      status: 'PENDING',
      mercadoPagoId: pix.id,
      purpose: 'HOOK',
    })

    return {
      paymentId: payment.id,
      amount: preco,
      status: 'pending' as const,
      pixCopyPaste: pix.qrCode,
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

  // ── Cestinha (mini market) — pagamento da parte em dinheiro ──────────────────
  // Valor arbitrário (moneyAmount calculado no checkout), purpose MARKET. NÃO credita pães:
  // o fulfillment (credit-payment.ts, ramo MARKET) confirma o MarketOrder vinculado por
  // paymentId. Ambos os métodos gravam MarketOrder.paymentId logo após criar o Payment, para
  // que webhook/pull encontrem a ordem.
  async createMarketPix(params: { userId: string; amount: number; marketOrderId: string }) {
    const { userId, amount, marketOrderId } = params
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw { error: 'Usuário não encontrado', status: 404 }

    const pix = await this.mp.createPix({
      amount,
      description: 'Cestinha — Além do Pãozin',
      payerEmail: user.email,
      payerName: user.name,
      payerCpf: user.cpf,
      metadata: { userId, purpose: 'market', marketOrderId },
    })

    const payment = await this.repo.createPayment({
      userId,
      amount,
      method: 'PIX',
      status: 'PENDING',
      mercadoPagoId: pix.id,
      purpose: 'MARKET',
    })
    await this.prisma.marketOrder.update({ where: { id: marketOrderId }, data: { paymentId: payment.id } })

    return {
      paymentId: payment.id,
      status: 'pending' as const,
      pixCopyPaste: pix.qrCode,
      pixQrCodeUrl: pix.qrCodeBase64 ? `data:image/png;base64,${pix.qrCodeBase64}` : '',
      expiresAt: pix.expiresAt,
    }
  }

  async createMarketCard(params: {
    userId: string
    amount: number
    marketOrderId: string
    savedCardId?: string
    saveCard?: boolean
  }) {
    const { userId, amount, marketOrderId, savedCardId, saveCard = false } = params
    const customerId = await this.stripe.getOrCreateCustomer(userId)
    const description = 'Cestinha — Além do Pãozin'
    const metadata = { userId, purpose: 'market', marketOrderId }

    // ── Cartão salvo: off_session, aprovação síncrona → confirma o MarketOrder já ──
    if (savedCardId) {
      const card = await this.prisma.savedCard.findUnique({ where: { id: savedCardId } })
      if (!card || card.userId !== userId) throw { error: 'Cartão não encontrado', status: 404 }
      if (!card.stripePaymentMethodId) throw { error: 'Cartão sem vínculo de pagamento', status: 400 }

      const intent = await this.stripe.chargeOffSession({
        customerId,
        paymentMethodId: card.stripePaymentMethodId,
        amount,
        description,
        metadata,
        // Trava anti-duplo-clique no Stripe, amarrada ao pedido (o createCard de pão não usa).
        idempotencyKey: `market_${marketOrderId}`,
      })

      const payment = await this.repo.createPayment({
        userId,
        amount,
        method: 'CREDIT_CARD',
        status: 'PENDING',
        stripePaymentIntentId: intent.id,
        purpose: 'MARKET',
      })
      await this.prisma.marketOrder.update({ where: { id: marketOrderId }, data: { paymentId: payment.id } })

      if (intent.status === 'succeeded') {
        // Confirma agora (webhook/pull são rede de segurança idempotente).
        await fulfillMarketOrder(this.fastify, payment)
        return { paymentId: payment.id, status: 'approved' as const }
      }
      return { paymentId: payment.id, status: 'pending' as const }
    }

    // ── Cartão novo: PaymentIntent + clientSecret (confirmação no front via Elements) ──
    const intent = await this.stripe.createCardIntent({ customerId, amount, description, saveCard, metadata })
    const payment = await this.repo.createPayment({
      userId,
      amount,
      method: 'CREDIT_CARD',
      status: 'PENDING',
      stripePaymentIntentId: intent.id,
      purpose: 'MARKET',
    })
    await this.prisma.marketOrder.update({ where: { id: marketOrderId }, data: { paymentId: payment.id } })
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
          // Pedido único que pagou a diferença: cria a Order no servidor a partir da metadata
          // do MP (funciona mesmo com o app fechado). Idempotente por paymentId e best-effort.
          await fulfillSingleOrderFromMetadata(this.fastify, payment, mp.metadata)
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
