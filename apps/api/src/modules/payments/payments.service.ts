import { FastifyInstance } from 'fastify'
import { MercadoPagoConfig, Payment, Customer, CustomerCard, CardToken } from 'mercadopago'
import { PaymentsRepository } from './payments.repository.js'

export class PaymentsService {
  private repo: PaymentsRepository
  private mpClient: MercadoPagoConfig
  private paymentApi: Payment
  private customerApi: Customer
  private customerCardApi: CustomerCard
  private cardTokenApi: CardToken

  constructor(private fastify: FastifyInstance) {
    this.repo = new PaymentsRepository(fastify)
    this.mpClient = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
      options: { timeout: 5000 },
    })
    this.paymentApi = new Payment(this.mpClient)
    this.customerApi = new Customer(this.mpClient)
    this.customerCardApi = new CustomerCard(this.mpClient)
    this.cardTokenApi = new CardToken(this.mpClient)
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
      const amount = Math.round(combo.price * 100) / 100
      return {
        amount,
        quantity: combo.quantity,
        description: `Compra ${combo.name} — Cheirin de Pão`,
      }
    }

    if (customQuantity) {
      const setting = await this.prisma.setting.findUnique({ where: { key: 'avulsoUnit' } })
      if (!setting) throw { error: 'Configuração de preço avulso não encontrada', status: 500 }
      const unitPrice = parseFloat(setting.value)
      const amount = Math.round(unitPrice * customQuantity * 100) / 100
      return {
        amount,
        quantity: customQuantity,
        description: `Compra avulsa de ${customQuantity} pão(es) — Cheirin de Pão`,
      }
    }

    throw { error: 'comboId ou customQuantity obrigatório', status: 400 }
  }

  async createPix(params: { comboId?: string; customQuantity?: number; userId: string }) {
    const { comboId, customQuantity, userId } = params

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw { error: 'Usuário não encontrado', status: 404 }

    const { amount, quantity, description } = await this.resolveAmount(comboId, customQuantity)

    const response = await this.paymentApi.create({
      body: {
        transaction_amount: amount,
        description,
        payment_method_id: 'pix',
        payer: { email: user.email ?? `${user.id}@cheirin.app` },
      },
    })

    const mercadoPagoId = String(response.id)
    const payment = await this.repo.createPayment({
      userId,
      amount,
      method: 'PIX',
      status: 'PENDING',
      mercadoPagoId,
      comboId,
      customQuantity,
    })

    const txData = response.point_of_interaction?.transaction_data
    return {
      paymentId: payment.id,
      qr_code_base64: txData?.qr_code_base64 ?? '',
      qr_code: txData?.qr_code ?? '',
    }
  }

  // ── getOrCreateMpCustomer ─────────────────────────────────────────────────
  // Idempotente: verifica DB → busca MP → cria (T-12-06: nunca cria duplicata)
  // WR-01: lança erro se usuário não existir (null-safety — user? não é suficiente)
  private async getOrCreateMpCustomer(userId: string, userEmail: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw { error: 'Usuário não encontrado', status: 404 }
    if (user.mpCustomerId) return user.mpCustomerId

    const email = userEmail ?? `${userId}@cheirin.app`
    const searchResult = await this.customerApi.search({ options: { email } })
    const existing = searchResult?.results?.[0]
    if (existing?.id) {
      await this.prisma.user.update({ where: { id: userId }, data: { mpCustomerId: existing.id } })
      return existing.id
    }

    const created = await this.customerApi.create({ body: { email } })
    if (!created?.id) throw { error: 'Falha ao criar cliente no Mercado Pago', status: 502 }
    await this.prisma.user.update({ where: { id: userId }, data: { mpCustomerId: created.id } })
    return created.id
  }

  async createCard(params: {
    token?: string
    savedCardId?: string
    securityCode?: string
    saveCard?: boolean
    installments?: number
    issuerId?: string
    paymentMethodId?: string
    payerEmail?: string
    payerIdentification?: { type: string; number: string }
    comboId?: string
    customQuantity?: number
    userId: string
  }) {
    const {
      token: rawToken,
      savedCardId,
      securityCode,
      saveCard = false,
      installments = 1,
      issuerId,
      paymentMethodId,
      payerEmail,
      payerIdentification,
      comboId,
      customQuantity,
      userId,
    } = params

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw { error: 'Usuário não encontrado', status: 404 }

    const { amount, quantity, description } = await this.resolveAmount(comboId, customQuantity)

    let paymentToken: string | undefined = rawToken
    let savedCard: { userId: string; mpCardId: string; brand: string } | null = null

    // ── Fluxo com cartão salvo (CARD-06) ──────────────────────────────────
    if (savedCardId) {
      savedCard = await this.prisma.savedCard.findUnique({ where: { id: savedCardId } })
      // T-12-01: IDOR — 404 mesmo se cartão existe mas é de outro usuário
      if (!savedCard || savedCard.userId !== userId) {
        throw { error: 'Cartão não encontrado', status: 404 }
      }
      if (!user.mpCustomerId) {
        throw { error: 'Perfil de pagamento não encontrado. Realize uma compra nova primeiro.', status: 400 }
      }
      // CVV (securityCode) processado AQUI e descartado — nunca vai para Payment.create (T-12-02)
      const tokenResponse = await this.cardTokenApi.create({
        body: {
          card_id: savedCard.mpCardId,
          customer_id: user.mpCustomerId,
          security_code: securityCode,
        },
      })
      if (!tokenResponse?.id) {
        throw { error: 'Falha ao gerar token do cartão', status: 502 }
      }
      paymentToken = tokenResponse.id
    }

    if (!paymentToken) {
      throw { error: 'Token de pagamento inválido', status: 400 }
    }

    const response = await this.paymentApi.create({
      body: {
        transaction_amount: amount,
        description,
        token: paymentToken,
        installments,
        // payment_method_id é OBRIGATÓRIO pelo MP para cartão (ex.: "master", "visa").
        // O Brick fornece em formData.payment_method_id; sem ele o MP retorna internal_error.
        // WR-05: usa brand do cartão salvo como fallback quando savedCardId está presente
        payment_method_id: paymentMethodId ?? (savedCardId ? savedCard?.brand : undefined),
        issuer_id: issuerId ? parseInt(issuerId) : undefined,
        // Prioriza o e-mail informado no checkout; cai para o do cadastro e, por fim, um sintético.
        // identification (CPF) vem do Brick — exigido pelo MP em produção no Brasil.
        payer: {
          email: payerEmail ?? user.email ?? `${user.id}@cheirin.app`,
          identification: payerIdentification,
        },
      },
    })

    const mercadoPagoId = String(response.id)
    const payment = await this.repo.createPayment({
      userId,
      amount,
      method: 'CREDIT_CARD',
      status: 'PENDING',
      mercadoPagoId,
      comboId,
      customQuantity,
    })

    // ── Salvar cartão após pagamento bem-sucedido (CARD-02) ───────────────
    // T-12-04: Customer.createCard e savedCard.create SOMENTE após Payment.create bem-sucedido
    // T-12-03: verifica count < 3 antes de salvar
    if (saveCard && rawToken && !savedCardId) {
      const mpCustomerId = await this.getOrCreateMpCustomer(
        userId,
        payerEmail ?? user.email ?? `${userId}@cheirin.app`
      )
      const count = await this.prisma.savedCard.count({ where: { userId } })
      if (count < 3) {
        const mpCard = await this.customerCardApi.create({
          customerId: mpCustomerId,
          body: { token: rawToken },
        })
        if (mpCard?.id) {
          // CR-01: recontagem pós-criação no MP para evitar race condition no limite de 3 cartões.
          // Dois requests concorrentes passariam pelo count < 3 inicial; este segundo count
          // garante que somente o primeiro a salvar vence — o excedente remove o cartão no MP
          // e retorna sem persistir (pagamento já efetuado com sucesso).
          const currentCount = await this.prisma.savedCard.count({ where: { userId } })
          if (currentCount >= 3) {
            // Rollback no MP — cartão criado mas limite atingido por request concorrente
            try {
              await this.customerCardApi.remove({ customerId: mpCustomerId, id: mpCard.id })
            } catch {
              this.fastify.log.error({ mpCardId: mpCard.id }, 'MP rollback failed after concurrent limit exceeded')
            }
            return { paymentId: payment.id }
          }

          const isDefault = currentCount === 0
          const brand = ((mpCard as { payment_method?: { id?: string } }).payment_method?.id ?? '').toLowerCase()
          const lastFour = (mpCard as { last_four_digits?: string }).last_four_digits ?? ''
          const expMonth = String((mpCard as { expiration_month?: number }).expiration_month ?? '').padStart(2, '0')
          const expYear = String((mpCard as { expiration_year?: number }).expiration_year ?? '')
          const expiresAt = expYear && expMonth ? `${expYear}-${expMonth}` : ''
          await this.prisma.savedCard.create({
            data: {
              userId,
              mpCardId: mpCard.id,
              brand,
              lastFour,
              expiresAt,
              isDefault,
            },
          })
        }
      }
    }

    return { paymentId: payment.id }
  }

  async getStatus(paymentId: string, userId: string): Promise<{
    status: 'pending' | 'approved' | 'rejected'
    creditBalance?: number
  }> {
    const payment = await this.repo.findPaymentById(paymentId)
    if (!payment || payment.userId !== userId) {
      throw { error: 'Pagamento não encontrado', status: 404 }
    }

    if (payment.status === 'PAID') {
      const user = await this.prisma.user.findUnique({ where: { id: userId } })
      return { status: 'approved', creditBalance: user?.creditBalance ?? 0 }
    }

    if (payment.status === 'FAILED' || payment.status === 'REFUNDED') {
      return { status: 'rejected' }
    }

    return { status: 'pending' }
  }
}
