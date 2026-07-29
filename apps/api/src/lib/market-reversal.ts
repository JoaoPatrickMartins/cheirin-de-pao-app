/**
 * market-reversal.ts — reversão de uma Cestinha: devolve estoque e estorna em crédito.
 *
 * Extraído de `MarketOrdersService.cancelOrder` para ser reusado pelo admin ao resolver uma
 * Cestinha "parada" (Onda B5). A matemática do estorno é delicada e não deve viver em dois lugares:
 *
 * - **Estorno é TUDO em crédito** (DEC-36), inclusive a parte paga em dinheiro, convertida a
 *   `ceil(moneyAmount / avulsoUnit)` — arredondamento a favor do cliente. Não há estorno no gateway.
 * - **Dinheiro só foi cobrado se o pedido saiu de `PENDING_PAYMENT`.** Um pedido que morreu
 *   aguardando Pix não teve dinheiro capturado, então só os créditos aplicados voltam.
 * - **Idempotente por `referenceId`**: uma `CreditTransaction` `MARKET_REFUND` com o id do pedido já
 *   existente impede o segundo crédito (rota chamada 2×, retry, sweep + admin ao mesmo tempo).
 */
import type { PrismaClient, MarketOrderStatus } from '@prisma/client'
import { brtDateStr } from './cutoff.js'

/** O que a reversão precisa saber do pedido. */
export interface ReversibleMarketOrder {
  id: string
  userId: string
  status: string
  breadQty: number
  creditsApplied: number
  moneyAmount: number
  scheduledDate: Date
  items: { productId: string; qty: number }[]
}

export interface ReverseMarketOrderOptions {
  /** Status terminal a gravar. */
  status: MarketOrderStatus
  /** Motivo (cancelReason em CANCELLED, failureReason em NOT_DELIVERED). */
  reason?: string
  /** Devolve os pãezinhos (aplicados + parte em dinheiro convertida). */
  refundCredits: boolean
  /** Devolve o estoque dos produtos. */
  returnStock: boolean
  /** Preço avulso do pão — converte a parte em dinheiro em pãezinhos. */
  avulsoUnit: number
  /** Admin que executou (auditoria); ausente = ação do próprio cliente. */
  adminId?: string
  /** Texto da `CreditTransaction`. */
  description?: string
}

/**
 * Quantos pãezinhos um estorno devolveria — `creditsApplied` + a parte em dinheiro convertida.
 * Exposto para a UI mostrar "isso vai devolver N 🥖" antes de confirmar.
 */
export function refundableCredits(
  order: Pick<ReversibleMarketOrder, 'status' | 'creditsApplied' | 'moneyAmount'>,
  avulsoUnit: number,
): number {
  const moneyPaid = order.status !== 'PENDING_PAYMENT' && order.moneyAmount > 0
  const moneyAsCredits = moneyPaid && avulsoUnit > 0 ? Math.ceil(order.moneyAmount / avulsoUnit) : 0
  return order.creditsApplied + moneyAsCredits
}

/**
 * Reverte uma Cestinha numa transação: estoque → crédito → status terminal.
 *
 * @returns pãezinhos efetivamente devolvidos (0 quando já havia estorno ou `refundCredits: false`)
 */
export async function reverseMarketOrder(
  prisma: PrismaClient,
  order: ReversibleMarketOrder,
  opts: ReverseMarketOrderOptions,
): Promise<number> {
  const refundCredits = opts.refundCredits ? refundableCredits(order, opts.avulsoUnit) : 0
  const dateStr = brtDateStr(order.scheduledDate)

  // Idempotência: nunca credita duas vezes o mesmo pedido.
  const existingRefund = await prisma.creditTransaction.findFirst({
    where: { type: 'MARKET_REFUND', referenceId: order.id },
    select: { id: true },
  })
  const doRefund = refundCredits > 0 && !existingRefund

  await prisma.$transaction(async (tx) => {
    if (opts.returnStock) {
      for (const it of order.items) {
        const p = await tx.product.findUnique({ where: { id: it.productId } })
        if (!p) continue
        if (p.stockType === 'FIXED') {
          await tx.product.update({ where: { id: p.id }, data: { stock: { increment: it.qty } } })
        } else {
          // DAILY: libera a reserva do dia (contador por produto+data).
          await tx.productDailyStock.updateMany({
            where: { productId: p.id, date: dateStr },
            data: { reserved: { decrement: it.qty } },
          })
        }
      }
    }

    if (doRefund) {
      await tx.user.update({
        where: { id: order.userId },
        data: { creditBalance: { increment: refundCredits } },
      })
      await tx.creditTransaction.create({
        data: {
          userId: order.userId,
          type: 'MARKET_REFUND',
          quantity: refundCredits,
          referenceId: order.id,
          description:
            opts.description ?? `Cancelamento da Cestinha — ${refundCredits} pãezinho(s) devolvido(s)`,
          adminId: opts.adminId,
          reason: opts.reason,
        },
      })
    }

    const now = new Date()
    await tx.marketOrder.update({
      where: { id: order.id },
      data: {
        status: opts.status,
        ...(opts.status === 'CANCELLED'
          ? { cancelledAt: now, cancelReason: opts.reason ?? null }
          : opts.status === 'NOT_DELIVERED'
            ? { failedAt: now, failureReason: opts.reason ?? null }
            : opts.status === 'DELIVERED'
              ? { deliveredAt: now }
              : {}),
      },
    })
  })

  return doRefund ? refundCredits : 0
}
