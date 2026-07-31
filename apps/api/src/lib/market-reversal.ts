/**
 * market-reversal.ts — reversão de uma Cestinha: devolve estoque e estorna em crédito.
 *
 * Extraído de `MarketOrdersService.cancelOrder` para ser reusado pelo admin ao resolver uma
 * Cestinha "parada" (Onda B5). A matemática do estorno é delicada e não deve viver em dois lugares:
 *
 * - **Estorno é TUDO em crédito** (DEC-36), inclusive a parte paga em dinheiro. Não há estorno no
 *   gateway.
 * - **A devolução é PROPORCIONAL, nunca arredondada para cima.** R$ 0,60 com avulso de R$ 1,20
 *   devolve 0,5 🥖, não 1 🥖. Arredondar para o pãozinho inteiro era uma brecha explorável:
 *   pagar R$ 0,10 em dinheiro e cancelar devolvia R$ 1,20 em crédito — R$ 1,10 de lucro por
 *   ciclo, repetível à vontade. A conversão usa a MESMA função do débito (`creditsForPrice`),
 *   então comprar-e-cancelar é sempre neutro: sai 1 🥖 + R$ 0,60, volta 1,5 🥖.
 * - **Dinheiro só foi cobrado se o pedido saiu de `PENDING_PAYMENT`.** Um pedido que morreu
 *   aguardando Pix não teve dinheiro capturado, então só os créditos aplicados voltam.
 * - **Idempotente por `referenceId`**: uma `CreditTransaction` `MARKET_REFUND` com o id do pedido já
 *   existente impede o segundo crédito (rota chamada 2×, retry, sweep + admin ao mesmo tempo).
 */
import type { PrismaClient, MarketOrderStatus } from '@prisma/client'
import { creditsForPrice, formatCredits, fromMilli } from '@cheirin-de-pao/shared'
import { brtDateStr } from './cutoff.js'

/** O que a reversão precisa saber do pedido. */
export interface ReversibleMarketOrder {
  id: string
  userId: string
  status: string
  breadQty: number
  /** Pãezinhos aplicados, em MILÉSIMOS — o único campo de crédito do pedido. */
  creditsAppliedMilli: number | null
  moneyAmount: number
  scheduledDate: Date
  items: { productId: string; qty: number }[]
}

export interface ReverseMarketOrderOptions {
  /** Status terminal a gravar. */
  status: MarketOrderStatus
  /** Motivo (cancelReason em CANCELLED, failureReason em NOT_DELIVERED). */
  reason?: string
  /** Devolve os pãezinhos (aplicados + parte em dinheiro convertida proporcionalmente). */
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
 * Quanto um estorno devolveria, em MILÉSIMOS de pãozinho: o que foi debitado em crédito + a parte
 * paga em dinheiro convertida ao valor do pão avulso.
 *
 * Tudo **exato**, pelas duas pontas. A parte em crédito devolve o que saiu (1,5 🥖 → 1,5 🥖) — 2 🥖
 * daria meio pãozinho de graça. A parte em dinheiro converte proporcionalmente pela mesma função
 * do débito (`creditsForPrice`): R$ 0,60 com avulso R$ 1,20 → 0,5 🥖.
 *
 * O `ceil` para pãozinho inteiro que existia aqui era uma **brecha de dinheiro**: com uma
 * Cestinha que sobrasse R$ 0,10 em dinheiro, cada ciclo comprar-cancelar devolvia R$ 1,20 em
 * crédito e dava R$ 1,10 de lucro ao cliente, sem limite de repetição.
 */
export function refundableCreditsMilli(
  order: Pick<ReversibleMarketOrder, 'status' | 'creditsAppliedMilli' | 'moneyAmount'>,
  avulsoUnit: number,
): number {
  const creditsMilli = (order.creditsAppliedMilli ?? 0)
  const moneyPaid = order.status !== 'PENDING_PAYMENT' && order.moneyAmount > 0
  // Mesma função do débito → o ciclo comprar-cancelar fecha em zero, sem brecha.
  const moneyMilli = moneyPaid ? creditsForPrice(order.moneyAmount, avulsoUnit) : 0
  return creditsMilli + moneyMilli
}

/**
 * Mesma conta em pãezinhos DECIMAIS — para a UI mostrar "isso vai devolver 1,5 🥖" antes de
 * confirmar. A gravação usa a versão em milésimos.
 */
export function refundableCredits(
  order: Pick<ReversibleMarketOrder, 'status' | 'creditsAppliedMilli' | 'moneyAmount'>,
  avulsoUnit: number,
): number {
  return fromMilli(refundableCreditsMilli(order, avulsoUnit))
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
  const refundMilli = opts.refundCredits ? refundableCreditsMilli(order, opts.avulsoUnit) : 0
  const dateStr = brtDateStr(order.scheduledDate)

  // Idempotência: nunca credita duas vezes o mesmo pedido.
  const existingRefund = await prisma.creditTransaction.findFirst({
    where: { type: 'MARKET_REFUND', referenceId: order.id },
    select: { id: true },
  })
  // Gate no MILÉSIMO: um estorno de 0,4 🥖 arredonda para 0 no legado e seria engolido.
  const doRefund = refundMilli > 0 && !existingRefund

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
        data: { creditMilli: { increment: refundMilli } },
      })
      await tx.creditTransaction.create({
        data: {
          userId: order.userId,
          type: 'MARKET_REFUND',
          quantityMilli: refundMilli,
          referenceId: order.id,
          description:
            opts.description ??
            `Cancelamento da Cestinha — ${formatCredits(refundMilli)} pãezins devolvidos`,
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

  // Devolve em pãezinhos DECIMAIS — é o número que a UI mostra ("devolvidos 1,5 🥖").
  return doRefund ? fromMilli(refundMilli) : 0
}
