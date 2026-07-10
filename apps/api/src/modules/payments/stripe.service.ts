import { FastifyInstance } from 'fastify'
import Stripe from 'stripe'

// Cliente Stripe singleton (server-side). Inicialização preguiçosa para não quebrar
// em ambientes sem a chave (ex.: testes que não tocam pagamento).
let stripeSingleton: Stripe | null = null
function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw { error: 'STRIPE_SECRET_KEY não configurada', status: 500 }
    stripeSingleton = new Stripe(key, { timeout: 8000, maxNetworkRetries: 2 })
  }
  return stripeSingleton
}

const CURRENCY = 'brl'
const toCents = (reais: number) => Math.round(reais * 100)

/**
 * Camada de integração com o Stripe — centraliza customer, cartões salvos
 * (PaymentMethods), cobranças off_session (sem CVV), Pix e estornos.
 * Substitui o uso direto do SDK do Mercado Pago nos módulos de pagamento.
 */
export class StripeService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  get client(): Stripe {
    return getStripe()
  }

  // ── getOrCreateCustomer ────────────────────────────────────────────────────
  // Idempotente: usa stripeCustomerId do banco; senão cria no Stripe e persiste.
  async getOrCreateCustomer(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw { error: 'Usuário não encontrado', status: 404 }
    if (user.stripeCustomerId) return user.stripeCustomerId

    const customer = await getStripe().customers.create({
      email: user.email ?? undefined,
      name: user.name,
      metadata: { userId },
    })
    await this.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } })
    return customer.id
  }

  // ── createSetupIntent ──────────────────────────────────────────────────────
  // Usado pela tela "adicionar cartão": o front confirma com Elements (SAQ-A) e
  // o cartão fica salvo no customer para uso off_session (sem CVV) futuro.
  async createSetupIntent(userId: string): Promise<{ clientSecret: string; customerId: string }> {
    const customerId = await this.getOrCreateCustomer(userId)
    const setupIntent = await getStripe().setupIntents.create({
      customer: customerId,
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata: { userId },
    })
    if (!setupIntent.client_secret) throw { error: 'Falha ao iniciar cadastro de cartão', status: 502 }
    return { clientSecret: setupIntent.client_secret, customerId }
  }

  // ── listCards / detach / default ───────────────────────────────────────────
  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const res = await getStripe().paymentMethods.list({ customer: customerId, type: 'card' })
    return res.data
  }

  async getPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return getStripe().paymentMethods.retrieve(paymentMethodId)
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    await getStripe().paymentMethods.detach(paymentMethodId)
  }

  // Define o cartão padrão do customer (usado nas cobranças off_session automáticas)
  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await getStripe().customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })
  }

  // ── chargeOffSession ───────────────────────────────────────────────────────
  // Cobrança de cartão salvo SEM CVV (merchant-initiated). É o coração da recarga
  // automática e do "1 toque". Lança erro estruturado em recusa (inclui code/decline
  // e, quando aplicável, authentication_required para fallback de 3DS no fluxo manual).
  async chargeOffSession(params: {
    customerId: string
    paymentMethodId: string
    amount: number
    description: string
    metadata?: Record<string, string>
    idempotencyKey?: string
  }): Promise<Stripe.PaymentIntent> {
    const { customerId, paymentMethodId, amount, description, metadata, idempotencyKey } = params
    try {
      return await getStripe().paymentIntents.create(
        {
          amount: toCents(amount),
          currency: CURRENCY,
          customer: customerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          description,
          metadata,
        },
        idempotencyKey ? { idempotencyKey } : undefined,
      )
    } catch (err) {
      const e = err as Stripe.errors.StripeError
      throw {
        error: 'Pagamento recusado',
        status: 402,
        code: e.code,
        declineCode: (e as Stripe.errors.StripeCardError).decline_code,
        paymentIntentId: e.payment_intent?.id,
      }
    }
  }

  // ── createPixPayment ───────────────────────────────────────────────────────
  // Pix para top-up manual. Retorna o copia-e-cola e o QR (next_action).
  async createPixPayment(params: {
    customerId: string
    amount: number
    description: string
    metadata?: Record<string, string>
  }): Promise<{ paymentIntent: Stripe.PaymentIntent; qrCode: string; qrCodeImageUrl: string; expiresAt: number | null }> {
    const { customerId, amount, description, metadata } = params
    const intent = await getStripe().paymentIntents.create({
      amount: toCents(amount),
      currency: CURRENCY,
      customer: customerId,
      payment_method_types: ['pix'],
      payment_method_data: { type: 'pix' },
      confirm: true,
      description,
      metadata,
    })
    const pix = intent.next_action?.pix_display_qr_code
    return {
      paymentIntent: intent,
      qrCode: pix?.data ?? '',
      qrCodeImageUrl: pix?.image_url_png ?? '',
      expiresAt: pix?.expires_at ?? null,
    }
  }

  // ── createCardIntent ───────────────────────────────────────────────────────
  // Cartão NOVO (on-session): cria o PaymentIntent e devolve o client_secret para o
  // front confirmar via Stripe Elements (cartão coletado no navegador → SAQ-A, 3DS quando exigido).
  // saveCard=true marca setup_future_usage off_session para reaproveitar sem CVV depois.
  async createCardIntent(params: {
    customerId: string
    amount: number
    description: string
    saveCard?: boolean
    metadata?: Record<string, string>
  }): Promise<Stripe.PaymentIntent> {
    return getStripe().paymentIntents.create({
      amount: toCents(params.amount),
      currency: CURRENCY,
      customer: params.customerId,
      description: params.description,
      setup_future_usage: params.saveCard ? 'off_session' : undefined,
      metadata: params.metadata,
      // Apenas métodos sem redirect (cartão); evita fluxos de redirect no PWA.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    })
  }

  // ── refund ─────────────────────────────────────────────────────────────────
  async refund(paymentIntentId: string): Promise<Stripe.Refund> {
    return getStripe().refunds.create({ payment_intent: paymentIntentId })
  }

  // ── webhook ────────────────────────────────────────────────────────────────
  constructWebhookEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) throw { error: 'STRIPE_WEBHOOK_SECRET não configurada', status: 500 }
    return getStripe().webhooks.constructEvent(rawBody, signature, secret)
  }
}
