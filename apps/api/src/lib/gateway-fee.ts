/**
 * gateway-fee — a taxa retida pelo provedor de pagamento (Fase 3 do plano-financeiro-vendas).
 *
 * `Payment.amount` é o BRUTO e sempre foi. A taxa (≈0,99% no Pix, ≈4,98% no cartão) não era
 * gravada em lugar nenhum, então a **receita líquida não existia** — e num negócio de ticket baixo
 * e volume alto essa é uma das maiores linhas do DRE.
 *
 * **Duas fontes, nesta ordem de confiança:**
 *
 *   1. **Real** — o provedor informou (`Payment.gatewayFee` com `feeBasis: 'GATEWAY'`), gravado na
 *      borda do webhook, onde a resposta do gateway está em mãos.
 *   2. **Estimada** — `amount × alíquota do Setting`, calculada AQUI, na leitura.
 *
 * A estimativa **nunca é persistida**: gravá-la congelaria uma alíquota que muda com o tempo, e
 * uma renegociação com o provedor reescreveria o passado errado. Calcular na leitura também é o
 * que faz a linha funcionar **retroativamente** sobre todo o histórico — sem ela, o DRE nasceria
 * com meses em branco e sem comparativo.
 *
 * `basis` acompanha cada número pela mesma disciplina de `ProductCost.basis`: o relatório DECLARA
 * que a taxa é estimativa em vez de exibir um número redondo e errado.
 */
import type { PrismaClient, PaymentMethod } from '@prisma/client'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Chaves de Setting das alíquotas, por método. */
export const FEE_SETTING_KEYS: Record<PaymentMethod, string> = {
  PIX: 'taxaPix',
  CREDIT_CARD: 'taxaCartaoCredito',
  DEBIT_CARD: 'taxaCartaoDebito',
}

/**
 * Alíquotas padrão em PERCENTUAL (não fração).
 *
 * São as tabelas públicas de referência do mercado em 2026 — ponto de partida, não verdade: cada
 * conta negocia a sua. Por isso são `Setting`, editáveis pelo admin, e por isso o número estimado
 * é sempre rotulado como estimativa na tela.
 */
export const DEFAULT_FEE_PCT: Record<PaymentMethod, number> = {
  PIX: 0.99,
  CREDIT_CARD: 4.98,
  DEBIT_CARD: 1.99,
}

export type FeeBasis = 'GATEWAY' | 'ESTIMATED'

export interface FeeRates {
  /** Percentual por método (ex.: 0.99 = 0,99%). */
  pct: Record<PaymentMethod, number>
}

/** Lê as alíquotas configuradas, caindo nos padrões quando o admin ainda não ajustou. */
export async function loadFeeRates(prisma: PrismaClient): Promise<FeeRates> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(FEE_SETTING_KEYS) } },
    select: { key: true, value: true },
  })
  const byKey = new Map(rows.map((r) => [r.key, r.value]))

  const pct = {} as Record<PaymentMethod, number>
  for (const [method, key] of Object.entries(FEE_SETTING_KEYS) as Array<[PaymentMethod, string]>) {
    const raw = byKey.get(key)
    const parsed = raw != null ? Number.parseFloat(raw) : Number.NaN
    // Valor inválido no banco cai no padrão em vez de virar NaN — um NaN se propagaria por toda a
    // soma do DRE e o total inteiro apareceria como "NaN" na tela.
    pct[method] =
      Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : DEFAULT_FEE_PCT[method]
  }
  return { pct }
}

/** O mínimo que este módulo precisa de um pagamento. */
export interface FeeablePayment {
  amount: number
  method: PaymentMethod
  gatewayFee?: number | null
  feeBasis?: string | null
}

export interface ResolvedFee {
  fee: number
  net: number
  basis: FeeBasis
}

/**
 * Taxa de UM pagamento: a real quando existe, senão a estimada.
 *
 * `gatewayFee` só conta como real quando `feeBasis === 'GATEWAY'`. A checagem dupla é de propósito:
 * um `gatewayFee` presente sem a marca de origem seria um número de procedência desconhecida, e
 * tratá-lo como real esconderia o problema em vez de declará-lo.
 */
export function resolveFee(payment: FeeablePayment, rates: FeeRates): ResolvedFee {
  if (payment.feeBasis === 'GATEWAY' && payment.gatewayFee != null) {
    const fee = round2(payment.gatewayFee)
    return { fee, net: round2(payment.amount - fee), basis: 'GATEWAY' }
  }
  const fee = round2((payment.amount * (rates.pct[payment.method] ?? 0)) / 100)
  return { fee, net: round2(payment.amount - fee), basis: 'ESTIMATED' }
}

export interface FeeSummary {
  /** Bruto somado. */
  gross: number
  /** Taxa somada. */
  fee: number
  /** `gross − fee`. */
  net: number
  /** Quantos pagamentos entraram. */
  count: number
  /** Recorte com taxa REAL informada pelo provedor. */
  realCount: number
  /**
   * Recorte ESTIMADO. Enquanto > 0, a linha é parcialmente estimativa — e a tela precisa dizer
   * isso, em vez de exibir um número redondo como se fosse extrato.
   */
  estimatedCount: number
  /** Taxa efetiva sobre o bruto, em % (1 casa). */
  effectivePct: number
}

/** Agrega bruto, taxa e líquido de um conjunto de pagamentos. */
export function summarizeFees(payments: FeeablePayment[], rates: FeeRates): FeeSummary {
  let gross = 0
  let fee = 0
  let realCount = 0

  for (const p of payments) {
    const r = resolveFee(p, rates)
    gross += p.amount
    fee += r.fee
    if (r.basis === 'GATEWAY') realCount++
  }

  gross = round2(gross)
  fee = round2(fee)
  return {
    gross,
    fee,
    net: round2(gross - fee),
    count: payments.length,
    realCount,
    estimatedCount: payments.length - realCount,
    effectivePct: gross > 0 ? Math.round((fee / gross) * 1000) / 10 : 0,
  }
}

/**
 * Grava a taxa REAL de um pagamento — chamada da borda do webhook, com a resposta do gateway em
 * mãos.
 *
 * **Best-effort e nunca bloqueante:** a taxa é informação contábil, e o fulfillment (creditar o
 * cliente, confirmar a Cestinha) não pode falhar porque o provedor mudou o formato de um campo.
 * Falha aqui só significa que aquele pagamento continua com a taxa estimada.
 */
export async function recordGatewayFee(
  prisma: PrismaClient,
  paymentId: string,
  fee: number | null | undefined,
  amount: number,
): Promise<void> {
  // Taxa negativa ou maior que o próprio pagamento é dado corrompido do provedor: descartar é
  // melhor que gravar um líquido negativo que contaminaria o DRE.
  if (fee == null || !Number.isFinite(fee) || fee < 0 || fee > amount) return

  const rounded = round2(fee)
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      gatewayFee: rounded,
      netAmount: round2(amount - rounded),
      feeBasis: 'GATEWAY',
    },
  })
}

/**
 * Extrai a taxa do payload do Mercado Pago.
 *
 * O MP devolve `fee_details[]`, uma lista de cobranças de tipos diferentes (`mercadopago_fee`,
 * `application_fee`, `financing_fee`…). O que sai do valor do vendedor é a soma dos que têm
 * `fee_payer: 'collector'` — taxa paga pelo COMPRADOR não reduz o que se recebe.
 */
export function extractMercadoPagoFee(mpPayment: unknown): number | null {
  const details = (mpPayment as { fee_details?: unknown })?.fee_details
  if (!Array.isArray(details)) return null

  let total = 0
  let found = false
  for (const d of details) {
    const row = d as { amount?: unknown; fee_payer?: unknown }
    const value = typeof row.amount === 'number' ? row.amount : Number.NaN
    if (!Number.isFinite(value)) continue
    // `fee_payer` ausente é tratado como do vendedor: é o caso padrão do MP, e ignorá-lo
    // subestimaria a taxa (erro que INFLA o lucro — o pior dos dois lados).
    if (row.fee_payer != null && row.fee_payer !== 'collector') continue
    total += value
    found = true
  }
  return found ? round2(total) : null
}
