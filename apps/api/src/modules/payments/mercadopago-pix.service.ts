import { FastifyInstance } from 'fastify'
import { MercadoPagoConfig, Payment, PaymentRefund } from 'mercadopago'

// Client singleton (lazy) — não quebra em ambientes sem a chave (ex.: testes que não
// tocam Pix). Espelha o padrão do getStripe() do stripe.service.ts.
let clientSingleton: MercadoPagoConfig | null = null
function getClient(): MercadoPagoConfig {
  if (!clientSingleton) {
    const accessToken = process.env.MP_ACCESS_TOKEN
    if (!accessToken) throw { error: 'MP_ACCESS_TOKEN não configurada', status: 500 }
    clientSingleton = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } })
  }
  return clientSingleton
}

export interface PixResult {
  id: string
  status: string
  /** Copia-e-cola (EMV). */
  qrCode: string
  /** PNG em base64 (SEM o prefixo data:). */
  qrCodeBase64: string
  /** ISO 8601 de expiração, ou null. */
  expiresAt: string | null
}

/**
 * Camada de integração com o Mercado Pago — SOMENTE Pix. O cartão continua no Stripe
 * (ver stripe.service.ts). Cria cobrança Pix dinâmica (QR + copia-e-cola), consulta
 * status (para o pull) e estorna.
 */
export class MercadoPagoPixService {
  constructor(private fastify: FastifyInstance) {}

  async createPix(params: {
    amount: number
    description: string
    payerEmail: string | null
    payerName?: string | null
    metadata?: Record<string, string>
    idempotencyKey?: string
  }): Promise<PixResult> {
    const payment = new Payment(getClient())
    const res = await payment.create({
      body: {
        transaction_amount: params.amount,
        description: params.description,
        payment_method_id: 'pix',
        payer: {
          email: params.payerEmail ?? undefined,
          first_name: params.payerName ?? undefined,
        },
        metadata: params.metadata,
      },
      requestOptions: params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined,
    })
    const tx = res.point_of_interaction?.transaction_data
    return {
      id: String(res.id),
      status: res.status ?? 'pending',
      qrCode: tx?.qr_code ?? '',
      qrCodeBase64: tx?.qr_code_base64 ?? '',
      expiresAt: res.date_of_expiration ?? null,
    }
  }

  /** Busca o pagamento no MP — usado na reconciliação por pull e no webhook. */
  async getPayment(id: string) {
    const payment = new Payment(getClient())
    return payment.get({ id })
  }

  /** Estorno total (Pix). */
  async refund(id: string) {
    const refund = new PaymentRefund(getClient())
    return refund.create({ payment_id: id, body: {} })
  }
}
