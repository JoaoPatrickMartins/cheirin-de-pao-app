import { FastifyInstance } from 'fastify'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { PaymentsRepository } from './payments.repository.js'

export class PaymentsService {
  private repo: PaymentsRepository
  private mpClient: MercadoPagoConfig
  private paymentApi: Payment

  constructor(private fastify: FastifyInstance) {
    this.repo = new PaymentsRepository(fastify)
    this.mpClient = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
      options: { timeout: 5000 },
    })
    this.paymentApi = new Payment(this.mpClient)
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

  async createCard(params: {
    token: string
    installments?: number
    issuerId?: string
    paymentMethodId?: string
    payerEmail?: string
    payerIdentification?: { type: string; number: string }
    comboId?: string
    customQuantity?: number
    userId: string
  }) {
    const { token, installments = 1, issuerId, paymentMethodId, payerEmail, payerIdentification, comboId, customQuantity, userId } = params

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw { error: 'Usuário não encontrado', status: 404 }

    const { amount, quantity, description } = await this.resolveAmount(comboId, customQuantity)

    const response = await this.paymentApi.create({
      body: {
        transaction_amount: amount,
        description,
        token,
        installments,
        // payment_method_id é OBRIGATÓRIO pelo MP para cartão (ex.: "master", "visa").
        // O Brick fornece em formData.payment_method_id; sem ele o MP retorna internal_error.
        payment_method_id: paymentMethodId,
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

    // Save card token for future automatic purchases (D-06)
    if (token && user.id) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { cardTokenMp: token },
      })
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
